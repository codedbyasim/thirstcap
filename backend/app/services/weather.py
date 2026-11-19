"""Open-Meteo weather client, offline benchmark fixtures, geocoding, and Stull wet-bulb calculation."""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import random
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Literal
import httpx

from app.config import DATA_DIR, get_settings
from app.errors import DomainError
from app.schemas import CustomSiteInput, ForesightMode

FIXTURE_DIR = DATA_DIR / "fixtures"

SITE_REGISTRY: dict[str, dict] = {
    "phoenix": {
        "id": "phoenix",
        "name": "Phoenix / Mesa",
        "region": "Arizona, United States",
        "country": "United States",
        "corridor_group": "North America",
        "lat": 33.4484,
        "lon": -112.0740,
        "timezone": "America/Phoenix",
        "grid_ba": "AZPS",
        "sister_id": "des-moines",
        "sister_name": "Des Moines sister",
        "sister_lat": 41.5868,
        "sister_lon": -93.6250,
        "sister_timezone": "America/Phoenix",
        "wri_stress_score": 75,
        "basin_stress_tier": "Extremely High",
        "water_tariff_usd_per_kgal": 6.80,
        "regulatory_framework": "Colorado River Cuts & AZ Groundwater Oversight",
        "default_start": "2026-07-13",
        "default_end": "2026-07-19",
    },
    "northern-virginia": {
        "id": "northern-virginia",
        "name": "Northern Virginia",
        "region": "Loudoun County, United States",
        "country": "United States",
        "corridor_group": "North America",
        "lat": 39.0438,
        "lon": -77.4874,
        "timezone": "America/New_York",
        "grid_ba": "PJM",
        "sister_id": "columbus",
        "sister_name": "Columbus / Ohio sister",
        "sister_lat": 39.9612,
        "sister_lon": -82.9988,
        "sister_timezone": "America/New_York",
        "wri_stress_score": 48,
        "basin_stress_tier": "High (Cluster & Zoning)",
        "water_tariff_usd_per_kgal": 5.90,
        "regulatory_framework": "Loudoun Zoning Water Disclosure & Hookup Fees",
        "default_start": "2026-07-13",
        "default_end": "2026-07-19",
    },
    "des-moines": {
        "id": "des-moines",
        "name": "Des Moines",
        "region": "Iowa, United States",
        "country": "United States",
        "corridor_group": "North America",
        "lat": 41.5868,
        "lon": -93.6250,
        "timezone": "America/Chicago",
        "grid_ba": "MISO",
        "sister_id": "duluth",
        "sister_name": "Duluth sister",
        "sister_lat": 46.7867,
        "sister_lon": -92.1005,
        "sister_timezone": "America/Chicago",
        "wri_stress_score": 45,
        "basin_stress_tier": "High (Summer Peak)",
        "water_tariff_usd_per_kgal": 4.90,
        "regulatory_framework": "Iowa Municipal Peak Water Allocation",
        "default_start": "2026-07-13",
        "default_end": "2026-07-19",
    },
    "queretaro": {
        "id": "queretaro",
        "name": "Querétaro",
        "region": "Central Bajío, Mexico",
        "country": "Mexico",
        "corridor_group": "Latin America",
        "lat": 20.5888,
        "lon": -100.3899,
        "timezone": "America/Mexico_City",
        "grid_ba": None,
        "sister_id": "saltillo",
        "sister_name": "Saltillo / Monterrey sister",
        "sister_lat": 25.4232,
        "sister_lon": -101.0053,
        "sister_timezone": "America/Mexico_City",
        "wri_stress_score": 84,
        "basin_stress_tier": "Extremely High",
        "water_tariff_usd_per_kgal": 5.20,
        "regulatory_framework": "Querétaro Aquifer Deficit & 2027 Disclosure Law",
        "default_start": "2026-05-11",
        "default_end": "2026-05-17",
    },
    "santiago": {
        "id": "santiago",
        "name": "Santiago / Cerrillos",
        "region": "Metropolitan Region, Chile",
        "country": "Chile",
        "corridor_group": "Latin America",
        "lat": -33.4489,
        "lon": -70.6693,
        "timezone": "America/Santiago",
        "grid_ba": None,
        "sister_id": "valdivia",
        "sister_name": "Valdivia South sister",
        "sister_lat": -39.8196,
        "sister_lon": -73.2452,
        "sister_timezone": "America/Santiago",
        "wri_stress_score": 68,
        "basin_stress_tier": "High (Megadrought)",
        "water_tariff_usd_per_kgal": 6.40,
        "regulatory_framework": "Chile SEA Environmental & Dry-Cooling Court Mandate",
        "default_start": "2026-01-19",
        "default_end": "2026-01-25",
    },
    "zaragoza": {
        "id": "zaragoza",
        "name": "Zaragoza / Aragón",
        "region": "Aragón, Spain",
        "country": "Spain",
        "corridor_group": "Europe (EU)",
        "lat": 41.6488,
        "lon": -0.8891,
        "timezone": "Europe/Madrid",
        "grid_ba": None,
        "sister_id": "bilbao",
        "sister_name": "Bilbao Atlantic sister",
        "sister_lat": 43.2630,
        "sister_lon": -2.9350,
        "sister_timezone": "Europe/Madrid",
        "wri_stress_score": 71,
        "basin_stress_tier": "High (EU Drought)",
        "water_tariff_usd_per_kgal": 7.40,
        "regulatory_framework": "EU EED (2024/1364) Mandatory WUE & A–G Rating",
        "default_start": "2026-07-13",
        "default_end": "2026-07-19",
    },
    "hyderabad": {
        "id": "hyderabad",
        "name": "Hyderabad",
        "region": "Telangana, India",
        "country": "India",
        "corridor_group": "South Asia",
        "lat": 17.3850,
        "lon": 78.4867,
        "timezone": "Asia/Kolkata",
        "grid_ba": None,
        "sister_id": "bengaluru",
        "sister_name": "Bengaluru sister",
        "sister_lat": 12.9716,
        "sister_lon": 77.5946,
        "sister_timezone": "Asia/Kolkata",
        "wri_stress_score": 78,
        "basin_stress_tier": "Extremely High",
        "water_tariff_usd_per_kgal": 4.80,
        "regulatory_framework": "Telangana Groundwater Caps & TSE Reuse Mandate",
        "default_start": "2026-05-11",
        "default_end": "2026-05-17",
    },
    "dubai": {
        "id": "dubai",
        "name": "Dubai",
        "region": "Dubai, United Arab Emirates",
        "country": "UAE",
        "corridor_group": "Middle East (MENA)",
        "lat": 25.2048,
        "lon": 55.2708,
        "timezone": "Asia/Dubai",
        "grid_ba": None,
        "sister_id": "frankfurt",
        "sister_name": "Frankfurt Sovereign sister",
        "sister_lat": 50.1109,
        "sister_lon": 8.6821,
        "sister_timezone": "Asia/Dubai",
        "wri_stress_score": 83,
        "basin_stress_tier": "Extremely High (World #1)",
        "water_tariff_usd_per_kgal": 11.50,
        "regulatory_framework": "DEWA Desalination Cost & TSE Cooling Mandate",
        "default_start": "2026-07-20",
        "default_end": "2026-07-26",
    },
    "lahore": {
        "id": "lahore",
        "name": "Lahore",
        "region": "Punjab, Pakistan",
        "country": "Pakistan",
        "corridor_group": "South Asia",
        "lat": 31.5204,
        "lon": 74.3587,
        "timezone": "Asia/Karachi",
        "grid_ba": None,
        "sister_id": "islamabad",
        "sister_name": "Islamabad sister",
        "sister_lat": 33.6844,
        "sister_lon": 73.0479,
        "sister_timezone": "Asia/Karachi",
        "wri_stress_score": 81,
        "basin_stress_tier": "Extremely High",
        "water_tariff_usd_per_kgal": 3.60,
        "regulatory_framework": "Punjab Urban Heat & Aquifer Extraction Stress",
        "default_start": "2026-06-08",
        "default_end": "2026-06-14",
    },
    "karachi": {
        "id": "karachi",
        "name": "Karachi",
        "region": "Sindh, Pakistan",
        "country": "Pakistan",
        "corridor_group": "South Asia",
        "lat": 24.8607,
        "lon": 67.0011,
        "timezone": "Asia/Karachi",
        "grid_ba": None,
        "sister_id": "islamabad",
        "sister_name": "Islamabad sister",
        "sister_lat": 33.6844,
        "sister_lon": 73.0479,
        "sister_timezone": "Asia/Karachi",
        "wri_stress_score": 85,
        "basin_stress_tier": "Extremely High",
        "water_tariff_usd_per_kgal": 3.90,
        "regulatory_framework": "Karachi Coastal Wet-Bulb & Municipal Scarcity",
        "default_start": "2026-05-25",
        "default_end": "2026-05-31",
    },
}

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
LIVE_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

