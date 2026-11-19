"""Grid demand and stress signals from official EIA-930 2025 hourly data (MISO, AZPS, PJM) and regional diurnal curves."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
import numpy as np

from app.config import DATA_DIR

EIA_DIR = DATA_DIR / "eia930"


@dataclass
class GridSeries:
    grid_stress: list[float]
    grid_peak: list[bool]
    grid_demand_mw: list[float | None]
    provenance_label: str
    assumptions: list[str]


@lru_cache(maxsize=6)
def _load_eia_ba(ba: str) -> dict | None:
    path = EIA_DIR / f"{ba}_2025.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def build_grid_series(
    site_id: str,
    grid_ba: str | None,
    times: list[str],
    temp_c: list[float],
) -> GridSeries:
    n = len(times)
    assumptions: list[str] = []

    if grid_ba in ("MISO", "AZPS", "PJM"):
        data = _load_eia_ba(grid_ba)
        if data is not None:
            hourly_map: dict[str, float] = data.get("hourly", {})
            exact_vals = [hourly_map.get(f"{t[:13]}:00") for t in times]
            if all(v is not None for v in exact_vals):
                demands = [float(v) for v in exact_vals]  # type: ignore[arg-type]
                arr = np.array(demands, dtype=float)
                cutoff = float(np.percentile(arr, 85))
                d_min, d_max = float(arr.min()), float(arr.max())
                span = max(1.0, d_max - d_min)
                stress = [round(float((d - d_min) / span), 4) for d in demands]
                peaks = [bool(d >= cutoff) for d in demands]
                return GridSeries(
                    grid_stress=stress,
                    grid_peak=peaks,
                    grid_demand_mw=[round(d, 1) for d in demands],
                    provenance_label=f"EIA-930 {grid_ba} 2025 measured hourly demand (MW)",
                    assumptions=[
                        f"Grid peak flags top 15% of measured EIA-930 {grid_ba} balancing-authority demand hours in this window."
                    ],
                )

            # Live / out-of-2025 fallback using real EIA-930 summer weekly diurnal profile + live temperature
            weekly: list[float] = data.get("summer_weekly_mw", [])
            if len(weekly) == 168:
                t_min, t_max = min(temp_c), max(temp_c)
                t_span = max(1.0, t_max - t_min)
                projected: list[float] = []
                for idx, t_str in enumerate(times):
                    dt = datetime.strptime(t_str[:13], "%Y-%m-%dT%H")
                    how = dt.weekday() * 24 + dt.hour
                    base_mw = float(weekly[how])
                    t_norm = (temp_c[idx] - t_min) / t_span
                    projected.append(round(base_mw * (0.94 + 0.12 * t_norm), 1))
                arr = np.array(projected, dtype=float)
                cutoff = float(np.percentile(arr, 85))
                d_min, d_max = float(arr.min()), float(arr.max())
                span = max(1.0, d_max - d_min)
                return GridSeries(
                    grid_stress=[round(float((d - d_min) / span), 4) for d in projected],
                    grid_peak=[bool(d >= cutoff) for d in projected],
                    grid_demand_mw=projected,
                    provenance_label=f"EIA-930 {grid_ba} 2025 summer profile + live temp",
                    assumptions=[
                        f"Grid demand projected from real 2025 EIA-930 {grid_ba} summer weekly profile modulated by live temperature."
                    ],
                )

    # Non-EIA regions (Lahore, Karachi, or international custom cities)
    t_min, t_max = min(temp_c), max(temp_c)
    t_span = max(1.0, t_max - t_min)
    raw_stress: list[float] = []
    for idx, t_str in enumerate(times):
        hour = int(t_str[11:13])
        diurnal = max(0.0, math.sin(((hour - 6) / 24.0) * math.pi))
        t_norm = (temp_c[idx] - t_min) / t_span
        raw_stress.append(round(0.75 * diurnal + 0.25 * t_norm, 4))

    cutoff = float(np.percentile(np.array(raw_stress, dtype=float), 85))
    peaks = [bool(s >= cutoff) for s in raw_stress]
    if site_id in ("lahore", "karachi"):
        assumptions.append("Sample grid shape, not a measured Pakistan dispatch")
        label = "Afternoon thermal-diurnal shape (non-EIA Pakistan)"
    else:
        assumptions.append("Sample afternoon thermal-diurnal grid shape (EIA-930 covers US balancing authorities only).")
        label = "Afternoon thermal-diurnal shape (non-EIA)"

    return GridSeries(
        grid_stress=raw_stress,
        grid_peak=peaks,
        grid_demand_mw=[None] * n,
        provenance_label=label,
        assumptions=assumptions,
    )
