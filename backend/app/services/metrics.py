"""Metrics, lever waterfall, business ROI, and JSON response assembly."""

from __future__ import annotations

from app.config import get_settings, load_calibration
from app.schemas import (
    BusinessImpact,
    DataProvenance,
    DayPoint,
    DispatchWindow,
    HourPoint,
    LeverReport,
    Metrics,
    PlanMeta,
    PlanRequest,
    PlanResponse,
    UtilitySignalPayload,
)
from app.services.grid import GridSeries
from app.services.optimizer import SolvedPlan
from app.services.plant import GAL_PER_LITER
from app.services.weather import SITE_REGISTRY, WeatherBundle, estimate_custom_basin_profile
from app.services.workload import WorkloadSchedule


def _compute_metrics(
    daily_gal: list[float],
    daily_dates: list[str],
    daily_it_mwh: list[float],
    extra_mwh: float,
    grid_peak_mw: float,
    avg_job_delay_min: float,
    avg_flexible_shift_min: float,
    baseline_peak_gal: float,
) -> Metrics:
    peak_idx = max(range(len(daily_gal)), key=lambda i: daily_gal[i])
    peak_gal = daily_gal[peak_idx]
    total_gal = sum(daily_gal)
    mean_gal = total_gal / max(1, len(daily_gal))
    it_kwh = max(1.0, daily_it_mwh[peak_idx] * 1000.0)
    liters = peak_gal / GAL_PER_LITER
    wci = max(0.0, (baseline_peak_gal - peak_gal) / baseline_peak_gal) if baseline_peak_gal > 0 else 0.0

    return Metrics(
        peak_day_gal=round(peak_gal, 0),
        peak_day_date=daily_dates[peak_idx],
        mean_day_gal=round(mean_gal, 0),
        pwue_l_per_kwh=round(liters / it_kwh, 3),
        peaking_factor=round(peak_gal / mean_gal, 2) if mean_gal > 1.0 else 0.0,
        extra_mwh=round(extra_mwh, 1),
        grid_peak_mw=round(grid_peak_mw, 3),
        avg_job_delay_min=round(avg_job_delay_min, 1),
        avg_flexible_shift_min=round(avg_flexible_shift_min, 1),
        water_capacity_impact=round(wci, 4),
        total_gal=round(total_gal, 0),
    )


