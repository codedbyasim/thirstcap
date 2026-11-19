"""Record real Open-Meteo Archive and Historical Forecast weather fixtures.

Fetches hourly temperature_2m, relative_humidity_2m, and dew_point_2m for all
8 benchmark heat weeks (primary and sister sites) into backend/data/fixtures/
so pytest runs completely offline and benchmark plans load without network lag.
"""

from __future__ import annotations

import json
from pathlib import Path
import time
import httpx

BASE_DIR = Path(__file__).resolve().parents[1]
FIXTURE_DIR = BASE_DIR / "data" / "fixtures"

LOCATIONS = {
    "des-moines": {"lat": 41.5868, "lon": -93.6250, "timezone": "America/Chicago"},
    "duluth": {"lat": 46.7867, "lon": -92.1005, "timezone": "America/Chicago"},
    "phoenix": {"lat": 33.4484, "lon": -112.0740, "timezone": "America/Phoenix"},
    "lahore": {"lat": 31.5204, "lon": 74.3587, "timezone": "Asia/Karachi"},
    "islamabad": {"lat": 33.6844, "lon": 73.0479, "timezone": "Asia/Karachi"},
    "karachi": {"lat": 24.8607, "lon": 67.0011, "timezone": "Asia/Karachi"},
    "northern-virginia": {"lat": 39.0438, "lon": -77.4874, "timezone": "America/New_York"},
    "columbus": {"lat": 39.9612, "lon": -82.9988, "timezone": "America/New_York"},
    "queretaro": {"lat": 20.5888, "lon": -100.3899, "timezone": "America/Mexico_City"},
    "saltillo": {"lat": 25.4232, "lon": -101.0053, "timezone": "America/Mexico_City"},
    "santiago": {"lat": -33.4489, "lon": -70.6693, "timezone": "America/Santiago"},
    "valdivia": {"lat": -39.8196, "lon": -73.2452, "timezone": "America/Santiago"},
    "zaragoza": {"lat": 41.6488, "lon": -0.8891, "timezone": "Europe/Madrid"},
    "bilbao": {"lat": 43.2630, "lon": -2.9350, "timezone": "Europe/Madrid"},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867, "timezone": "Asia/Kolkata"},
    "bengaluru": {"lat": 12.9716, "lon": 77.5946, "timezone": "Asia/Kolkata"},
    "dubai": {"lat": 25.2048, "lon": 55.2708, "timezone": "Asia/Dubai"},
    "frankfurt": {"lat": 50.1109, "lon": 8.6821, "timezone": "Asia/Dubai"},
}

