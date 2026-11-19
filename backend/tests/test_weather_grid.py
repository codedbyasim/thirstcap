"""Offline weather fixture parsing, Stull wet-bulb, and EIA-930 / Pakistan grid tests."""

from __future__ import annotations

import asyncio
import pytest

from app.services.grid import build_grid_series
from app.services.weather import load_weather, stull_wet_bulb


def test_stull_wet_bulb_physical_bounds():
    # Hot dry Phoenix (40 C, 15% RH) has wet-bulb well below dry-bulb (~20 C)
    tw_dry = stull_wet_bulb(40.0, 15.0)
    assert 17.0 < tw_dry < 23.0
    # Hot humid Karachi (35 C, 75% RH) has high wet-bulb (~31 C)
    tw_humid = stull_wet_bulb(35.0, 75.0)
    assert 29.5 < tw_humid < 33.5
    assert tw_humid > tw_dry


def test_des_moines_offline_fixtures_archive_and_forecast():
    bundle = asyncio.run(load_weather("des-moines", "2025-07-08", "2025-07-14", foresight="perfect"))
    assert len(bundle.times) == 168
    assert abs(max(bundle.temp_c) - 33.7) < 0.3
    assert min(bundle.temp_c) < 25.0

    f_bundle = asyncio.run(
        load_weather("des-moines", "2025-07-08", "2025-07-14", foresight="historical_forecast")
    )
    assert len(f_bundle.decision_temp_c) == 168
    assert f_bundle.decision_temp_c != f_bundle.temp_c


def test_eia930_real_demand_for_us_sites():
    dsm = asyncio.run(load_weather("des-moines", "2025-07-08", "2025-07-14", foresight="perfect"))
    grid_miso = build_grid_series("des-moines", dsm.grid_ba, dsm.times, dsm.temp_c)
    assert "EIA-930 MISO" in grid_miso.provenance_label
    assert all(d is not None and d > 40_000 for d in grid_miso.grid_demand_mw)
    peak_count = sum(1 for p in grid_miso.grid_peak if p)
    assert 20 <= peak_count <= 30

    phx = asyncio.run(load_weather("phoenix", "2025-07-07", "2025-07-13", foresight="perfect"))
    grid_azps = build_grid_series("phoenix", phx.grid_ba, phx.times, phx.temp_c)
    assert "EIA-930 AZPS" in grid_azps.provenance_label
    assert all(d is not None and d > 2_000 for d in grid_azps.grid_demand_mw)

    nova = asyncio.run(load_weather("northern-virginia", "2025-07-21", "2025-07-27", foresight="perfect"))
    grid_pjm = build_grid_series("northern-virginia", nova.grid_ba, nova.times, nova.temp_c)
    assert "EIA-930 PJM" in grid_pjm.provenance_label
    assert len(grid_pjm.grid_demand_mw) == 168
    assert all(d is not None and d > 60_000 for d in grid_pjm.grid_demand_mw)

    zaz = asyncio.run(load_weather("zaragoza", "2025-07-14", "2025-07-20", foresight="perfect"))
    assert len(zaz.times) == 168 and max(zaz.temp_c) > 38.0
    dxb = asyncio.run(load_weather("dubai", "2025-07-28", "2025-08-03", foresight="perfect"))
    assert len(dxb.times) == 168 and max(dxb.temp_c) > 44.0

    # Verify 2026 peak summer archive fixtures load cleanly offline
    phx26 = asyncio.run(load_weather("phoenix", "2026-07-13", "2026-07-19", foresight="perfect"))
    assert len(phx26.times) == 168 and max(phx26.temp_c) > 40.0
    zaz26 = asyncio.run(load_weather("zaragoza", "2026-07-13", "2026-07-19", foresight="perfect"))
    assert len(zaz26.times) == 168 and max(zaz26.temp_c) > 41.0


def test_pakistan_grid_is_labelled_sample_shape():
    lhe = asyncio.run(load_weather("lahore", "2025-06-08", "2025-06-14", foresight="perfect"))
    grid_lhe = build_grid_series("lahore", lhe.grid_ba, lhe.times, lhe.temp_c)
    assert all(d is None for d in grid_lhe.grid_demand_mw)
    assert any("Sample grid shape, not a measured Pakistan dispatch" in a for a in grid_lhe.assumptions)


@pytest.mark.skip(reason="Optional live Open-Meteo network integration test; run explicitly with -k live_weather")
def test_live_open_meteo_forecast_integration():
    live = asyncio.run(load_weather("des-moines", "2026-11-19", "2026-11-21", foresight="live_forecast"))
    assert len(live.times) == 72