# Live forecasts drift through the day. Archive hours never change, so they live much longer.
LIVE_CACHE_TTL_SEC = 3 * 60 * 60
HISTORICAL_CACHE_TTL_SEC = 24 * 60 * 60
ARCHIVE_CACHE_TTL_SEC = 7 * 24 * 60 * 60
GEOCODE_CACHE_TTL_SEC = 24 * 60 * 60

RETRY_ATTEMPTS = 3
RETRY_BUDGET_SEC = 8.0
RATE_LIMIT_MESSAGE = "Weather provider is rate-limiting; please retry in a minute."

# Shared by workers and reused across process restarts on the same machine.
CACHE_DIR = Path(os.environ.get("THIRSTCAP_WEATHER_CACHE_DIR", "/tmp/thirstcap_weather_cache"))

# stored_at (unix seconds), ttl_sec, payload. Kept past TTL so upstream failures can serve stale data.
_WEATHER_CACHE: dict[tuple, tuple[float, float, dict]] = {}
_KEY_LOCKS: dict[str, asyncio.Lock] = {}
_KEY_LOCKS_GUARD: asyncio.Lock | None = None
_LOCK_LOOP: asyncio.AbstractEventLoop | None = None


@dataclass
class WeatherBundle:
    site_id: str
    site_name: str
    region: str
    timezone: str
    sister_name: str
    grid_ba: str | None
    start: str
    end: str
    times: list[str]
    temp_c: list[float]
    rh_pct: list[float]
    dew_point_c: list[float]
    wet_bulb_c: list[float]
    sister_temp_c: list[float]
    sister_rh_pct: list[float]
    sister_wet_bulb_c: list[float]
    decision_temp_c: list[float]
    decision_wet_bulb_c: list[float]
    decision_sister_temp_c: list[float]
    decision_sister_wet_bulb_c: list[float]
    weather_desc: str
    is_live: bool


