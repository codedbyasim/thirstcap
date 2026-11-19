"""Alibaba PAI 2020 GPU cluster trace loader and hourly workload class scaler."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache

from app.config import DATA_DIR, get_settings

ALIBABA_PATH = DATA_DIR / "alibaba" / "gpu_2020_weekly_profile.json"


@dataclass
class WorkloadSchedule:
    fixed_mw: list[float]
    deferrable_mw: list[float]
    pausable_mw: list[float]
    baseline_total_mw: list[float]
    is_sample_fallback: bool
    provenance_label: str
    assumptions: list[str]
    mix_pct: dict[str, float]


@lru_cache(maxsize=1)
def _load_alibaba_profile() -> dict | None:
    if ALIBABA_PATH.exists():
        return json.loads(ALIBABA_PATH.read_text(encoding="utf-8"))
    return None


def build_workload_schedule(
    times: list[str],
    flexible_share: float,
    it_capacity_mw: float = 100.0,
) -> WorkloadSchedule:
    settings = get_settings()
    target_mean = settings.default_mean_it_ratio * it_capacity_mw
    n = len(times)
    profile = _load_alibaba_profile()

    if profile is None or "hours" not in profile:
        flex_mw = target_mean * flexible_share
        fixed = [round(target_mean * (1.0 - flexible_share), 4)] * n
        deferrable = [round(flex_mw * 0.45, 4)] * n
        pausable = [round(flex_mw * 0.55, 4)] * n
        total = [round(target_mean, 4)] * n
        return WorkloadSchedule(
            fixed_mw=fixed,
            deferrable_mw=deferrable,
            pausable_mw=pausable,
            baseline_total_mw=total,
            is_sample_fallback=True,
            provenance_label="Flat 70% fallback (Alibaba trace file missing)",
            assumptions=["Alibaba GPU trace absent; using flat 70% capacity baseline."],
            mix_pct={
                "fixed": round((1.0 - flexible_share) * 100.0, 1),
                "deferrable": round(flexible_share * 45.0, 1),
                "pausable": round(flexible_share * 55.0, 1),
            },
        )

    weekly_hours: list[dict] = profile["hours"]
    raw_fixed: list[float] = []
    raw_def: list[float] = []
    raw_pau: list[float] = []
    raw_total: list[float] = []

    for t_str in times:
        dt = datetime.strptime(t_str[:13], "%Y-%m-%dT%H")
        how = dt.weekday() * 24 + dt.hour
        row = weekly_hours[how]
        f = float(row["fixed"])
        d = float(row["deferrable"])
        p = float(row["pausable"])
        raw_fixed.append(f)
        raw_def.append(d)
        raw_pau.append(p)
        raw_total.append(max(1e-6, f + d + p))

    # Scale total IT arrival curve so window mean == 0.70 * it_capacity_mw and max <= 0.96 * it_capacity_mw
    mean_raw = sum(raw_total) / n
    scaled_total = [(val / mean_raw) * target_mean for val in raw_total]

    # Softly compress only above 0.96 * cap while conserving exact mean energy
    cap_ceiling = 0.96 * it_capacity_mw
    if max(scaled_total) > cap_ceiling:
        excess = sum(max(0.0, x - cap_ceiling) for x in scaled_total)
        clipped = [min(x, cap_ceiling) for x in scaled_total]
        headroom = [max(0.0, cap_ceiling - x) for x in clipped]
        tot_headroom = sum(headroom)
        if tot_headroom > 0:
            scaled_total = [c + excess * (h / tot_headroom) for c, h in zip(clipped, headroom)]

    # Preserve Alibaba hourly class proportions as shape weights, then normalize so overall
    # flexible energy / total energy == flexible_share accurately while total_t stays intact.
    raw_flex_shares = [(d + p) / tot for d, p, tot in zip(raw_def, raw_pau, raw_total)]
    raw_def_of_flex = [d / max(1e-9, d + p) for d, p in zip(raw_def, raw_pau)]

    # Iterative exact scaling of per-hour flex share inside [0.01, 0.70] to match global flexible_share
    mean_raw_flex = sum(s * tot for s, tot in zip(raw_flex_shares, scaled_total)) / sum(scaled_total)
    scale_k = flexible_share / max(1e-6, mean_raw_flex)

    fixed_out: list[float] = []
    def_out: list[float] = []
    pau_out: list[float] = []
    for tot, r_fs, r_df in zip(scaled_total, raw_flex_shares, raw_def_of_flex):
        h_fs = min(0.85, max(0.01, r_fs * scale_k))
        flex_e = tot * h_fs
        fixed_out.append(tot - flex_e)
        def_out.append(flex_e * r_df)
        pau_out.append(flex_e * (1.0 - r_df))

    # Exact global residual correction on flexible share while preserving hourly total
    total_energy = sum(scaled_total)
    target_flex_energy = flexible_share * total_energy
    current_flex_energy = sum(def_out) + sum(pau_out)
    diff = target_flex_energy - current_flex_energy
    if abs(diff) > 1e-6:
        for i in range(n):
            if diff > 0:
                room = max(0.0, fixed_out[i] - 0.05 * scaled_total[i])
                add_i = min(room, diff * (scaled_total[i] / total_energy) * 2.0)
                if add_i > 0:
                    ratio_d = def_out[i] / max(1e-9, def_out[i] + pau_out[i])
                    fixed_out[i] -= add_i
                    def_out[i] += add_i * ratio_d
                    pau_out[i] += add_i * (1.0 - ratio_d)
                    diff -= add_i
            else:
                avail = def_out[i] + pau_out[i]
                take_i = min(avail, (-diff) * (scaled_total[i] / total_energy) * 2.0)
                if take_i > 0:
                    ratio_d = def_out[i] / max(1e-9, avail)
                    fixed_out[i] += take_i
                    def_out[i] -= take_i * ratio_d
                    pau_out[i] -= take_i * (1.0 - ratio_d)
                    diff += take_i

    # Final exact proportionality nudge if tiny floating difference remains
    current_flex_energy = sum(def_out) + sum(pau_out)
    if abs(target_flex_energy - current_flex_energy) > 1e-4 and current_flex_energy > 0:
        factor = target_flex_energy / current_flex_energy
        for i in range(n):
            new_flex = min(scaled_total[i] * 0.95, (def_out[i] + pau_out[i]) * factor)
            ratio_d = def_out[i] / max(1e-9, def_out[i] + pau_out[i])
            def_out[i] = new_flex * ratio_d
            pau_out[i] = new_flex * (1.0 - ratio_d)
            fixed_out[i] = scaled_total[i] - new_flex

    tot_f = sum(fixed_out)
    tot_d = sum(def_out)
    tot_p = sum(pau_out)
    tot_all = max(1e-9, tot_f + tot_d + tot_p)

    return WorkloadSchedule(
        fixed_mw=[round(v, 4) for v in fixed_out],
        deferrable_mw=[round(v, 4) for v in def_out],
        pausable_mw=[round(v, 4) for v in pau_out],
        baseline_total_mw=[round(v, 4) for v in scaled_total],
        is_sample_fallback=False,
        provenance_label=f"Alibaba PAI 2020 GPU Trace ({profile.get('total_jobs_parsed', 0):,} jobs)",
        assumptions=[
            "Workload arrival shape derived from Alibaba PAI 2020 GPU cluster trace: fixed (<15 min), deferrable (15 min–2 h), pausable (>2 h).",
            f"Trace scaled to {round(target_mean, 1)} MW window mean inside {round(it_capacity_mw, 1)} MW capacity with flexible share={round(flexible_share * 100)}%.",
        ],
        mix_pct={
            "fixed": round(tot_f / tot_all * 100.0, 1),
            "deferrable": round(tot_d / tot_all * 100.0, 1),
            "pausable": round(tot_p / tot_all * 100.0, 1),
        },
    )
