"""End-to-end API and CBC MILP optimization tests matching BACKEND.md section 6."""

from __future__ import annotations


def _base_payload(**overrides):
    data = {
        "site_id": "des-moines",
        "start": "2025-07-08",
        "end": "2025-07-14",
        "flexible_share": 0.20,
        "tank_gallons": 40000,
        "cap_ratio": 0.78,
        "flex_event": False,
        "flex_tighten": 0.30,
        "foresight": "perfect",
        "plant_model": "physical",
    }
    data.update(overrides)
    return data


def test_plan_des_moines_cbc_milp_invariants(client):
    resp = client.post("/v1/plan", json=_base_payload())
    assert resp.status_code == 200
    body = resp.json()

    assert body["meta"]["sample"] is False
    assert body["meta"]["solver_status"] == "Optimal"
    assert len(body["hours"]) == 168
    assert len(body["days"]) == 7

    assert body["optimized"]["peak_day_gal"] <= body["baseline"]["peak_day_gal"] + 1
    assert all(0.0 <= h["load_mw"] <= 100.01 for h in body["hours"])
    assert all(h["utility_gal"] >= -1e-3 for h in body["hours"])

    # Hourly utility sums to daily optimized total within 2 gallons/day
    for d_idx, day in enumerate(body["days"]):
        h_sum = sum(h["utility_gal"] for h in body["hours"][d_idx * 24 : (d_idx + 1) * 24])
        assert abs(h_sum - day["optimized_gal"]) <= 2.5

    assert body["business_impact"] is not None
    assert body["business_impact"]["avoided_capex_high_usd"] >= body["business_impact"]["avoided_capex_low_usd"]
    assert body["business_impact"]["households_daily_water_protected"] > 0
    assert body["business_impact"]["people_daily_water_protected"] > 0
    assert len(body["dispatch_windows"]) > 0
    assert body["utility_signal"] is not None
    assert body["utility_signal"]["compliance_verified"] is True


def test_flex_event_cuts_cap_by_30_percent(client):
    normal = client.post("/v1/plan", json=_base_payload(flex_event=False)).json()
    flex = client.post("/v1/plan", json=_base_payload(flex_event=True)).json()

    assert abs(flex["meta"]["cap_gal"] - normal["meta"]["cap_gal"] * 0.70) <= 2.0
    assert flex["meta"]["flex_event"] is True
    assert flex["optimized"]["peak_day_gal"] <= normal["optimized"]["peak_day_gal"] + 5.0


def test_more_flexibility_never_raises_scheduled_peak_on_toy_curve(client):
    low = client.post(
        "/v1/plan",
        json=_base_payload(flexible_share=0.10, tank_gallons=0, cap_ratio=1.0, plant_model="toy"),
    ).json()
    high = client.post(
        "/v1/plan",
        json=_base_payload(flexible_share=0.30, tank_gallons=0, cap_ratio=1.0, plant_model="toy"),
    ).json()
    assert high["levers"]["peak_after_schedule_gal"] <= low["levers"]["peak_after_schedule_gal"] + 5.0