def stull_wet_bulb(temp_c: float, rh_pct: float) -> float:
    """Compute wet-bulb temperature (C) using Stull's 2011 empirical approximation."""
    rh = max(1.0, min(100.0, float(rh_pct)))
    t = float(temp_c)
    return (
        t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(t + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )


def _clean_series(values: list[float | None], default_val: float) -> list[float]:
    out: list[float] = []
    last = default_val
    for v in values:
        if v is not None and math.isfinite(float(v)):
            last = float(v)
        out.append(last)
    return out


def _pick_custom_sister(custom: CustomSiteInput) -> tuple[str, float, float]:
    if custom.sister_lat is not None and custom.sister_lon is not None:
        return custom.sister_name or "Custom sister", custom.sister_lat, custom.sister_lon
    lat, lon = custom.lat, custom.lon
    if lon < -50 and lat >= 15:
        return "Duluth Great Lakes sister", 46.7867, -92.1005
    if lon < -30 and lat < 15:
        return "Valdivia South sister", -39.8196, -73.2452
    if -15 <= lon <= 40 and lat >= 35:
        return "Oslo Nordic sister", 59.9139, 10.7522
    if -20 <= lon <= 62 and lat < 35:
        return "Zurich Alpine sister", 47.3769, 8.5417
    if 62 < lon <= 92 and lat >= 5:
        return "Islamabad Foothill sister", 33.6844, 73.0479
    if lon > 92 and lat >= 0:
        return "Sapporo Cool-North sister", 43.0618, 141.3545
    if lon > 92 and lat < 0:
        return "Hobart Tasmania sister", -42.8821, 147.3272
    return "Zurich Alpine sister", 47.3769, 8.5417


def estimate_custom_basin_profile(custom: CustomSiteInput) -> dict:
    """Estimate regional WRI risk tier, industrial tariff, and regulatory mandate for any city worldwide."""
    lat, lon = custom.lat, custom.lon
    country = (custom.country or "").lower()
    name_l = custom.name.lower()

    eu_tokens = (
        "spain", "france", "germany", "netherlands", "ireland", "italy",
        "portugal", "greece", "poland", "sweden", "denmark", "belgium",
    )
    mena_tokens = (
        "emirates", "uae", "saudi", "qatar", "bahrain", "kuwait",
        "oman", "egypt", "jordan", "morocco", "israel",
    )
    south_asia_tokens = ("india", "pakistan", "bangladesh", "sri lanka")
    sea_tokens = ("singapore", "malaysia", "indonesia", "thailand", "vietnam", "philippines")

    if any(k in country or k in name_l for k in mena_tokens) or (15 <= lat <= 35 and 30 <= lon <= 60):
        return {
            "wri_stress_score": 82,
            "basin_stress_tier": "Extremely High",
            "water_tariff_usd_per_kgal": 10.50,
            "regulatory_framework": "MENA Desalination Cost & TSE Industrial Cooling Mandate",
        }
    if any(k in country or k in name_l for k in south_asia_tokens) or (7 <= lat <= 35 and 66 <= lon <= 92):
        return {
            "wri_stress_score": 79,
            "basin_stress_tier": "Extremely High",
            "water_tariff_usd_per_kgal": 4.40,
            "regulatory_framework": "Aquifer Depletion Cap & Recycled TSE Reuse Mandate",
        }
    if any(k in country or k in name_l for k in eu_tokens) or (36 <= lat <= 60 and -10 <= lon <= 30):
        return {
            "wri_stress_score": 56 if lat > 44 else 70,
            "basin_stress_tier": "High (EU EED)" if lat < 45 else "Medium-High (EU EED)",
            "water_tariff_usd_per_kgal": 7.20,
            "regulatory_framework": "EU EED (2024/1364) Mandatory WUE & A–G Disclosure",
        }
    if any(k in country or k in name_l for k in sea_tokens):
        return {
            "wri_stress_score": 62,
            "basin_stress_tier": "High (Coastal Wet-Bulb)",
            "water_tariff_usd_per_kgal": 5.60,
            "regulatory_framework": "ASEAN Data Center Green Water & NEWater/TSE Guidelines",
        }
    if "mexico" in country or "chile" in country or (18 <= lat <= 36 and -120 <= lon <= -98):
        return {
            "wri_stress_score": 76,
            "basin_stress_tier": "Extremely High",
            "water_tariff_usd_per_kgal": 6.20,
            "regulatory_framework": "Basin Extraction Ceiling & Mandatory Peak Disclosure",
        }
    if "united states" in country or "usa" in country:
        return {
            "wri_stress_score": 54,
            "basin_stress_tier": "High (Cluster Peak)",
            "water_tariff_usd_per_kgal": 5.80,
            "regulatory_framework": "Municipal Water Hookup & Peak Capacity Cap",
        }
    return {
        "wri_stress_score": 52,
        "basin_stress_tier": "Regional",
        "water_tariff_usd_per_kgal": 5.60,
        "regulatory_framework": "ISO/IEC 30134-9 Peak Water & Cooling Stewardship",
    }


def _validate_dates(start: str, end: str) -> tuple[date, date]:
    try:
        d0 = datetime.strptime(start, "%Y-%m-%d").date()
        d1 = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError as exc:
        raise DomainError(422, "invalid_date", f"Invalid date format: {start} to {end}.") from exc
    if d1 < d0:
        raise DomainError(422, "invalid_date_range", f"End date {end} precedes start date {start}.")
    days = (d1 - d0).days + 1
    if days > 14:
        raise DomainError(
            422,
            "date_range_too_long",
            f"Requested {days} days; maximum supported window is 14 days.",
            {"days": days},
        )
    return d0, d1


def _load_fixture(city_key: str, start: str, end: str, kind: Literal["archive", "forecast"]) -> dict | None:
    d0 = datetime.strptime(start, "%Y-%m-%d").date()
    d1 = datetime.strptime(end, "%Y-%m-%d").date()
    if (d1 - d0).days != 6:
        return None
    path = FIXTURE_DIR / f"{city_key}__{start}__{kind}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _api_key() -> str:
    env = os.environ.get("OPEN_METEO_API_KEY", "").strip()
    if env:
        return env
    try:
        return (get_settings().open_meteo_api_key or "").strip()
    except Exception:
        return ""


def _canonical_url(url: str) -> str:
    if url.startswith("https://customer-"):
        return "https://" + url[len("https://customer-") :]
    return url


def _resolve_url(url: str) -> str:
    canonical = _canonical_url(url)
    if not _api_key():
        return canonical
    if canonical.startswith("https://"):
        return "https://customer-" + canonical[len("https://") :]
    return canonical


def _ttl_for(url: str) -> float:
    canonical = _canonical_url(url)
    if "archive-api.open-meteo.com" in canonical:
        return ARCHIVE_CACHE_TTL_SEC
    if "historical-forecast-api.open-meteo.com" in canonical:
        return HISTORICAL_CACHE_TTL_SEC
    return LIVE_CACHE_TTL_SEC


def _cache_key_for(
    url: str,
    lat: float,
    lon: float,
    timezone: str,
    start: str | None,
    end: str | None,
    forecast_days: int | None,
) -> tuple:
    return (
        _canonical_url(url),
        round(float(lat), 4),
        round(float(lon), 4),
        timezone,
        start,
        end,
        forecast_days,
    )


def _key_token(key: tuple) -> str:
    blob = json.dumps(key, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _disk_path(key: tuple) -> Path:
    return CACHE_DIR / f"{_key_token(key)}.json"


def _write_disk(key: tuple, stored_at: float, ttl: float, data: dict) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = _disk_path(key)
        tmp = path.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_text(
            json.dumps({"stored_at": stored_at, "ttl_sec": ttl, "data": data}),
            encoding="utf-8",
        )
        os.replace(tmp, path)
    except OSError:
        return


def _read_disk(key: tuple) -> tuple[float, float, dict] | None:
    try:
        raw = json.loads(_disk_path(key).read_text(encoding="utf-8"))
        data = raw["data"]
        if not isinstance(data, dict):
            return None
        return float(raw["stored_at"]), float(raw["ttl_sec"]), data
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


def _best_entry(key: tuple) -> tuple[float, float, dict] | None:
    mem = _WEATHER_CACHE.get(key)
    disk = _read_disk(key)
    if disk is not None and (mem is None or disk[0] > mem[0]):
        _WEATHER_CACHE[key] = disk
        return disk
    return mem


def _is_fresh(entry: tuple[float, float, dict]) -> bool:
    stored_at, ttl, _data = entry
    return (time.time() - stored_at) < ttl


def _store_entry(key: tuple, data: dict, ttl: float) -> None:
    clean = {k: v for k, v in data.items() if k != "_stale"}
    stored_at = time.time()
    _WEATHER_CACHE[key] = (stored_at, ttl, clean)
    _write_disk(key, stored_at, ttl, clean)


def _with_stale_flag(data: dict) -> dict:
    marked = dict(data)
    marked["_stale"] = True
    return marked


def _locks_guard() -> asyncio.Lock:
    global _KEY_LOCKS_GUARD, _LOCK_LOOP
    loop = asyncio.get_running_loop()
    if _KEY_LOCKS_GUARD is None or _LOCK_LOOP is not loop:
        _KEY_LOCKS_GUARD = asyncio.Lock()
        _KEY_LOCKS.clear()
        _LOCK_LOOP = loop
    return _KEY_LOCKS_GUARD


async def _lock_for(token: str) -> asyncio.Lock:
    async with _locks_guard():
        lock = _KEY_LOCKS.get(token)
        if lock is None:
            lock = asyncio.Lock()
            _KEY_LOCKS[token] = lock
        return lock


@asynccontextmanager
async def _acquire_keys(keys: list[tuple]):
    tokens = sorted({_key_token(key) for key in keys})
    locks = [await _lock_for(token) for token in tokens]
    for lock in locks:
        await lock.acquire()
    try:
        yield
    finally:
        for lock in reversed(locks):
            lock.release()


def _parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return max(0.0, float(text))
    except ValueError:
        pass
    try:
        when = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None
    if when is None:
        return None
    return max(0.0, when.timestamp() - time.time())


def _retry_delay(attempt: int, retry_after: float | None, deadline: float) -> float:
    """Exponential backoff plus jitter, capped by the remaining retry budget.

    A Retry-After larger than the time left ends the retry sequence instead of
    hammering the provider early.
    """
    remaining = deadline - time.monotonic()
    if remaining <= 0.05:
        return 0.0
    base = 0.35 * (2 ** attempt)
    delay = base + random.uniform(0.0, base * 0.35)
    if retry_after is not None:
        if retry_after > remaining:
            return 0.0
        delay = max(delay, retry_after)
    return min(delay, remaining)


async def _get_with_retry(client: httpx.AsyncClient, url: str, params: dict) -> httpx.Response:
    deadline = time.monotonic() + RETRY_BUDGET_SEC
    last_resp: httpx.Response | None = None
    last_exc: httpx.TransportError | None = None
    for attempt in range(RETRY_ATTEMPTS):
        remaining = deadline - time.monotonic()
        if attempt > 0 and remaining <= 0.05:
            break
        request_timeout = min(25.0, max(0.2, remaining if remaining > 0 else 0.2))
        try:
            resp = await client.get(url, params=params, timeout=request_timeout)
        except httpx.TransportError as exc:
            last_exc = exc
            last_resp = None
            if attempt >= RETRY_ATTEMPTS - 1:
                break
            delay = _retry_delay(attempt, None, deadline)
            if delay <= 0:
                break
            await asyncio.sleep(delay)
            continue

        if resp.status_code == 429 or resp.status_code >= 500:
            last_resp = resp
            if attempt >= RETRY_ATTEMPTS - 1:
                break
            retry_after = _parse_retry_after(resp.headers.get("Retry-After"))
            delay = _retry_delay(attempt, retry_after, deadline)
            if delay <= 0:
                break
            await asyncio.sleep(delay)
            continue
        return resp

    if last_resp is not None:
        return last_resp
    if last_exc is not None:
        raise last_exc
    raise httpx.TransportError("Open-Meteo request failed without a response.")


def _error_for_status(status: int, lat: float, lon: float) -> DomainError:
    if status == 429:
        return DomainError(503, "weather_rate_limited", RATE_LIMIT_MESSAGE, {"status": 429})
    return DomainError(
        422 if status == 400 else 502,
        "weather_upstream_error",
        f"Open-Meteo returned HTTP {status} for ({lat}, {lon}).",
        {"status": status},
    )


async def _http_fetch_coords(
    client: httpx.AsyncClient,
    url: str,
    coords: list[tuple[float, float]],
    timezone: str,
    start: str | None,
    end: str | None,
    forecast_days: int | None,
) -> list[dict]:
    resolved = _resolve_url(url)
    multi = len(coords) > 1
    params: dict[str, str | float | int] = {
        "latitude": ",".join(f"{lat:.4f}" for lat, _lon in coords) if multi else coords[0][0],
        "longitude": ",".join(f"{lon:.4f}" for _lat, lon in coords) if multi else coords[0][1],
        "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m",
        "timezone": timezone,
    }
    if forecast_days is not None:
        params["forecast_days"] = forecast_days
    else:
        params["start_date"] = start or ""
        params["end_date"] = end or ""
    api_key = _api_key()
    if api_key:
        params["apikey"] = api_key

    resp = await _get_with_retry(client, resolved, params)
    if resp.status_code >= 400:
        raise _error_for_status(resp.status_code, coords[0][0], coords[0][1])
    try:
        body = resp.json()
    except Exception as exc:
        raise DomainError(502, "weather_upstream_error", "Open-Meteo returned a non-JSON body.") from exc

    if not multi:
        if isinstance(body, list):
            if len(body) != 1 or not isinstance(body[0], dict):
                raise DomainError(502, "weather_upstream_error", "Open-Meteo returned an unexpected payload.")
            return [body[0]]
        if not isinstance(body, dict):
            raise DomainError(502, "weather_upstream_error", "Open-Meteo returned an unexpected payload.")
        return [body]
    if not isinstance(body, list) or len(body) != len(coords) or not all(isinstance(item, dict) for item in body):
        raise DomainError(
            502,
            "weather_upstream_error",
            "Open-Meteo returned an unexpected multi-location payload.",
        )
    return list(body)


async def _fetch_locations(
    client: httpx.AsyncClient,
    url: str,
    coords: list[tuple[float, float]],
    timezone: str,
    start: str | None = None,
    end: str | None = None,
    forecast_days: int | None = None,
) -> list[dict]:
    """Fetch one or more coordinates, collapsing a pair into a single Open-Meteo call."""
    if not coords:
        return []
    keys = [
        _cache_key_for(url, lat, lon, timezone, start, end, forecast_days) for lat, lon in coords
    ]
    ttl = _ttl_for(url)

    unique_keys: list[tuple] = []
    unique_coords: list[tuple[float, float]] = []
    positions: list[int] = []
    seen: dict[tuple, int] = {}
    for key, coord in zip(keys, coords):
        if key in seen:
            positions.append(seen[key])
            continue
        seen[key] = len(unique_keys)
        positions.append(seen[key])
        unique_keys.append(key)
        unique_coords.append(coord)

    async with _acquire_keys(unique_keys):
        entries = [_best_entry(key) for key in unique_keys]
        fresh = [entry is not None and _is_fresh(entry) for entry in entries]
        fetched: dict[int, dict] = {}
        failure: DomainError | None = None
        missing = [i for i, ok in enumerate(fresh) if not ok]
        if missing:
            try:
                payloads = await _http_fetch_coords(
                    client,
                    url,
                    [unique_coords[i] for i in missing],
                    timezone,
                    start,
                    end,
                    forecast_days,
                )
            except DomainError as exc:
                failure = exc
            except httpx.TransportError as exc:
                failure = DomainError(
                    502,
                    "weather_upstream_error",
                    f"Unable to reach Open-Meteo weather service: {exc}",
                )
            else:
                for idx, payload in zip(missing, payloads):
                    _store_entry(unique_keys[idx], payload, ttl)
                    fetched[idx] = payload

        out_unique: list[dict] = []
        for i, entry in enumerate(entries):
            if i in fetched:
                out_unique.append(fetched[i])
            elif fresh[i] and entry is not None:
                out_unique.append(entry[2])
            elif entry is not None:
                out_unique.append(_with_stale_flag(entry[2]))
            elif failure is not None:
                raise failure
            else:
                lat, lon = unique_coords[i]
                raise DomainError(
                    502,
                    "weather_upstream_error",
                    f"Open-Meteo returned no weather for ({lat}, {lon}).",
                )
        return [out_unique[pos] for pos in positions]


async def _fetch_open_meteo(
    client: httpx.AsyncClient,
    url: str,
    lat: float,
    lon: float,
    timezone: str,
    start: str | None = None,
    end: str | None = None,
    forecast_days: int | None = None,
) -> dict:
    rows = await _fetch_locations(
        client,
        url,
        [(lat, lon)],
        timezone,
        start=start,
        end=end,
        forecast_days=forecast_days,
    )
    return rows[0]


async def _fetch_primary_and_sister(
    client: httpx.AsyncClient,
    url: str,
    site_meta: dict,
    timezone: str,
    start: str | None = None,
    end: str | None = None,
    forecast_days: int | None = None,
) -> tuple[dict, dict]:
    """Fetch the campus and its sister. Concrete timezones share one HTTP call.

    ``timezone='auto'`` is resolved from the primary response first so the sister
    series stays on the same hour index.
    """
    if timezone == "auto":
        primary = await _fetch_open_meteo(
            client,
            url,
            site_meta["lat"],
            site_meta["lon"],
            "auto",
            start=start,
            end=end,
            forecast_days=forecast_days,
        )
        resolved = primary.get("timezone") or "GMT"
        sister = await _fetch_open_meteo(
            client,
            url,
            site_meta["sister_lat"],
            site_meta["sister_lon"],
            resolved,
            start=start,
            end=end,
            forecast_days=forecast_days,
        )
        return primary, sister
    primary, sister = await _fetch_locations(
        client,
        url,
        [(float(site_meta["lat"]), float(site_meta["lon"])), (float(site_meta["sister_lat"]), float(site_meta["sister_lon"]))],
        timezone,
        start=start,
        end=end,
        forecast_days=forecast_days,
    )
    return primary, sister


def _fit_series(values: list | None, default_val: float, n: int) -> list[float]:
    cleaned = _clean_series(list(values or []), default_val)
    if len(cleaned) >= n:
        return cleaned[:n]
    if not cleaned:
        return [default_val] * n
    return cleaned + [cleaned[-1]] * (n - len(cleaned))


def _stale_note(*payloads: dict) -> str:
    if any(bool(payload.get("_stale")) for payload in payloads):
        return " (stale cache)"
    return ""


def _assemble_bundle(
    site_meta: dict,
    actual_primary: dict,
    actual_sister: dict,
    dec_primary: dict,
    dec_sister: dict,
    weather_desc: str,
    is_live: bool,
) -> WeatherBundle:
    hp = actual_primary.get("hourly", {})
    hs = actual_sister.get("hourly", {})
    dp = dec_primary.get("hourly", {})
    ds = dec_sister.get("hourly", {})

    times: list[str] = list(hp.get("time", []))
    n = len(times)
    if n == 0 or n % 24 != 0:
        raise DomainError(
            422,
            "incomplete_weather",
            f"Weather series for {site_meta['name']} returned {n} hours (expected multiple of 24).",
        )

    temp_c = _fit_series(hp.get("temperature_2m", []), 25.0, n)
    rh_pct = _fit_series(hp.get("relative_humidity_2m", []), 50.0, n)
    dew_c = _fit_series(hp.get("dew_point_2m", []), 15.0, n)
    wb_c = [stull_wet_bulb(t, rh) for t, rh in zip(temp_c, rh_pct)]

    s_temp_c = _fit_series(hs.get("temperature_2m", []), 20.0, n)
    s_rh_pct = _fit_series(hs.get("relative_humidity_2m", []), 55.0, n)
    s_wb_c = [stull_wet_bulb(t, rh) for t, rh in zip(s_temp_c, s_rh_pct)]

    dec_t = _fit_series(dp.get("temperature_2m", []), 25.0, n)
    dec_rh = _fit_series(dp.get("relative_humidity_2m", []), 50.0, n)
    dec_wb = [stull_wet_bulb(t, rh) for t, rh in zip(dec_t, dec_rh)]

    dec_st = _fit_series(ds.get("temperature_2m", []), 20.0, n)
    dec_srh = _fit_series(ds.get("relative_humidity_2m", []), 55.0, n)
    dec_swb = [stull_wet_bulb(t, rh) for t, rh in zip(dec_st, dec_srh)]

    resolved_start = times[0][:10]
    resolved_end = times[-1][:10]
    resolved_tz = actual_primary.get("timezone", site_meta["timezone"])
    description = weather_desc + _stale_note(actual_primary, actual_sister, dec_primary, dec_sister)

    return WeatherBundle(
        site_id=site_meta["id"],
        site_name=site_meta["name"],
        region=site_meta["region"],
        timezone=resolved_tz,
        sister_name=site_meta["sister_name"],
        grid_ba=site_meta["grid_ba"],
        start=resolved_start,
        end=resolved_end,
        times=times,
        temp_c=temp_c,
        rh_pct=rh_pct,
        dew_point_c=dew_c,
        wet_bulb_c=wb_c,
        sister_temp_c=s_temp_c,
        sister_rh_pct=s_rh_pct,
        sister_wet_bulb_c=s_wb_c,
        decision_temp_c=dec_t,
        decision_wet_bulb_c=dec_wb,
        decision_sister_temp_c=dec_st,
        decision_sister_wet_bulb_c=dec_swb,
        weather_desc=description,
        is_live=is_live,
    )


def _latest_archive_pair(site_meta: dict) -> tuple[dict, dict] | None:
    site_id = site_meta.get("id")
    sister_id = site_meta.get("sister_id")
    if not site_id or site_id == "custom" or not sister_id or not FIXTURE_DIR.exists():
        return None
    primary: dict[str, Path] = {}
    sister: dict[str, Path] = {}
    for path in FIXTURE_DIR.glob("*__*__archive.json"):
        parts = path.name.split("__")
        if len(parts) != 3:
            continue
        city, start, _kind = parts
        if city == site_id:
            primary[start] = path
        elif city == sister_id:
            sister[start] = path
    if not primary or not sister:
        return None
    shared = sorted(set(primary) & set(sister))
    primary_path = primary[shared[-1]] if shared else primary[sorted(primary)[-1]]
    sister_path = sister[shared[-1]] if shared else sister[sorted(sister)[-1]]
    try:
        return (
            json.loads(primary_path.read_text(encoding="utf-8")),
            json.loads(sister_path.read_text(encoding="utf-8")),
        )
    except (OSError, json.JSONDecodeError):
        return None


def _bundle_from_latest_archive(site_meta: dict) -> WeatherBundle | None:
    pair = _latest_archive_pair(site_meta)
    if pair is None:
        return None
    primary, sister = pair
    times = list((primary.get("hourly") or {}).get("time") or [])
    window = ""
    if times:
        window = f" ({times[0][:10]} to {times[-1][:10]})"
    return _assemble_bundle(
        site_meta,
        primary,
        sister,
        primary,
        sister,
        f"Bundled archive fallback{window}; Open-Meteo rate-limited, not a live forecast",
        False,
    )


async def _fetch_missing_pair(
    client: httpx.AsyncClient,
    url: str,
    site_meta: dict,
    timezone: str,
    primary: dict | None,
    sister: dict | None,
    start: str,
    end: str,
) -> tuple[dict, dict, str]:
    resolved_tz = timezone
    if primary is None and sister is None:
        primary, sister = await _fetch_primary_and_sister(
            client, url, site_meta, resolved_tz, start=start, end=end
        )
        resolved_tz = primary.get("timezone", resolved_tz)
        return primary, sister, resolved_tz
    if primary is None:
        primary = await _fetch_open_meteo(
            client,
            url,
            site_meta["lat"],
            site_meta["lon"],
            resolved_tz,
            start=start,
            end=end,
        )
    resolved_tz = primary.get("timezone", resolved_tz)
    if sister is None:
        sister = await _fetch_open_meteo(
            client,
            url,
            site_meta["sister_lat"],
            site_meta["sister_lon"],
            resolved_tz,
            start=start,
            end=end,
        )
    return primary, sister, resolved_tz


async def load_weather(
    site_id: str,
    start: str,
    end: str,
    foresight: ForesightMode = "perfect",
    custom_site: CustomSiteInput | None = None,
    live_days: int = 7,
) -> WeatherBundle:
    if site_id == "custom":
        if custom_site is None:
            raise DomainError(422, "missing_custom_site", "custom_site payload is required for site_id='custom'.")
        sister_name, s_lat, s_lon = _pick_custom_sister(custom_site)
        site_meta = {
            "id": "custom",
            "name": custom_site.name,
            "region": custom_site.country or "Global Custom Coordinates",
            "lat": custom_site.lat,
            "lon": custom_site.lon,
            "timezone": custom_site.timezone or "auto",
            "grid_ba": None,
            "sister_id": None,
            "sister_name": sister_name,
            "sister_lat": s_lat,
            "sister_lon": s_lon,
        }
    else:
        if site_id not in SITE_REGISTRY:
            raise DomainError(
                404,
                "unknown_site",
                f"Unknown site_id '{site_id}'. Valid sites: {', '.join(SITE_REGISTRY.keys())} or 'custom'.",
                {"site_id": site_id},
            )
        site_meta = SITE_REGISTRY[site_id]

    is_live = foresight == "live_forecast"
    if not is_live:
        _validate_dates(start, end)

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            if is_live:
                days_to_fetch = max(3, min(7, int(live_days)))
                actual_primary, actual_sister = await _fetch_primary_and_sister(
                    client,
                    LIVE_FORECAST_URL,
                    site_meta,
                    site_meta["timezone"],
                    forecast_days=days_to_fetch,
                )
                dec_primary = actual_primary
                dec_sister = actual_sister
                weather_desc = f"Open-Meteo Live {days_to_fetch}-Day Forecast (T_db, RH%, Stull T_wb)"
            else:
                actual_primary = (
                    _load_fixture(site_meta["id"], start, end, "archive") if site_meta["id"] != "custom" else None
                )
                actual_sister = (
                    _load_fixture(site_meta["sister_id"], start, end, "archive")
                    if site_meta.get("sister_id")
                    else None
                )
                actual_primary, actual_sister, resolved_tz = await _fetch_missing_pair(
                    client,
                    ARCHIVE_URL,
                    site_meta,
                    site_meta["timezone"],
                    actual_primary,
                    actual_sister,
                    start,
                    end,
                )

                if foresight == "historical_forecast":
                    dec_primary = (
                        _load_fixture(site_meta["id"], start, end, "forecast") if site_meta["id"] != "custom" else None
                    )
                    dec_sister = (
                        _load_fixture(site_meta["sister_id"], start, end, "forecast")
                        if site_meta.get("sister_id")
                        else None
                    )
                    dec_primary, dec_sister, _resolved_tz = await _fetch_missing_pair(
                        client,
                        HISTORICAL_FORECAST_URL,
                        site_meta,
                        resolved_tz,
                        dec_primary,
                        dec_sister,
                        start,
                        end,
                    )
                    weather_desc = "Open-Meteo Historical Forecast (decisions) scored on Archive Actuals"
                else:
                    dec_primary = actual_primary
                    dec_sister = actual_sister
                    weather_desc = "Open-Meteo Archive Actuals (temperature_2m, relative_humidity_2m, dew_point_2m)"
    except DomainError as exc:
        if is_live and exc.code == "weather_rate_limited":
            fallback = _bundle_from_latest_archive(site_meta)
            if fallback is not None:
                return fallback
            raise DomainError(503, "weather_rate_limited", RATE_LIMIT_MESSAGE, exc.details) from exc
        raise

    return _assemble_bundle(
        site_meta,
        actual_primary,
        actual_sister,
        dec_primary,
        dec_sister,
        weather_desc,
        is_live,
    )


def _geocode_results(data: dict) -> list[dict]:
    results = []
    for item in data.get("results") or []:
        results.append(
            {
                "name": item.get("name", ""),
                "country": item.get("country", ""),
                "admin1": item.get("admin1", ""),
                "lat": float(item["latitude"]),
                "lon": float(item["longitude"]),
                "timezone": item.get("timezone", "auto"),
            }
        )
    return results


async def geocode_city(query: str) -> list[dict]:
    normalized = query.strip()
    key = ("geocode", _canonical_url(GEOCODE_URL), normalized.casefold())
    async with _acquire_keys([key]):
        entry = _best_entry(key)
        if entry is not None and _is_fresh(entry):
            return list(entry[2].get("results") or [])

        params: dict[str, str | float | int] = {
            "name": normalized,
            "count": 6,
            "language": "en",
            "format": "json",
        }
        api_key = _api_key()
        if api_key:
            params["apikey"] = api_key
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await _get_with_retry(client, _resolve_url(GEOCODE_URL), params)
        except httpx.TransportError as exc:
            if entry is not None:
                return list(entry[2].get("results") or [])
            raise DomainError(502, "geocode_error", f"Open-Meteo geocoding failed: {exc}") from exc

        if resp.status_code >= 400:
            if entry is not None:
                return list(entry[2].get("results") or [])
            if resp.status_code == 429:
                raise DomainError(503, "weather_rate_limited", RATE_LIMIT_MESSAGE, {"status": 429})
            raise DomainError(502, "geocode_error", f"Open-Meteo geocoding failed: HTTP {resp.status_code}")

        try:
            data = resp.json()
        except Exception as exc:
            raise DomainError(502, "geocode_error", f"Open-Meteo geocoding failed: {exc}") from exc
        results = _geocode_results(data if isinstance(data, dict) else {})
        _store_entry(key, {"results": results}, GEOCODE_CACHE_TTL_SEC)
        return results


async def warm_live_forecasts(delay_sec: float = 0.6) -> None:
    """Prefetch live forecasts for every registry site. Failures are ignored."""
    site_ids = list(SITE_REGISTRY)
    for index, site_id in enumerate(site_ids):
        meta = SITE_REGISTRY[site_id]
        try:
            await load_weather(
                site_id,
                meta["default_start"],
                meta["default_end"],
                foresight="live_forecast",
                live_days=7,
            )
        except Exception:
            pass
        if index < len(site_ids) - 1 and delay_sec > 0:
            await asyncio.sleep(delay_sec)
