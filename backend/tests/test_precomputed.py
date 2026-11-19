"""Default fleet and tank requests must come back from committed JSON, not a live solve."""

from __future__ import annotations

import time


def _ui_fleet(**overrides):
    data = {
        "site_id": "dubai",
        "start": "2026-07-20",
        "end": "2026-07-26",
        "flexible_share": 0.20,
        "tank_gallons": 40000,
        "cap_ratio": 0.78,
        "flex_event": True,
        "flex_tighten": 0.30,
        "foresight": "perfect",
        "plant_model": "physical",
        "it_capacity_mw": 100,
        "coc": 4.0,
        "electricity_price_usd_per_mwh": 85,
        "reclaimed_water_share": 0.35,
    }
    data.update(overrides)
    return data


def test_ui_fleet_and_live_fallback_are_precomputed(client):
    t0 = time.perf_counter()
    perfect = client.post("/v1/fleet-compare", json=_ui_fleet())
    live = client.post("/v1/fleet-compare", json=_ui_fleet(foresight="live_forecast", start="2026-11-19", end="2026-11-25"))
    elapsed = time.perf_counter() - t0
    assert perfect.status_code == 200
    assert live.status_code == 200
    body = perfect.json()
    live_body = live.json()
    assert body["data_source"] == "precomputed"
    assert live_body["data_source"] == "precomputed_live_fallback"
    assert "2026 summer" in live_body["note"]
    assert len(body["sites"]) == 10
    assert {row["site_id"] for row in body["sites"]} == {row["site_id"] for row in live_body["sites"]}
    assert elapsed < 5.0


def test_registry_tank_defaults_are_precomputed(client):
    resp = client.post(
        "/v1/tank-sizing",
        json={
            "site_id": "phoenix",
            "start": "2026-07-13",
            "end": "2026-07-19",
            "flexible_share": 0.20,
            "foresight": "perfect",
            "plant_model": "physical",
            "it_capacity_mw": 100,
            "coc": 4,
            "electricity_price_usd_per_mwh": 85,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_source"] == "precomputed"
    assert body["site_id"] == "phoenix"
    assert len(body["points"]) == 6
    assert body["recommended_tank_gal"] in [0, 20000, 40000, 80000, 120000, 160000]


def test_live_tank_default_is_labelled_fallback(client):
    resp = client.post(
        "/v1/tank-sizing",
        json={
            "site_id": "phoenix",
            "start": "2026-11-19",
            "end": "2026-11-25",
            "flexible_share": 0.20,
            "foresight": "live_forecast",
            "plant_model": "physical",
            "it_capacity_mw": 100,
            "coc": 4,
            "electricity_price_usd_per_mwh": 85,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_source"] == "precomputed_live_fallback"
    assert "2026-07-13" in body["note"]
    assert len(body["points"]) == 6
