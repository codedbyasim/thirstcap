"""Ingest official 2025 EIA-930 hourly balancing authority demand for MISO and AZPS.

Queries the official US EIA Open Data v2 API (rto/region-data, Form EIA-930)
for 2025 hourly Demand (type=D, UTC periods), converts timestamps to each
balancing authority's local civil timezone (America/Chicago for MISO,
America/Phoenix for AZPS) matching Open-Meteo, and exports compact JSON files
under backend/data/eia930/.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import httpx
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = BASE_DIR / "data" / "eia930"

EIA_API_URL = "https://api.eia.gov/v2/electricity/rto/region-data/data/"

TARGET_BAS = {
    "MISO": {"site_id": "des-moines", "timezone": "America/Chicago", "name": "Midcontinent ISO (MISO)"},
    "AZPS": {"site_id": "phoenix", "timezone": "America/Phoenix", "name": "Arizona Public Service (AZPS)"},
    "PJM": {"site_id": "northern-virginia", "timezone": "America/New_York", "name": "PJM Interconnection (PJM)"},
}


def fetch_ba_2025(client: httpx.Client, ba: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        params = {
            "api_key": "DEMO_KEY",
            "frequency": "hourly",
            "data[0]": "value",
            "facets[respondent][]": ba,
            "facets[type][]": "D",
            "start": "2025-01-01T00",
            "end": "2026-01-01T12",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "length": 5000,
            "offset": offset,
        }
        resp = client.get(EIA_API_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()
        batch = payload.get("response", {}).get("data", [])
        total = int(payload.get("response", {}).get("total", 0))
        rows.extend(batch)
        print(f"[eia930] {ba}: fetched {len(rows)}/{total} rows")
        if len(rows) >= total or not batch:
            break
        offset += len(batch)
    return rows


def build_and_export(ba: str, raw_rows: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = TARGET_BAS[ba]
    tz = ZoneInfo(meta["timezone"])

    records: list[dict] = []
    for row in raw_rows:
        period = row.get("period")
        val = row.get("value")
        if not period or val is None:
            continue
        try:
            mw = float(val)
        except (TypeError, ValueError):
            continue
        dt_utc = datetime.strptime(period, "%Y-%m-%dT%H").replace(tzinfo=timezone.utc)
        dt_local = dt_utc.astimezone(tz)
        if dt_local.year != 2025:
            continue
        records.append(
            {
                "hour_iso": dt_local.strftime("%Y-%m-%dT%H:00"),
                "demand_mw": mw,
                "weekday": dt_local.weekday(),
                "hour_of_day": dt_local.hour,
                "month": dt_local.month,
            }
        )

    df = (
        pd.DataFrame(records)
        .groupby("hour_iso", as_index=False)
        .agg({"demand_mw": "mean", "weekday": "first", "hour_of_day": "first", "month": "first"})
        .sort_values("hour_iso")
        .reset_index(drop=True)
    )
    df["demand_mw"] = df["demand_mw"].interpolate(method="linear", limit=6)

    hourly = {row["hour_iso"]: round(float(row["demand_mw"]), 1) for _, row in df.iterrows()}

    summer = df[df["month"].isin([6, 7, 8])].copy()
    summer["how"] = summer["weekday"].astype(int) * 24 + summer["hour_of_day"].astype(int)
    profile_series = summer.groupby("how")["demand_mw"].mean().reindex(range(168)).ffill().bfill()
    summer_weekly_mw = [round(float(v), 1) for v in profile_series.tolist()]

    payload = {
        "ba": ba,
        "name": meta["name"],
        "site_id": meta["site_id"],
        "timezone": meta["timezone"],
        "source": "US EIA Open Data API v2 (Form EIA-930 rto/region-data, 2025 hourly demand)",
        "record_count": len(hourly),
        "date_range": [min(hourly.keys()), max(hourly.keys())],
        "summer_mean_mw": round(float(summer["demand_mw"].mean()), 1),
        "summer_peak_mw": round(float(summer["demand_mw"].max()), 1),
        "summer_weekly_mw": summer_weekly_mw,
        "hourly": hourly,
    }
    out_path = OUT_DIR / f"{ba}_2025.json"
    out_path.write_text(json.dumps(payload), encoding="utf-8")
    print(
        f"[eia930] Wrote {out_path} ({len(hourly)} hours, "
        f"summer mean {payload['summer_mean_mw']} MW, peak {payload['summer_peak_mw']} MW)"
    )

    check_weeks = {
        "MISO": ["2025-07-08", "2025-07-21"],
        "AZPS": ["2025-07-07", "2025-06-15"],
        "PJM": ["2025-07-21"],
    }[ba]
    for start in check_weeks:
        days = pd.date_range(start, periods=7, freq="D")
        keys = [f"{d.strftime('%Y-%m-%d')}T{h:02d}:00" for d in days for h in range(24)]
        present = sum(1 for k in keys if k in hourly)
        vals = [hourly[k] for k in keys if k in hourly]
        peak_idx = vals.index(max(vals))
        print(
            f"[eia930]   verify {ba} week {start}: {present}/168h, peak={max(vals):.0f} MW at {keys[peak_idx]}"
        )
        if present < 168:
            raise RuntimeError(f"Missing EIA-930 hours for {ba} week {start}: {present}/168")


def main() -> None:
    with httpx.Client(timeout=45.0) as client:
        for ba in TARGET_BAS:
            out_path = OUT_DIR / f"{ba}_2025.json"
            if out_path.exists() and out_path.stat().st_size > 50_000:
                print(f"[eia930] Cached {out_path.name} ({out_path.stat().st_size:,} bytes)")
                continue
            raw_rows = fetch_ba_2025(client, ba)
            build_and_export(ba, raw_rows)


if __name__ == "__main__":
    main()