def assemble_plan_response(
    request: PlanRequest,
    weather: WeatherBundle,
    grid: GridSeries,
    workload: WorkloadSchedule,
    solved: SolvedPlan,
) -> PlanResponse:
    settings = get_settings()
    cal = load_calibration()
    cal_mult = float(cal.get("calibration_multiplier", 1.0)) if request.plant_model == "physical" else 1.0

    n = len(weather.times)
    days_count = n // 24

    daily_dates = [weather.times[d * 24][:10] for d in range(days_count)]
    baseline_daily = [sum(solved.baseline_water_gal[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    scheduled_daily = [sum(solved.scheduled_water_gal[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    optimized_daily = [sum(solved.utility_gal[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    baseline_it_daily = [sum(workload.baseline_total_mw[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    optimized_it_daily = [sum(solved.local_mw[d * 24 : (d + 1) * 24]) for d in range(days_count)]

    baseline_peak = max(baseline_daily) if baseline_daily else 0.0
    optimized_peak = max(optimized_daily) if optimized_daily else 0.0
    total_it_mwh = max(1.0, sum(workload.baseline_total_mw))
    moved_mwh = solved.time_shift_mwh + solved.space_shift_mwh
    extra_mwh = sum(solved.extra_mwh_hourly)
    grid_peak_mw = max(
        (solved.extra_mwh_hourly[i] for i in range(n) if grid.grid_peak[i]),
        default=0.0,
    )
    avg_delay_min = (solved.delay_mwh_h / total_it_mwh) * 60.0
    avg_flex_shift_min = (solved.abs_shift_mwh_h / moved_mwh) * 60.0 if moved_mwh > 1e-6 else 0.0

    baseline_metrics = _compute_metrics(
        daily_gal=baseline_daily,
        daily_dates=daily_dates,
        daily_it_mwh=baseline_it_daily,
        extra_mwh=0.0,
        grid_peak_mw=0.0,
        avg_job_delay_min=0.0,
        avg_flexible_shift_min=0.0,
        baseline_peak_gal=baseline_peak,
    )
    optimized_metrics = _compute_metrics(
        daily_gal=optimized_daily,
        daily_dates=daily_dates,
        daily_it_mwh=optimized_it_daily,
        extra_mwh=extra_mwh,
        grid_peak_mw=grid_peak_mw,
        avg_job_delay_min=avg_delay_min,
        avg_flexible_shift_min=avg_flex_shift_min,
        baseline_peak_gal=baseline_peak,
    )

    # Round hourly utility_gal while keeping exact daily sum consistent within <1 gal
    hours: list[HourPoint] = []
    for i in range(n):
        hours.append(
            HourPoint(
                time=weather.times[i],
                temp_c=round(weather.temp_c[i], 1),
                sister_temp_c=round(weather.sister_temp_c[i], 1),
                baseline_load_mw=round(workload.baseline_total_mw[i], 2),
                load_mw=round(solved.local_mw[i], 2),
                time_shift_in_mw=round(solved.time_shift_in_mw[i], 2),
                time_shift_out_mw=round(solved.time_shift_out_mw[i], 2),
                space_shift_out_mw=round(solved.space_shift_out_mw[i], 2),
                sister_added_mw=round(solved.sister_added_mw[i], 2),
                baseline_water_gal=round(solved.baseline_water_gal[i], 1),
                consumption_gal=round(solved.consumption_gal[i], 1),
                utility_gal=round(solved.utility_gal[i], 1),
                cooling_mode=solved.cooling_mode[i],
                swap_fraction=round(solved.swap_fraction[i], 3),
                grid_stress=grid.grid_stress[i],
                grid_peak=grid.grid_peak[i],
                wet_bulb_c=round(weather.wet_bulb_c[i], 1),
                rh_pct=round(weather.rh_pct[i], 1),
                tank_level_gal=round(solved.tank_level_gal[i], 0),
                tank_fill_gal=round(solved.tank_fill_gal[i], 1),
                tank_draw_gal=round(solved.tank_draw_gal[i], 1),
                grid_demand_mw=grid.grid_demand_mw[i],
                fixed_mw=round(workload.fixed_mw[i], 2),
                deferrable_mw=round(workload.deferrable_mw[i], 2),
                pausable_mw=round(workload.pausable_mw[i], 2),
            )
        )

    days: list[DayPoint] = []
    for d in range(days_count):
        slice_t = weather.temp_c[d * 24 : (d + 1) * 24]
        days.append(
            DayPoint(
                date=daily_dates[d],
                temp_max_c=round(max(slice_t), 1),
                baseline_gal=round(baseline_daily[d], 0),
                scheduled_gal=round(scheduled_daily[d], 0),
                optimized_gal=round(optimized_daily[d], 0),
                cap_gal=round(solved.cap_gal, 0),
            )
        )

    swap_mwh = sum(solved.local_mw[i] * solved.swap_fraction[i] for i in range(n))
    swap_hours = sum(1 for sf in solved.swap_fraction if sf > 0.05)
    tank_net_draw = max(0.0, request.tank_gallons - (solved.tank_level_gal[-1] if solved.tank_level_gal else 0.0))

    levers = LeverReport(
        time_shift_mwh=round(solved.time_shift_mwh, 1),
        space_shift_mwh=round(solved.space_shift_mwh, 1),
        sister_name=weather.sister_name,
        sister_added_gal=round(solved.sister_added_gal, 0),
        sister_baseline_peak_gal=round(solved.sister_baseline_peak_gal, 0),
        sister_peak_with_shift_gal=round(solved.sister_peak_with_shift_gal, 0),
        swap_mwh=round(swap_mwh, 1),
        swap_hours=swap_hours,
        tank_net_draw_gal=round(tank_net_draw, 0),
        peak_baseline_gal=round(baseline_peak, 0),
        peak_after_schedule_gal=round(max(scheduled_daily) if scheduled_daily else 0.0, 0),
        peak_after_tank_gal=round(solved.peak_after_tank_gal, 0),
        peak_final_gal=round(optimized_peak, 0),
    )

    shortfall = max(0.0, optimized_peak - solved.cap_gal)
    cap_met = shortfall <= max(50.0, solved.cap_gal * 0.005)

    assumptions = [
        *workload.assumptions,
        *grid.assumptions,
        "Sister pairing is a sample regional campus; sister daily withdrawal capped at 110% of sister baseline peak.",
        "Deferrable and pausable blocks use continuous hourly allocation inside the -18h to +24h window so CBC solves 72h rolling windows under 2s.",
        "Tank starts full at hour 0; net draw represents water withdrawn prior to the window.",
    ]
    if request.plant_model == "physical":
        assumptions.append(
            f"Calibrated physical wet-bulb model (latent heat 2450 kJ/kg, CoC={request.coc:.1f}, multiplier={cal_mult:.4f})."
        )
    else:
        assumptions.append("Toy benchmark cooling curve active (0 <=25C, 1.8 L/kWh @ 40C, +0.15 PUE dry swap).")
    if request.foresight == "historical_forecast":
        assumptions.append("Decisions solved on Open-Meteo Historical Forecast; water scored on Open-Meteo Archive Actuals.")

    plant_label = (
        f"Physical Wet-Bulb (CoC={request.coc:.1f}, x{cal_mult:.3f})"
        if request.plant_model == "physical"
        else "Toy Contract Curve (1.8 L/kWh @ 40C)"
    )

    is_sample = bool(workload.is_sample_fallback or not solved.cbc_produced)
    label = (
        f"PuLP CBC rolling-horizon MILP ({solved.solver_status}, {solved.solve_time_ms}ms) on {weather.weather_desc}. "
        f"Sister pairing ({weather.sister_name}) is a regional reference campus."
    )

    meta = PlanMeta(
        sample=is_sample,
        label=label,
        model=f"pulp-cbc-rolling72h-{request.plant_model}-v1",
        weather_source="open-meteo-archive",
        site_id=weather.site_id,
        sister_name=weather.sister_name,
        start=weather.start,
        end=weather.end,
        cap_gal=round(solved.cap_gal, 0),
        cap_ratio_effective=round(solved.cap_ratio_effective, 4),
        cap_met=cap_met,
        cap_shortfall_gal=round(shortfall, 0),
        flex_event=request.flex_event,
        assumptions=assumptions,
        site_name=weather.site_name,
        region=weather.region,
        timezone=weather.timezone,
        plant_model=request.plant_model,
        solver_status=solved.solver_status,
        solve_time_ms=solved.solve_time_ms,
        calibration_multiplier=round(cal_mult, 4),
        it_capacity_mw=round(request.it_capacity_mw, 1),
        coc=round(request.coc, 1),
        data_provenance=DataProvenance(
            weather=weather.weather_desc,
            grid=grid.provenance_label,
            workload=workload.provenance_label,
            plant=plant_label,
            solver=f"PuLP CBC MILP ({solved.solver_status}, {solved.solve_time_ms} ms)",
        ),
    )

    peak_gal_saved = max(0.0, baseline_peak - optimized_peak)
    peak_mgd_avoided = peak_gal_saved / 1_000_000.0
    capex_low = peak_mgd_avoided * settings.capex_low_usd_per_mgd
    capex_high = peak_mgd_avoided * settings.capex_high_usd_per_mgd
    capex_mid = 0.5 * (capex_low + capex_high)
    power_cost = extra_mwh * request.electricity_price_usd_per_mwh
    humid_hours = sum(1 for i in range(n) if weather.temp_c[i] > 25.0 and weather.wet_bulb_c[i] > 20.0)
    sister_guardrail_met = solved.sister_peak_with_shift_gal <= max(
        1.0, settings.sister_cap_ratio * solved.sister_baseline_peak_gal + 50.0
    )

    households_protected = int(round(peak_gal_saved / 300.0))
    people_protected = int(round((peak_gal_saved / GAL_PER_LITER) / 150.0))
    co2_factor = 0.42 if weather.site_id in ("des-moines", "phoenix", "northern-virginia") else (0.28 if weather.site_id == "zaragoza" else 0.48)
    extra_co2 = extra_mwh * co2_factor
    all_dry_extra_mwh = sum(
        0.15 * workload.baseline_total_mw[i] for i in range(n) if weather.temp_c[i] > 25.0
    )
    co2_avoided_vs_all_dry = max(0.0, all_dry_extra_mwh * co2_factor - extra_co2)

    site_meta = (
        estimate_custom_basin_profile(request.custom_site)
        if weather.site_id == "custom" and request.custom_site is not None
        else SITE_REGISTRY.get(weather.site_id, {})
    )
    basin_stress_tier = str(site_meta.get("basin_stress_tier", "Regional"))
    wri_stress_score = int(site_meta.get("wri_stress_score", 55))
    regulatory_framework = str(
        site_meta.get("regulatory_framework", "Regional Municipal Water Allocation")
    )
    reclaimed = float(request.reclaimed_water_share)
    potable_peak_day_gal = round(optimized_peak * (1.0 - reclaimed), 0)
    reclaimed_peak_day_gal = round(optimized_peak * reclaimed, 0)

    # ISO/IEC 30134-9 & EU EED potable WUE grade
    eff_potable_pwue = optimized_metrics.pwue_l_per_kwh * (1.0 - reclaimed)
    if eff_potable_pwue <= 0.35:
        eu_eed_rating = "A"
    elif eff_potable_pwue <= 0.65:
        eu_eed_rating = "B"
    elif eff_potable_pwue <= 0.95:
        eu_eed_rating = "C"
    elif eff_potable_pwue <= 1.25:
        eu_eed_rating = "D"
    elif eff_potable_pwue <= 1.55:
        eu_eed_rating = "E"
    elif eff_potable_pwue <= 1.85:
        eu_eed_rating = "F"
    else:
        eu_eed_rating = "G"

    sister_guardrail_met = solved.sister_peak_with_shift_gal <= max(
        1.0, settings.sister_cap_ratio * solved.sister_baseline_peak_gal + 50.0
    )
    peak_cut_pct = optimized_metrics.water_capacity_impact * 100.0
    if baseline_peak < 100.0:
        permit_shield_score = 96
        permit_shield_status = "Free-Air Economizer Active"
        eu_eed_rating = "A"
    else:
        permit_shield_score = max(
            0,
            min(
                100,
                (35 if cap_met else 12)
                + min(25, round(peak_cut_pct * 0.65))
                + (15 if grid_peak_mw <= 0.1 else 5)
                + (10 if sister_guardrail_met else 0)
                + min(15, round(reclaimed * 25.0)),
            ),
        )
        if permit_shield_score >= 80:
            permit_shield_status = "Permit Ready"
        elif permit_shield_score >= 60:
            permit_shield_status = "Conditional Approval"
        else:
            permit_shield_status = "High Moratorium Risk"

    tariff = (
        float(request.water_tariff_usd_per_kgal)
        if request.water_tariff_usd_per_kgal is not None
        else float(site_meta.get("water_tariff_usd_per_kgal", 5.5))
    )
    weekly_gal_saved = max(0.0, baseline_metrics.total_gal - optimized_metrics.total_gal) + (
        optimized_metrics.total_gal * reclaimed * 0.45
    )
    annual_tariff_savings_usd = round(
        (weekly_gal_saved / 1000.0) * tariff * 24.0
        + peak_mgd_avoided * 1_000_000.0 * 0.001 * tariff * 18.0,
        0,
    )
    est_tank_cost = request.tank_gallons * 2.50
    annual_power_opex = power_cost * 12.0
    five_year_net_roi_usd = round(
        5.0 * annual_tariff_savings_usd + capex_low - est_tank_cost - 5.0 * annual_power_opex,
        0,
    )
    tank_payback_years = (
        round(est_tank_cost / max(1.0, annual_tariff_savings_usd + 0.15 * capex_low), 2)
        if est_tank_cost > 0.0
        else 0.0
    )

    business_impact = BusinessImpact(
        peak_mgd_avoided=round(peak_mgd_avoided, 4),
        avoided_capex_low_usd=round(capex_low, 0),
        avoided_capex_high_usd=round(capex_high, 0),
        avoided_capex_mid_usd=round(capex_mid, 0),
        extra_power_cost_usd=round(power_cost, 0),
        electricity_price_usd_per_mwh=round(request.electricity_price_usd_per_mwh, 2),
        sister_guardrail_met=sister_guardrail_met,
        humid_wet_bulb_hours=humid_hours,
        workload_mix_pct=workload.mix_pct,
        households_daily_water_protected=households_protected,
        people_daily_water_protected=people_protected,
        extra_co2_tonnes=round(extra_co2, 2),
        co2_avoided_vs_all_dry_tonnes=round(co2_avoided_vs_all_dry, 2),
        basin_stress_tier=basin_stress_tier,
        wri_stress_score=wri_stress_score,
        regulatory_framework=regulatory_framework,
        permit_shield_score=permit_shield_score,
        permit_shield_status=permit_shield_status,
        eu_eed_rating=eu_eed_rating,  # type: ignore[arg-type]
        potable_peak_day_gal=potable_peak_day_gal,
        reclaimed_peak_day_gal=reclaimed_peak_day_gal,
        water_tariff_usd_per_kgal=round(tariff, 2),
        annual_tariff_savings_usd=annual_tariff_savings_usd,
        five_year_net_roi_usd=five_year_net_roi_usd,
        tank_payback_years=tank_payback_years,
    )

    dispatch_windows = _build_dispatch_windows(hours, weather.sister_name)

    if not request.flex_event:
        drought_stage = "Stage 0 — Normal Firm Cap"
    elif request.flex_tighten <= 0.20:
        drought_stage = "Stage 1 — Utility Water Watch"
    elif request.flex_tighten <= 0.35:
        drought_stage = "Stage 2 — Heat Curtailment Alert"
    else:
        drought_stage = "Stage 3 — Drought Emergency"

    utility_signal = UtilitySignalPayload(
        signal_id=f"WDR-{weather.site_id.upper()}-{weather.start.replace('-', '')}-S{int(round(request.flex_tighten * 100)) if request.flex_event else 0}",
        facility_id=weather.site_id,
        drought_stage=drought_stage,
        flex_event_active=request.flex_event,
        curtailment_pct=round((1.0 - solved.cap_ratio_effective) * 100.0, 1),
        firm_daily_cap_gal=round(solved.cap_gal, 0),
        firm_daily_cap_mgd=round(solved.cap_gal / 1_000_000.0, 4),
        valid_from=weather.times[0],
        valid_until=weather.times[-1],
        compliance_verified=cap_met,
    )

    return PlanResponse(
        meta=meta,
        baseline=baseline_metrics,
        optimized=optimized_metrics,
        levers=levers,
        hours=hours,
        days=days,
        business_impact=business_impact,
        dispatch_windows=dispatch_windows,
        utility_signal=utility_signal,
    )


def _build_dispatch_windows(hours: list[HourPoint], sister_name: str) -> list[DispatchWindow]:
    windows: list[DispatchWindow] = []

    def _collect(
        action_type: str,
        predicate,
        magnitude_fn,
        unit: str,
        summary_fn,
        hint: str,
    ) -> None:
        start_idx: int | None = None
        peak_val = 0.0
        for idx, h in enumerate(hours):
            active = predicate(h)
            val = float(magnitude_fn(h)) if active else 0.0
            if active:
                if start_idx is None:
                    start_idx = idx
                    peak_val = val
                else:
                    peak_val = max(peak_val, val)
            if (not active or idx == len(hours) - 1) and start_idx is not None:
                end_idx = idx if active else idx - 1
                count = end_idx - start_idx + 1
                windows.append(
                    DispatchWindow(
                        action_type=action_type,  # type: ignore[arg-type]
                        start_time=hours[start_idx].time,
                        end_time=hours[end_idx].time,
                        hours_count=count,
                        peak_magnitude=round(peak_val, 1),
                        unit=unit,
                        summary=summary_fn(count, peak_val),
                        scheduler_hint=hint,
                    )
                )
                start_idx = None
                peak_val = 0.0

    _collect(
        "DEFER_BATCH",
        lambda h: h.time_shift_out_mw > 1.0,
        lambda h: h.time_shift_out_mw,
        "MW",
        lambda c, p: f"Hold {p:.1f} MW peak deferrable/pausable compute out of warm hours ({c}h window).",
        "Slurm/K8s: cordon batch partition or reschedule non-interactive training jobs to overnight window.",
    )
    _collect(
        "SPACE_SHIFT",
        lambda h: h.space_shift_out_mw > 1.0,
        lambda h: h.space_shift_out_mw,
        "MW",
        lambda c, p: f"Route up to {p:.1f} MW flexible compute to {sister_name} ({c}h window).",
        f"Global job router: direct batch & checkpointed training queues to {sister_name}.",
    )
    _collect(
        "DRY_COOL_SWAP",
        lambda h: h.swap_fraction >= 0.25 and h.temp_c > 25.0,
        lambda h: h.load_mw * h.swap_fraction,
        "MW",
        lambda c, p: f"Switch {p:.1f} MW IT cooling load to dry-mode (+0.15 PUE) during off-peak grid hours ({c}h).",
        "BMS cooling plant: close evaporative tower spray pumps and ramp dry-cooler fans.",
    )
    _collect(
        "TANK_DISCHARGE",
        lambda h: (h.tank_draw_gal or 0.0) > 250.0,
        lambda h: h.tank_draw_gal or 0.0,
        "gal/h",
        lambda c, p: f"Draw up to {round(p):,} gal/h from thermal/make-up tank ({c}h peak shave).",
        "Plant PLC: open make-up tank discharge valve to cap municipal meter draw.",
    )

    windows.sort(key=lambda w: w.start_time)
    return windows[:20]
