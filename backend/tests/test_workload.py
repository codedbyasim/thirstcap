"""Alibaba PAI 2020 GPU trace workload scaler tests."""

from __future__ import annotations

import asyncio
from app.services.weather import load_weather
from app.services.workload import build_workload_schedule


def test_alibaba_workload_scaler_invariants():
    dsm = asyncio.run(load_weather("des-moines", "2025-07-08", "2025-07-14", foresight="perfect"))

    for req_share in (0.05, 0.15, 0.20, 0.30):
        sched = build_workload_schedule(dsm.times, flexible_share=req_share, it_capacity_mw=100.0)
        assert sched.is_sample_fallback is False
        assert len(sched.fixed_mw) == 168
        assert max(sched.baseline_total_mw) <= 100.01
        assert min(sched.baseline_total_mw) > 0.0

        total_e = sum(sched.baseline_total_mw)
        flex_e = sum(sched.deferrable_mw) + sum(sched.pausable_mw)
        actual_share = flex_e / total_e
        assert abs(actual_share - req_share) < 0.001  # within 0.1%
        assert abs((total_e / 168.0) - 70.0) < 0.2

    # Ensure it is genuine time-varying workload rather than flat 70 MW
    sched20 = build_workload_schedule(dsm.times, flexible_share=0.20, it_capacity_mw=100.0)
    assert max(sched20.baseline_total_mw) - min(sched20.baseline_total_mw) > 3.0