SERIES = [
    ("des-moines", "2025-07-08", "2025-07-14", "America/Chicago"),
    ("duluth", "2025-07-08", "2025-07-14", "America/Chicago"),
    ("des-moines", "2025-07-21", "2025-07-27", "America/Chicago"),
    ("duluth", "2025-07-21", "2025-07-27", "America/Chicago"),
    ("phoenix", "2025-07-07", "2025-07-13", "America/Phoenix"),
    ("des-moines", "2025-07-07", "2025-07-13", "America/Phoenix"),
    ("phoenix", "2025-06-15", "2025-06-21", "America/Phoenix"),
    ("des-moines", "2025-06-15", "2025-06-21", "America/Phoenix"),
    ("lahore", "2025-06-08", "2025-06-14", "Asia/Karachi"),
    ("islamabad", "2025-06-08", "2025-06-14", "Asia/Karachi"),
    ("lahore", "2025-05-18", "2025-05-24", "Asia/Karachi"),
    ("islamabad", "2025-05-18", "2025-05-24", "Asia/Karachi"),
    ("karachi", "2025-05-26", "2025-06-01", "Asia/Karachi"),
    ("islamabad", "2025-05-26", "2025-06-01", "Asia/Karachi"),
    ("karachi", "2025-06-14", "2025-06-20", "Asia/Karachi"),
    ("islamabad", "2025-06-14", "2025-06-20", "Asia/Karachi"),
    ("northern-virginia", "2025-07-21", "2025-07-27", "America/New_York"),
    ("columbus", "2025-07-21", "2025-07-27", "America/New_York"),
    ("queretaro", "2025-05-12", "2025-05-18", "America/Mexico_City"),
    ("saltillo", "2025-05-12", "2025-05-18", "America/Mexico_City"),
    ("santiago", "2025-01-20", "2025-01-26", "America/Santiago"),
    ("valdivia", "2025-01-20", "2025-01-26", "America/Santiago"),
    ("zaragoza", "2025-07-14", "2025-07-20", "Europe/Madrid"),
    ("bilbao", "2025-07-14", "2025-07-20", "Europe/Madrid"),
    ("hyderabad", "2025-05-05", "2025-05-11", "Asia/Kolkata"),
    ("bengaluru", "2025-05-05", "2025-05-11", "Asia/Kolkata"),
    ("dubai", "2025-07-28", "2025-08-03", "Asia/Dubai"),
    ("frankfurt", "2025-07-28", "2025-08-03", "Asia/Dubai"),
    # 2026 Peak Summer Real Archive Benchmarks (10 global corridors + sisters)
    ("phoenix", "2026-07-13", "2026-07-19", "America/Phoenix"),
    ("des-moines", "2026-07-13", "2026-07-19", "America/Phoenix"),
    ("northern-virginia", "2026-07-13", "2026-07-19", "America/New_York"),
    ("columbus", "2026-07-13", "2026-07-19", "America/New_York"),
    ("des-moines", "2026-07-13", "2026-07-19", "America/Chicago"),
    ("duluth", "2026-07-13", "2026-07-19", "America/Chicago"),
    ("queretaro", "2026-05-11", "2026-05-17", "America/Mexico_City"),
    ("saltillo", "2026-05-11", "2026-05-17", "America/Mexico_City"),
    ("santiago", "2026-01-19", "2026-01-25", "America/Santiago"),
    ("valdivia", "2026-01-19", "2026-01-25", "America/Santiago"),
    ("zaragoza", "2026-07-13", "2026-07-19", "Europe/Madrid"),
    ("bilbao", "2026-07-13", "2026-07-19", "Europe/Madrid"),
    ("hyderabad", "2026-05-11", "2026-05-17", "Asia/Kolkata"),
    ("bengaluru", "2026-05-11", "2026-05-17", "Asia/Kolkata"),
    ("dubai", "2026-07-20", "2026-07-26", "Asia/Dubai"),
    ("frankfurt", "2026-07-20", "2026-07-26", "Asia/Dubai"),
    ("lahore", "2026-06-08", "2026-06-14", "Asia/Karachi"),
    ("islamabad", "2026-06-08", "2026-06-14", "Asia/Karachi"),
    ("karachi", "2026-05-25", "2026-05-31", "Asia/Karachi"),
    ("islamabad", "2026-05-25", "2026-05-31", "Asia/Karachi"),
]

ENDPOINTS = {
    "archive": "https://archive-api.open-meteo.com/v1/archive",
    "forecast": "https://historical-forecast-api.open-meteo.com/v1/forecast",
}


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30.0) as client:
        for city, start, end, tz in SERIES:
            loc = LOCATIONS[city]
            for kind, url in ENDPOINTS.items():
                if start.startswith("2026") and kind == "forecast":
                    continue
                fname = f"{city}__{start}__{kind}.json"
                dest = FIXTURE_DIR / fname
                if dest.exists() and dest.stat().st_size > 1000:
                    data = json.loads(dest.read_text(encoding="utf-8"))
                    if len(data.get("hourly", {}).get("time", [])) == 168:
                        print(f"[fixtures] Cached {fname} (168h)")
                        continue
                params = {
                    "latitude": loc["lat"],
                    "longitude": loc["lon"],
                    "start_date": start,
                    "end_date": end,
                    "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m",
                    "timezone": tz,
                }
                resp = client.get(url, params=params)
                resp.raise_for_status()
                payload = resp.json()
                hours = payload.get("hourly", {}).get("time", [])
                temps = payload.get("hourly", {}).get("temperature_2m", [])
                if len(hours) != 168:
                    raise RuntimeError(f"{fname} returned {len(hours)} hours, expected 168")
                dest.write_text(json.dumps(payload), encoding="utf-8")
                print(
                    f"[fixtures] Saved {fname}: 168h, min={min(temps):.1f}C, max={max(temps):.1f}C"
                )
                time.sleep(0.12)

    dsm = json.loads((FIXTURE_DIR / "des-moines__2025-07-08__archive.json").read_text(encoding="utf-8"))
    dsm_max = max(dsm["hourly"]["temperature_2m"])
    print(f"[fixtures] Verified Des Moines 2025-07-08 archive: {len(dsm['hourly']['time'])}h, max={dsm_max:.1f}C")


if __name__ == "__main__":
    main()
