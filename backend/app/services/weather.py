"""Open-Meteo weather client, offline benchmark fixtures, geocoding, and Stull wet-bulb calculation."""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Literal
import httpx

from app.config import DATA_DIR
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

# In-memory TTL cache (ephemeral-filesystem friendly on Render)
_WEATHER_CACHE: dict[tuple, tuple[float, dict]] = {}
_CACHE_TTL_SEC = 1800.0


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
    cache_key = (url, round(lat, 4), round(lon, 4), timezone, start, end, forecast_days)
    now = time.monotonic()
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    params: dict[str, str | float | int] = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m",
        "timezone": timezone,
    }
    if forecast_days is not None:
        params["forecast_days"] = forecast_days
    else:
        params["start_date"] = start or ""
        params["end_date"] = end or ""

    try:
        resp = await client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise DomainError(
            502,
            "weather_upstream_error",
            f"Unable to reach Open-Meteo weather service: {exc}",
        ) from exc

    if resp.status_code >= 400:
        raise DomainError(
            422 if resp.status_code == 400 else 502,
            "weather_upstream_error",
            f"Open-Meteo returned HTTP {resp.status_code} for ({lat}, {lon}).",
            {"status": resp.status_code},
        )
    data = resp.json()
    _WEATHER_CACHE[cache_key] = (now, data)
    return data


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

    async with httpx.AsyncClient(timeout=25.0) as client:
        if is_live:
            days_to_fetch = max(3, min(7, int(live_days)))
            actual_primary = await _fetch_open_meteo(
                client,
                LIVE_FORECAST_URL,
                site_meta["lat"],
                site_meta["lon"],
                site_meta["timezone"],
                forecast_days=days_to_fetch,
            )
            resolved_tz = actual_primary.get("timezone", site_meta["timezone"])
            actual_sister = await _fetch_open_meteo(
                client,
                LIVE_FORECAST_URL,
                site_meta["sister_lat"],
                site_meta["sister_lon"],
                resolved_tz,
                forecast_days=days_to_fetch,
            )
            dec_primary = actual_primary
            dec_sister = actual_sister
            weather_desc = f"Open-Meteo Live {days_to_fetch}-Day Forecast (T_db, RH%, Stull T_wb)"
        else:
            # Actual archive temperatures (used for scoring in all historical modes)
            actual_primary = (
                _load_fixture(site_meta["id"], start, end, "archive") if site_meta["id"] != "custom" else None
            )
            actual_sister = (
                _load_fixture(site_meta["sister_id"], start, end, "archive")
                if site_meta.get("sister_id")
                else None
            )
            if actual_primary is None:
                actual_primary = await _fetch_open_meteo(
                    client,
                    ARCHIVE_URL,
                    site_meta["lat"],
                    site_meta["lon"],
                    site_meta["timezone"],
                    start=start,
                    end=end,
                )
            resolved_tz = actual_primary.get("timezone", site_meta["timezone"])
            if actual_sister is None:
                actual_sister = await _fetch_open_meteo(
                    client,
                    ARCHIVE_URL,
                    site_meta["sister_lat"],
                    site_meta["sister_lon"],
                    resolved_tz,
                    start=start,
                    end=end,
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
                if dec_primary is None:
                    dec_primary = await _fetch_open_meteo(
                        client,
                        HISTORICAL_FORECAST_URL,
                        site_meta["lat"],
                        site_meta["lon"],
                        resolved_tz,
                        start=start,
                        end=end,
                    )
                if dec_sister is None:
                    dec_sister = await _fetch_open_meteo(
                        client,
                        HISTORICAL_FORECAST_URL,
                        site_meta["sister_lat"],
                        site_meta["sister_lon"],
                        resolved_tz,
                        start=start,
                        end=end,
                    )
                weather_desc = "Open-Meteo Historical Forecast (decisions) scored on Archive Actuals"
            else:
                dec_primary = actual_primary
                dec_sister = actual_sister
                weather_desc = "Open-Meteo Archive Actuals (temperature_2m, relative_humidity_2m, dew_point_2m)"

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

    temp_c = _clean_series(hp.get("temperature_2m", []), 25.0)[:n]
    rh_pct = _clean_series(hp.get("relative_humidity_2m", []), 50.0)[:n]
    dew_c = _clean_series(hp.get("dew_point_2m", []), 15.0)[:n]
    wb_c = [stull_wet_bulb(t, rh) for t, rh in zip(temp_c, rh_pct)]

    s_temp_c = _clean_series(hs.get("temperature_2m", []), 20.0)[:n]
    s_rh_pct = _clean_series(hs.get("relative_humidity_2m", []), 55.0)[:n]
    s_wb_c = [stull_wet_bulb(t, rh) for t, rh in zip(s_temp_c, s_rh_pct)]

    dec_t = _clean_series(dp.get("temperature_2m", []), 25.0)[:n]
    dec_rh = _clean_series(dp.get("relative_humidity_2m", []), 50.0)[:n]
    dec_wb = [stull_wet_bulb(t, rh) for t, rh in zip(dec_t, dec_rh)]

    dec_st = _clean_series(ds.get("temperature_2m", []), 20.0)[:n]
    dec_srh = _clean_series(ds.get("relative_humidity_2m", []), 55.0)[:n]
    dec_swb = [stull_wet_bulb(t, rh) for t, rh in zip(dec_st, dec_srh)]

    resolved_start = times[0][:10]
    resolved_end = times[-1][:10]
    resolved_tz = actual_primary.get("timezone", site_meta["timezone"])

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
        weather_desc=weather_desc,
        is_live=is_live,
    )


async def geocode_city(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                GEOCODE_URL,
                params={"name": query, "count": 6, "language": "en", "format": "json"},
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise DomainError(502, "geocode_error", f"Open-Meteo geocoding failed: {exc}") from exc
        data = resp.json()
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