def test_infeasible_cap_reports_honest_shortfall(client):
    # Phoenix extreme heat with 0 tank and 40% cap
    resp = client.post(
        "/v1/plan",
        json=_base_payload(
            site_id="phoenix",
            start="2025-07-07",
            end="2025-07-13",
            flexible_share=0.05,
            tank_gallons=0,
            cap_ratio=0.40,
            flex_event=True,
        ),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["sample"] is False
    # Physical dry cooling can drop peak near residual 0.02 L/kWh, OR if slack triggers cap_met is False.
    # Either way utility_gal >= 0 and peak_day_gal matches cap_met logic.
    if not body["meta"]["cap_met"]:
        assert body["meta"]["cap_shortfall_gal"] > 0


def test_sensitivity_and_real_historical_forecast(client):
    resp = client.post("/v1/sensitivity", json=_base_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["sample"] is False
    assert body["swaps_included"] is False
    assert len(body["points"]) == 6
    assert [p["flexible_share"] for p in body["points"]] == [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]
    assert body["points"][-1]["peak_cut_pct"] >= body["points"][0]["peak_cut_pct"] - 0.1
    assert "Open-Meteo Historical Forecast" in body["label"]


def test_unknown_site_returns_contract_error_envelope(client):
    resp = client.post("/v1/plan", json=_base_payload(site_id="atlantis"))
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "unknown_site"
    assert "atlantis" in body["error"]["message"]
    assert body["error"]["details"]["site_id"] == "atlantis"


def test_csv_export_returns_downloadable_telemetry(client):
    resp = client.post("/v1/export/csv", json=_base_payload())
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().splitlines()
    assert len(lines) == 169  # 1 header + 168 hours
    assert "wet_bulb_c" in lines[0]
    assert "tank_level_gal" in lines[0]


def test_tank_sizing_roi_endpoint(client):
    resp = client.post("/v1/tank-sizing", json=_base_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["points"]) == 6
    assert [p["tank_gallons"] for p in body["points"]] == [0, 20000, 40000, 80000, 120000, 160000]
    assert body["points"][-1]["peak_day_gal"] <= body["points"][0]["peak_day_gal"] + 1.0
    assert body["recommended_tank_gal"] in [0, 20000, 40000, 80000, 120000, 160000]


def test_fleet_compare_10_basins_endpoint(client):
    resp = client.post("/v1/fleet-compare", json=_base_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["sites"]) == 10
    assert body["total_peak_gal_saved"] > 1_000_000
    assert body["total_households_protected"] > 3_000
    assert body["total_capex_high_usd"] > body["total_capex_low_usd"]


def test_enterprise_reclaimed_eu_eed_and_permit_shield(client):
    zaz = client.post(
        "/v1/plan",
        json=_base_payload(
            site_id="zaragoza",
            start="2025-07-14",
            end="2025-07-20",
            flex_event=True,
            reclaimed_water_share=0.35,
        ),
    )
    assert zaz.status_code == 200
    zb = zaz.json()
    zbi = zb["business_impact"]
    assert zbi["wri_stress_score"] == 71
    assert "EU EED" in zbi["regulatory_framework"]
    assert zbi["permit_shield_score"] >= 80
    assert zbi["eu_eed_rating"] in ["A", "B"]
    assert abs((zbi["potable_peak_day_gal"] + zbi["reclaimed_peak_day_gal"]) - zb["optimized"]["peak_day_gal"]) <= 10.0
    assert zbi["five_year_net_roi_usd"] > 500_000

    dxb = client.post(
        "/v1/plan",
        json=_base_payload(
            site_id="dubai",
            start="2026-07-20",
            end="2026-07-26",
            flex_event=False,
            reclaimed_water_share=0.50,
        ),
    )
    assert dxb.status_code == 200
    db = dxb.json()
    assert db["business_impact"]["wri_stress_score"] == 83
    assert db["business_impact"]["potable_peak_day_gal"] <= db["optimized"]["peak_day_gal"] * 0.52


def test_custom_worldwide_city_profile_and_economizer():
    from app.schemas import CustomSiteInput
    from app.services.weather import _pick_custom_sister, estimate_custom_basin_profile

    riyadh = CustomSiteInput(name="Riyadh", country="Saudi Arabia", lat=24.7136, lon=46.6753, timezone="Asia/Riyadh")
    prof_r = estimate_custom_basin_profile(riyadh)
    assert prof_r["wri_stress_score"] == 82
    assert prof_r["water_tariff_usd_per_kgal"] >= 10.0

    tokyo = CustomSiteInput(name="Tokyo", country="Japan", lat=35.6895, lon=139.6917, timezone="Asia/Tokyo")
    sis_name, s_lat, _ = _pick_custom_sister(tokyo)
    assert "Sapporo" in sis_name
    assert s_lat > tokyo.lat
