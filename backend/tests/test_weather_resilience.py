"""Retry, stale-cache, and archive-fallback behavior for the Open-Meteo client."""

from __future__ import annotations

import asyncio
import inspect
from datetime import datetime, timedelta

import httpx
import pytest

from app.errors import DomainError
from app.schemas import CustomSiteInput
from app.services import weather


def _hours(temp: float, hours: int = 72, timezone: str = "America/Phoenix") -> dict:
    base = datetime(2026, 7, 13)
    times = [(base + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(hours)]
    return {
        "timezone": timezone,
        "hourly": {
            "time": times,
            "temperature_2m": [temp] * hours,
            "relative_humidity_2m": [40] * hours,
            "dew_point_2m": [10.0] * hours,
        },
    }


class _Resp:
    def __init__(self, status: int, payload, headers: dict | None = None) -> None:
        self.status_code = status
        self._payload = payload
        self.headers = headers or {}

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _isolate_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(weather, "CACHE_DIR", tmp_path / "thirstcap_weather_cache")
    monkeypatch.delenv("OPEN_METEO_API_KEY", raising=False)
    weather._WEATHER_CACHE.clear()
    weather._KEY_LOCKS.clear()
    weather._KEY_LOCKS_GUARD = None
    weather._LOCK_LOOP = None
    yield
    weather._WEATHER_CACHE.clear()
    weather._KEY_LOCKS.clear()
    weather._KEY_LOCKS_GUARD = None
    weather._LOCK_LOOP = None


def _install_client(monkeypatch, handler):
    calls: list[dict] = []

    class _Client:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params=None, timeout=None):
            calls.append({"url": url, "params": params, "timeout": timeout})
            result = handler(url, params)
            if inspect.isawaitable(result):
                return await result
            return result

    monkeypatch.setattr(weather.httpx, "AsyncClient", _Client)
    return calls


def _no_sleep(monkeypatch):
    slept: list[float] = []

    async def _sleep(seconds: float) -> None:
        slept.append(seconds)

    monkeypatch.setattr(weather.asyncio, "sleep", _sleep)
    return slept


def test_retries_429_with_backoff_and_retry_after(monkeypatch):
    slept = _no_sleep(monkeypatch)
    state = {"n": 0}

    def handler(url, params):
        state["n"] += 1
        if state["n"] < 3:
            return _Resp(429, {"error": True}, {"Retry-After": "0.4"})
        return _Resp(200, _hours(22.0))

    _install_client(monkeypatch, handler)

    async def run():
        async with weather.httpx.AsyncClient() as client:
            return await weather._fetch_open_meteo(
                client,
                weather.LIVE_FORECAST_URL,
                35.6895,
                139.6917,
                "Asia/Tokyo",
                forecast_days=3,
            )

    data = asyncio.run(run())
    assert state["n"] == 3
    assert data["hourly"]["temperature_2m"][0] == 22.0
    assert len(slept) == 2
    assert all(0.39 <= delay <= weather.RETRY_BUDGET_SEC for delay in slept)


def test_retry_after_beyond_budget_stops_without_extra_attempts(monkeypatch):
    slept = _no_sleep(monkeypatch)
    state = {"n": 0}

    def handler(url, params):
        state["n"] += 1
        return _Resp(503, {"error": True}, {"Retry-After": "30"})

    _install_client(monkeypatch, handler)

    async def run():
        async with weather.httpx.AsyncClient() as client:
            await weather._fetch_open_meteo(
                client,
                weather.LIVE_FORECAST_URL,
                19.076,
                72.8777,
                "Asia/Kolkata",
                forecast_days=3,
            )

    with pytest.raises(DomainError) as exc:
        asyncio.run(run())
    assert state["n"] == 1
    assert slept == []
    assert exc.value.status_code == 502
    assert exc.value.details["status"] == 503


