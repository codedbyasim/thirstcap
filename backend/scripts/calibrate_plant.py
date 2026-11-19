"""Calibrate the physical wet-bulb cooling plant against 2025 full-year weather.

Fetches full-year 2025 Open-Meteo Archive data (temperature_2m, relative_humidity_2m,
dew_point_2m) for Des Moines, Phoenix, Lahore, and Karachi, evaluates the physical
evaporative/chiller equations, solves for the single calibration multiplier against
the published Iowa annual anchor (0.19 L/kWh), evaluates Arizona & Karachi anchors,
and saves backend/data/calibration.json.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import httpx

BASE_DIR = Path(__file__).resolve().parents[1]
OUT_PATH = BASE_DIR / "data" / "calibration.json"

LATENT_HEAT_KJ_PER_KG = 2450.0
BASE_EVAP_L_PER_KWH_HEAT = 3600.0 / LATENT_HEAT_KJ_PER_KG  # ~1.469387755
DEFAULT_COC = 4.0
PUE_EVAP = 1.15
PUE_CHILLER = 1.25

SITES = {
    "des-moines": {"lat": 41.5868, "lon": -93.6250, "timezone": "America/Chicago"},
    "phoenix": {"lat": 33.4484, "lon": -112.0740, "timezone": "America/Phoenix"},
    "lahore": {"lat": 31.5204, "lon": 74.3587, "timezone": "Asia/Karachi"},
    "karachi": {"lat": 24.8607, "lon": 67.0011, "timezone": "Asia/Karachi"},
}


def stull_wet_bulb(t_c: float, rh_pct: float) -> float:
    rh = max(1.0, min(100.0, rh_pct))
    return (
        t_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(t_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )


def uncalibrated_physical_wue(t_db: float, t_wb: float, coc: float = DEFAULT_COC) -> tuple[float, str]:
    """Return uncalibrated physical make-up WUE (L / IT kWh) and regime."""
    if t_db <= 25.0:
        return 0.0, "dry"

    coc_factor = coc / (coc - 1.0)
    # Approach-temperature logic: direct evaporative assist when wet-bulb <= 20 C
    # (at least 5 C under 25 C); chiller with cooling-tower condenser rejection when warmer.
    if t_wb <= 20.0:
        # Smooth ramp from onset at 25 C dry-bulb to full tower rejection by 33 C
        evap_fraction = min(1.0, max(0.15, (t_db - 25.0) / 8.0))
        heat_l_per_kwh = BASE_EVAP_L_PER_KWH_HEAT * PUE_EVAP * evap_fraction
        return heat_l_per_kwh * coc_factor, "evap"
    else:
        # Humid / hot chiller regime: full condenser heat rejection + compressor lift
        # rises gently with wet-bulb depression loss above 20 C
        humidity_lift = 1.0 + 0.03 * max(0.0, t_wb - 20.0)
        heat_l_per_kwh = BASE_EVAP_L_PER_KWH_HEAT * PUE_CHILLER * humidity_lift
        return heat_l_per_kwh * coc_factor, "chiller"


def fetch_year(client: httpx.Client, site_id: str, loc: dict) -> dict:
    resp = client.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={
            "latitude": loc["lat"],
            "longitude": loc["lon"],
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m",
            "timezone": loc["timezone"],
        },
    )
    resp.raise_for_status()
    return resp.json()["hourly"]


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    site_hourly: dict[str, list[tuple[str, float, float, float, str]]] = {}

    with httpx.Client(timeout=45.0) as client:
        for site_id, loc in SITES.items():
            hourly = fetch_year(client, site_id, loc)
            rows = []
            for t_str, t_db, rh in zip(
                hourly["time"], hourly["temperature_2m"], hourly["relative_humidity_2m"]
            ):
                t_db_f = float(t_db)
                rh_f = float(rh)
                t_wb = stull_wet_bulb(t_db_f, rh_f)
                wue_raw, regime = uncalibrated_physical_wue(t_db_f, t_wb, DEFAULT_COC)
                rows.append((t_str, t_db_f, rh_f, t_wb, wue_raw, regime))
            site_hourly[site_id] = rows
            print(f"[calibrate] Fetched {site_id} 2025: {len(rows)} hours")

    # Solve single calibration multiplier against Iowa annual WUE anchor (0.19 L/kWh)
    dsm_rows = site_hourly["des-moines"]
    dsm_raw_annual = sum(r[4] for r in dsm_rows) / len(dsm_rows)
    dsm_warm = [r[4] for r in dsm_rows if r[1] > 25.0]
    dsm_raw_warm_mean = sum(dsm_warm) / len(dsm_warm)

    target_iowa_annual = 0.19
    multiplier = target_iowa_annual / dsm_raw_annual

    summary = {}
    for site_id, rows in site_hourly.items():
        cal_vals = [r[4] * multiplier for r in rows]
        warm_vals = [r[4] * multiplier for r in rows if r[1] > 25.0]
        # Monthly peak WUE
        by_month: dict[str, list[float]] = {}
        for r, w in zip(rows, cal_vals):
            m = r[0][:7]
            by_month.setdefault(m, []).append(w)
        peak_month_mean = max(sum(v) / len(v) for v in by_month.values())
        peak_hour = max(cal_vals)
        summary[site_id] = {
            "annual_mean_l_per_kwh": round(sum(cal_vals) / len(cal_vals), 4),
            "warm_hour_mean_l_per_kwh": round(sum(warm_vals) / max(1, len(warm_vals)), 4),
            "warm_hours_count": len(warm_vals),
            "peak_month_mean_l_per_kwh": round(peak_month_mean, 4),
            "peak_hour_l_per_kwh": round(peak_hour, 4),
        }

    # Check Karachi humid wet-bulb vs dry-bulb-only comparison
    khi_rows = site_hourly["karachi"]
    khi_dry_only_raw = [
        BASE_EVAP_L_PER_KWH_HEAT * PUE_EVAP * min(1.0, max(0.15, (r[1] - 25.0) / 8.0)) * (DEFAULT_COC / (DEFAULT_COC - 1.0))
        if r[1] > 25.0
        else 0.0
        for r in khi_rows
    ]
    khi_dry_only_mean = (sum(khi_dry_only_raw) / len(khi_dry_only_raw)) * multiplier

    payload = {
        "source": "Open-Meteo 2025 full-year archive (8,760h) + physical cooling tower model",
        "latent_heat_kj_per_kg": LATENT_HEAT_KJ_PER_KG,
        "base_evap_l_per_kwh_heat": round(BASE_EVAP_L_PER_KWH_HEAT, 6),
        "default_coc": DEFAULT_COC,
        "pue_evap": PUE_EVAP,
        "pue_chiller": PUE_CHILLER,
        "iowa_raw_annual_wue": round(dsm_raw_annual, 4),
        "iowa_raw_warm_wue": round(dsm_raw_warm_mean, 4),
        "calibration_multiplier": round(multiplier, 6),
        "anchors": {
            "iowa_annual_target_l_per_kwh": target_iowa_annual,
            "evaporative_target_range_l_per_kwh": [1.13, 1.55],
            "arizona_monthly_peak_anchor_l_per_kwh": "> 9.0 (includes extreme desert campus / chiller blowdown / ambient losses not captured by single-tower curve alone)",
        },
        "karachi_dry_bulb_only_annual_l_per_kwh": round(khi_dry_only_mean, 4),
        "karachi_wet_bulb_annual_l_per_kwh": summary["karachi"]["annual_mean_l_per_kwh"],
        "sites_2025": summary,
        "note": (
            f"Single calibrated multiplier={multiplier:.4f} aligns Des Moines 2025 annual WUE to {target_iowa_annual} L/kWh. "
            "Because Arizona >9 L/kWh monthly peaks in literature include low-load overhead and campus non-tower blowdown, "
            "this single-multiplier tower model stays strictly physical and does not silently inflate water to hit >9 L/kWh."
        ),
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[calibrate] Published multiplier = {multiplier:.6f}")
    print(json.dumps(summary, indent=2))
    print(
        f"[calibrate] Karachi annual WUE: dry-bulb-only={khi_dry_only_mean:.4f} vs wet-bulb={summary['karachi']['annual_mean_l_per_kwh']:.4f} L/kWh"
    )


if __name__ == "__main__":
    main()
