"""Cooling plant physics (toy contract + calibrated physical wet-bulb) and tank dispatch tests."""

from __future__ import annotations

import json
from pathlib import Path

from app.services.plant import gallons_for_load, optimal_tank_dispatch, physical_wue, toy_wue
from app.services.weather import stull_wet_bulb

ROOT_DIR = Path(__file__).resolve().parents[2]


def test_toy_curve_and_des_moines_142685_anchor():
    assert toy_wue(25.0) == 0.0
    assert abs(toy_wue(40.0) - 1.8) < 1e-9
    assert toy_wue(46.0) > 1.8

    weather_json = json.loads((ROOT_DIR / "src" / "data" / "weather.json").read_text(encoding="utf-8"))
    dsm = weather_json["des-moines__2025-07-08"]
    temps = dsm["temps"]
    times = dsm["times"]

    daily = []
    for d in range(7):
        gal = sum(gallons_for_load(70.0, temps[d * 24 + h], 18.0, 0.0, plant_model="toy") for h in range(24))
        daily.append((times[d * 24][:10], gal))

    peak_gal = max(g for _, g in daily)
    assert abs(peak_gal - 142_685.0) <= 1426.85  # within 1% of 142,685 gal
    july_11 = dict(daily)["2025-07-11"]
    assert july_11 == 0.0


def test_tank_dispatch_78880_anchor():
    daily = [63664, 100212, 97549, 0, 10674, 28581, 72607]
    peak, utility, _ = optimal_tank_dispatch(daily, 40_000.0)
    assert abs(peak - 78_880.0) <= 788.8  # within 1%
    assert all(u >= 0.0 for u in utility)

    zero_peak, zero_util, _ = optimal_tank_dispatch(daily, 0.0)
    assert zero_peak == max(daily)
    assert zero_util == daily


def test_physical_wet_bulb_humidity_and_coc():
    # At same dry-bulb 35C, humid air (75% RH) requires more water than dry air (20% RH)
    tw_dry = stull_wet_bulb(35.0, 20.0)
    tw_humid = stull_wet_bulb(35.0, 75.0)
    w_dry, reg_dry = physical_wue(35.0, tw_dry, coc=4.0)
    w_humid, reg_humid = physical_wue(35.0, tw_humid, coc=4.0)
    assert reg_dry == "evaporative"
    assert reg_humid == "chiller"
    assert w_humid > w_dry

    # Higher CoC reduces blowdown make-up water
    w_coc6, _ = physical_wue(35.0, tw_dry, coc=6.0)
    assert w_coc6 < w_dry

    # Below 25C is naturally dry and free
    w_cool, reg_cool = physical_wue(24.9, 20.0, coc=4.0)
    assert w_cool == 0.0
    assert reg_cool == "dry"