def test_retries_timeouts_then_succeeds(monkeypatch):
    _no_sleep(monkeypatch)
    state = {"n": 0}

    def handler(url, params):
        state["n"] += 1
        if state["n"] < 3:
            raise httpx.ReadTimeout("timed out")
        return _Resp(200, _hours(11.0))

    _install_client(monkeypatch, handler)

    async def run():
        async with weather.httpx.AsyncClient() as client:
            return await weather._fetch_open_meteo(
                client,
                weather.ARCHIVE_URL,
                33.4484,
                -112.074,
                "America/Phoenix",
                start="2026-07-13",
                end="2026-07-15",
            )

    data = asyncio.run(run())
    assert state["n"] == 3
    assert data["hourly"]["temperature_2m"][0] == 11.0


def test_live_pair_is_one_request_and_uses_customer_host(monkeypatch):
    monkeypatch.setenv("OPEN_METEO_API_KEY", "customer-test-key")

    def handler(url, params):
        lat = str(params["latitude"])
        assert "," in lat
        return _Resp(200, [_hours(30.0), _hours(16.0, timezone="America/Chicago")])

    calls = _install_client(monkeypatch, handler)
    bundle = asyncio.run(
        weather.load_weather("phoenix", "2026-07-13", "2026-07-19", foresight="live_forecast", live_days=3)
    )
    assert len(calls) == 1
    assert calls[0]["url"].startswith("https://customer-api.open-meteo.com/")
    assert calls[0]["params"]["apikey"] == "customer-test-key"
    assert bundle.is_live is True
    assert bundle.temp_c[0] == pytest.approx(30.0)
    assert bundle.sister_temp_c[0] == pytest.approx(16.0)
    assert "stale" not in bundle.weather_desc


def test_concurrent_identical_fetches_share_one_upstream_call(monkeypatch):
    state = {"n": 0}

    async def handler(url, params):
        state["n"] += 1
        await asyncio.sleep(0.05)
        return _Resp(200, _hours(15.0))

    _install_client(monkeypatch, handler)

    async def run():
        async with weather.httpx.AsyncClient() as client:
            return await asyncio.gather(
                weather._fetch_open_meteo(
                    client, weather.LIVE_FORECAST_URL, 35.6895, 139.6917, "Asia/Tokyo", forecast_days=3
                ),
                weather._fetch_open_meteo(
                    client, weather.LIVE_FORECAST_URL, 35.6895, 139.6917, "Asia/Tokyo", forecast_days=3
                ),
            )

    first, second = asyncio.run(run())
    assert state["n"] == 1
    assert first["hourly"]["temperature_2m"][0] == 15.0
    assert second["hourly"]["temperature_2m"][0] == 15.0


def test_stale_cache_is_served_when_upstream_rate_limits(monkeypatch):
    _no_sleep(monkeypatch)
    mode = {"fail": False}

    def handler(url, params):
        if mode["fail"]:
            return _Resp(429, {"error": True}, {"Retry-After": "30"})
        return _Resp(200, [_hours(18.5), _hours(12.25)])

    calls = _install_client(monkeypatch, handler)

    async def run():
        first = await weather.load_weather(
            "phoenix", "2026-07-13", "2026-07-19", foresight="live_forecast", live_days=3
        )
        aged = {}
        now = weather.time.time()
        for key, (_stored, ttl, data) in list(weather._WEATHER_CACHE.items()):
            aged[key] = (now - ttl - 90, ttl, data)
        weather._WEATHER_CACHE.clear()
        weather._WEATHER_CACHE.update(aged)
        for key, (stored_at, ttl, data) in aged.items():
            weather._write_disk(key, stored_at, ttl, data)
        mode["fail"] = True
        before = len(calls)
        second = await weather.load_weather(
            "phoenix", "2026-07-13", "2026-07-19", foresight="live_forecast", live_days=3
        )
        return first, second, before

    first, second, before = asyncio.run(run())
    assert first.temp_c[0] == pytest.approx(18.5)
    assert "stale" not in first.weather_desc
    assert second.temp_c[0] == pytest.approx(18.5)
    assert second.sister_temp_c[0] == pytest.approx(12.25)
    assert second.is_live is True
    assert "stale cache" in second.weather_desc
    assert len(calls) == before + 1


def test_disk_cache_survives_memory_reset(monkeypatch):
    def handler(url, params):
        return _Resp(200, [_hours(21.0), _hours(9.0)])

    calls = _install_client(monkeypatch, handler)

    async def run():
        await weather.load_weather("dubai", "2026-07-20", "2026-07-26", foresight="live_forecast", live_days=3)
        weather._WEATHER_CACHE.clear()
        before = len(calls)
        cached = await weather.load_weather(
            "dubai", "2026-07-20", "2026-07-26", foresight="live_forecast", live_days=3
        )
        return cached, before

    cached, before = asyncio.run(run())
    assert len(calls) == before
    assert cached.temp_c[0] == pytest.approx(21.0)
    assert cached.is_live is True
    assert "stale" not in cached.weather_desc


def test_missing_cache_dir_does_not_break_fetch(tmp_path, monkeypatch):
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("file", encoding="utf-8")
    monkeypatch.setattr(weather, "CACHE_DIR", blocker / "thirstcap_weather_cache")

    def handler(url, params):
        return _Resp(200, _hours(14.0))

    _install_client(monkeypatch, handler)

    async def run():
        async with weather.httpx.AsyncClient() as client:
            return await weather._fetch_open_meteo(
                client,
                weather.LIVE_FORECAST_URL,
                24.86,
                67.0,
                "Asia/Karachi",
                forecast_days=3,
            )

    data = asyncio.run(run())
    assert data["hourly"]["temperature_2m"][0] == 14.0


def test_live_forecast_429_falls_back_to_latest_archive(monkeypatch):
    _no_sleep(monkeypatch)

    def handler(url, params):
        return _Resp(429, {"error": True}, {"Retry-After": "30"})

    _install_client(monkeypatch, handler)
    bundle = asyncio.run(
        weather.load_weather("phoenix", "2026-11-19", "2026-11-25", foresight="live_forecast", live_days=7)
    )
    assert bundle.is_live is False
    assert "fallback" in bundle.weather_desc.lower()
    assert "rate-limited" in bundle.weather_desc.lower()
    assert bundle.start == "2026-07-13"
    assert bundle.end == "2026-07-19"
    assert len(bundle.times) == 168
    assert max(bundle.temp_c) > 40


def test_custom_city_429_without_cache_is_503(monkeypatch):
    _no_sleep(monkeypatch)

    def handler(url, params):
        return _Resp(429, {"error": True}, {"Retry-After": "30"})

    _install_client(monkeypatch, handler)
    custom = CustomSiteInput(
        name="Tokyo, Japan",
        country="Japan",
        lat=35.6895,
        lon=139.6917,
        timezone="Asia/Tokyo",
    )
    with pytest.raises(DomainError) as exc:
        asyncio.run(
            weather.load_weather(
                "custom",
                "2026-11-19",
                "2026-11-25",
                foresight="live_forecast",
                custom_site=custom,
            )
        )
    assert exc.value.status_code == 503
    assert exc.value.code == "weather_rate_limited"
    assert exc.value.message == "Weather provider is rate-limiting; please retry in a minute."


def test_live_5xx_does_not_use_archive_fallback(monkeypatch):
    _no_sleep(monkeypatch)
    state = {"n": 0}

    def handler(url, params):
        state["n"] += 1
        return _Resp(500, {"error": True})

    _install_client(monkeypatch, handler)
    with pytest.raises(DomainError) as exc:
        asyncio.run(
            weather.load_weather("phoenix", "2026-11-19", "2026-11-25", foresight="live_forecast", live_days=3)
        )
    assert state["n"] == 3
    assert exc.value.code == "weather_upstream_error"
    assert exc.value.status_code == 502
