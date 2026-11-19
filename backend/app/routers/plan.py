"""Optimization endpoints: /v1/plan, /v1/sensitivity, /v1/sites, /v1/geocode, /v1/export/csv."""

from __future__ import annotations

import asyncio
import csv
import io
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.errors import DomainError
from app.schemas import (
    FleetCompareResponse,
    FleetSiteSummary,
    ForesightComparison,
    GeocodeResponse,
    GeocodeResult,
    PlanRequest,
    PlanResponse,
    SensitivityPoint,
    SensitivityResponse,
    TankSizingPoint,
    TankSizingResponse,
)
from app.services.grid import build_grid_series
from app.services.metrics import assemble_plan_response
from app.services.optimizer import solve_plan
from app.services.precomputed import match_fleet, match_tank
from app.services.weather import SITE_REGISTRY, geocode_city, load_weather
from app.services.workload import build_workload_schedule

router = APIRouter(prefix="/v1", tags=["optimizer"])

_SENS_CACHE: dict[tuple, tuple[float, SensitivityResponse]] = {}
_TANK_CACHE: dict[tuple, tuple[float, TankSizingResponse]] = {}
_FLEET_CACHE: dict[tuple, tuple[float, FleetCompareResponse]] = {}
_SENS_TTL_SEC = 1800.0
TANK_COST_USD_PER_GAL = 2.50

FLEET_BENCHMARKS = [
    ("phoenix", "2026-07-13", "2026-07-19", "United States", "EIA-930 AZPS profile"),
    ("northern-virginia", "2026-07-13", "2026-07-19", "United States", "EIA-930 PJM profile"),
    ("des-moines", "2026-07-13", "2026-07-19", "United States", "EIA-930 MISO profile"),
    ("queretaro", "2026-05-11", "2026-05-17", "Mexico", "Diurnal thermal"),
    ("santiago", "2026-01-19", "2026-01-25", "Chile", "Diurnal thermal"),
    ("zaragoza", "2026-07-13", "2026-07-19", "Spain", "Diurnal thermal"),
    ("hyderabad", "2026-05-11", "2026-05-17", "India", "Diurnal thermal"),
    ("dubai", "2026-07-20", "2026-07-26", "UAE", "Diurnal thermal"),
    ("lahore", "2026-06-08", "2026-06-14", "Pakistan", "Diurnal thermal"),
    ("karachi", "2026-05-25", "2026-05-31", "Pakistan", "Diurnal thermal"),
]


def _solve_single_sync(
    req: PlanRequest,
    weather,
    grid,
    allow_swap: bool = True,
    enforce_cap: bool = True,
    time_limit_sec: int | None = None,
    gap_rel: float | None = None,
    cbc_threads: int | None = None,
) -> PlanResponse:
    workload = build_workload_schedule(
        weather.times,
        flexible_share=req.flexible_share,
        it_capacity_mw=req.it_capacity_mw,
    )
    solved = solve_plan(
        weather=weather,
        grid=grid,
        workload=workload,
        tank_gallons=req.tank_gallons,
        cap_ratio=req.cap_ratio,
        flex_event=req.flex_event,
        flex_tighten=req.flex_tighten,
        plant_model=req.plant_model,
        it_capacity_mw=req.it_capacity_mw,
        coc=req.coc,
        allow_swap=allow_swap,
        enforce_cap=enforce_cap,
        lambda1=req.lambda1,
        lambda2=req.lambda2,
        lambda3=req.lambda3,
        time_limit_sec=time_limit_sec,
        gap_rel=gap_rel,
        cbc_threads=cbc_threads,
    )
    return assemble_plan_response(req, weather, grid, workload, solved)


def fleet_cache_key(request: PlanRequest) -> tuple:
    fleet_mode = "live_forecast" if request.foresight == "live_forecast" else "perfect"
    return (
        fleet_mode,
        request.live_days if fleet_mode == "live_forecast" else 2026,
        round(request.flexible_share, 3),
        round(request.tank_gallons, 0),
        round(request.cap_ratio, 3),
        bool(request.flex_event),
        round(request.flex_tighten, 3),
        request.plant_model,
        round(request.it_capacity_mw, 1),
        round(request.coc, 1),
        round(request.electricity_price_usd_per_mwh, 1),
        round(request.reclaimed_water_share, 3),
    )


def tank_cache_key(request: PlanRequest) -> tuple:
    custom_key = (
        f"{request.custom_site.name}:{request.custom_site.lat}:{request.custom_site.lon}"
        if request.custom_site
        else ""
    )
    return (
        request.site_id,
        custom_key,
        request.start,
        request.end,
        round(request.flexible_share, 3),
        request.plant_model,
        round(request.it_capacity_mw, 1),
        round(request.coc, 1),
        round(request.electricity_price_usd_per_mwh, 1),
        "live" if request.foresight == "live_forecast" else "hist",
    )


def run_tank_sweep(
    request: PlanRequest,
    weather,
    grid,
    *,
    time_limit_sec: int | None = None,
    gap_rel: float | None = None,
    cbc_threads: int | None = None,
    data_source: str = "computed",
    note: str = "",
) -> TankSizingResponse:
    volumes = [0.0, 20_000.0, 40_000.0, 80_000.0, 120_000.0, 160_000.0]
    points: list[TankSizingPoint] = []
    best_vol = 0.0
    best_net = -1e18
    foresight = "live_forecast" if request.foresight == "live_forecast" else "perfect"

    for vol in volumes:
        sub_req = request.model_copy(
            update={
                "tank_gallons": vol,
                "cap_ratio": 1.0,
                "flex_event": False,
                "foresight": foresight,
            }
        )
        plan = _solve_single_sync(
            sub_req,
            weather,
            grid,
            allow_swap=False,
            enforce_cap=False,
            time_limit_sec=time_limit_sec,
            gap_rel=gap_rel,
            cbc_threads=cbc_threads,
        )
        capex_mid = plan.business_impact.avoided_capex_mid_usd if plan.business_impact else 0.0
        build_cost = vol * TANK_COST_USD_PER_GAL
        net = capex_mid - build_cost
        if net > best_net:
            best_net = net
            best_vol = vol
        points.append(
            TankSizingPoint(
                tank_gallons=vol,
                peak_day_gal=plan.optimized.peak_day_gal,
                peak_cut_pct=round(plan.optimized.water_capacity_impact * 100.0, 2),
                extra_mwh=plan.optimized.extra_mwh,
                avoided_capex_mid_usd=round(capex_mid, 0),
                est_tank_build_cost_usd=round(build_cost, 0),
                net_capex_benefit_usd=round(net, 0),
            )
        )

    return TankSizingResponse(
        site_id=weather.site_id,
        site_name=weather.site_name,
        recommended_tank_gal=best_vol,
        tank_cost_per_gal_usd=TANK_COST_USD_PER_GAL,
        points=points,
        data_source=data_source,
        note=note,
    )


def run_fleet_sweep(
    request: PlanRequest,
    weathers,
    *,
    time_limit_sec: int | None = None,
    gap_rel: float | None = None,
    cbc_threads: int | None = None,
    workers: int = 1,
    data_source: str = "computed",
    note: str = "",
) -> FleetCompareResponse:
    fleet_mode = "live_forecast" if request.foresight == "live_forecast" else "perfect"

    def _one(item) -> tuple[FleetSiteSummary, int]:
        (s_id, _st, _en, country, grid_src), w = item
        g = build_grid_series(w.site_id, w.grid_ba, w.times, w.temp_c)
        sub_req = request.model_copy(
            update={
                "site_id": s_id,
                "start": w.start,
                "end": w.end,
                "foresight": fleet_mode,
                "custom_site": None,
                "water_tariff_usd_per_kgal": None,
            }
        )
        p = _solve_single_sync(
            sub_req,
            w,
            g,
            allow_swap=True,
            enforce_cap=True,
            time_limit_sec=time_limit_sec,
            gap_rel=gap_rel,
            cbc_threads=cbc_threads,
        )
        biz = p.business_impact
        summary = FleetSiteSummary(
            site_id=s_id,
            site_name=w.site_name,
            country=country,
            window=f"{w.start} to {w.end}",
            basin_stress_tier=biz.basin_stress_tier if biz else "High",
            grid_source=grid_src,
            baseline_peak_gal=p.baseline.peak_day_gal,
            optimized_peak_gal=p.optimized.peak_day_gal,
            peak_cut_pct=round(p.optimized.water_capacity_impact * 100.0, 1),
            peak_mgd_avoided=biz.peak_mgd_avoided if biz else 0.0,
            avoided_capex_low_usd=biz.avoided_capex_low_usd if biz else 0.0,
            avoided_capex_high_usd=biz.avoided_capex_high_usd if biz else 0.0,
            households_daily_water_protected=biz.households_daily_water_protected if biz else 0,
            extra_mwh=p.optimized.extra_mwh,
            humid_wet_bulb_hours=biz.humid_wet_bulb_hours if biz else 0,
            cap_met=p.meta.cap_met,
            wri_stress_score=biz.wri_stress_score if biz else 50,
            regulatory_framework=biz.regulatory_framework if biz else "",
            permit_shield_score=biz.permit_shield_score if biz else 80,
            eu_eed_rating=biz.eu_eed_rating if biz else "B",
            five_year_net_roi_usd=biz.five_year_net_roi_usd if biz else 0.0,
        )
        people = biz.people_daily_water_protected if biz else 0
        return summary, people

    pairs = list(zip(FLEET_BENCHMARKS, weathers))
    if workers > 1 and len(pairs) > 1:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            solved_sites = list(pool.map(_one, pairs))
    else:
        solved_sites = [_one(item) for item in pairs]

    summaries = [row[0] for row in solved_sites]
    tot_gal = 0.0
    tot_mgd = 0.0
    tot_hh = 0
    tot_ppl = 0
    tot_low = 0.0
    tot_high = 0.0
    tot_mwh = 0.0
    for summary, people in solved_sites:
        tot_gal += max(0.0, summary.baseline_peak_gal - summary.optimized_peak_gal)
        tot_mgd += summary.peak_mgd_avoided
        tot_hh += summary.households_daily_water_protected
        tot_ppl += people
        tot_low += summary.avoided_capex_low_usd
        tot_high += summary.avoided_capex_high_usd
        tot_mwh += summary.extra_mwh

    return FleetCompareResponse(
        total_peak_gal_saved=round(tot_gal, 0),
        total_mgd_avoided=round(tot_mgd, 4),
        total_households_protected=tot_hh,
        total_people_protected=tot_ppl,
        total_capex_low_usd=round(tot_low, 0),
        total_capex_high_usd=round(tot_high, 0),
        total_extra_mwh=round(tot_mwh, 1),
        sites=summaries,
        data_source=data_source,
        note=note,
    )


@router.get("/sites")
async def list_sites() -> dict:
    return {"sites": list(SITE_REGISTRY.values())}


@router.get("/geocode", response_model=GeocodeResponse)
async def search_cities(q: str = Query(min_length=2, max_length=80)) -> GeocodeResponse:
    items = await geocode_city(q)
    return GeocodeResponse(results=[GeocodeResult(**item) for item in items])


@router.post("/plan", response_model=PlanResponse)
async def create_plan(request: PlanRequest) -> PlanResponse:
    weather = await load_weather(
        site_id=request.site_id,
        start=request.start,
        end=request.end,
        foresight=request.foresight,
        custom_site=request.custom_site,
        live_days=request.live_days,
    )
    grid = build_grid_series(weather.site_id, weather.grid_ba, weather.times, weather.temp_c)
    return await asyncio.to_thread(_solve_single_sync, request, weather, grid, True, True)


@router.post("/sensitivity", response_model=SensitivityResponse)
async def create_sensitivity(request: PlanRequest) -> SensitivityResponse:
    custom_key = (
        f"{request.custom_site.name}:{request.custom_site.lat}:{request.custom_site.lon}"
        if request.custom_site
        else ""
    )
    cache_key = (
        request.site_id,
        custom_key,
        request.start,
        request.end,
        round(request.tank_gallons, 0),
        round(request.flexible_share, 3),
        request.plant_model,
        round(request.it_capacity_mw, 1),
        round(request.coc, 1),
        request.live_days if request.foresight == "live_forecast" else "hist",
    )
    now = time.monotonic()
    cached = _SENS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _SENS_TTL_SEC:
        return cached[1]

    # Perfect / live weather bundle
    perfect_mode = "live_forecast" if request.foresight == "live_forecast" else "perfect"
    weather_perfect = await load_weather(
        site_id=request.site_id,
        start=request.start,
        end=request.end,
        foresight=perfect_mode,
        custom_site=request.custom_site,
        live_days=request.live_days,
    )
    grid = build_grid_series(
        weather_perfect.site_id, weather_perfect.grid_ba, weather_perfect.times, weather_perfect.temp_c
    )

    if perfect_mode == "live_forecast":
        weather_forecast = weather_perfect
    else:
        weather_forecast = await load_weather(
            site_id=request.site_id,
            start=request.start,
            end=request.end,
            foresight="historical_forecast",
            custom_site=request.custom_site,
        )

    def _run_sweep() -> SensitivityResponse:
        shares = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]
        points: list[SensitivityPoint] = []
        perfect_at_req: PlanResponse | None = None

        for sh in shares:
            sub_req = request.model_copy(
                update={
                    "flexible_share": sh,
                    "cap_ratio": 1.0,
                    "flex_event": False,
                    "foresight": perfect_mode,
                }
            )
            plan = _solve_single_sync(sub_req, weather_perfect, grid, allow_swap=False, enforce_cap=False)
            points.append(
                SensitivityPoint(
                    flexible_share=sh,
                    peak_cut_pct=round(plan.optimized.water_capacity_impact * 100.0, 2),
                    extra_mwh=plan.optimized.extra_mwh,
                    peak_day_gal=plan.optimized.peak_day_gal,
                )
            )
            if abs(sh - request.flexible_share) < 1e-4:
                perfect_at_req = plan

        if perfect_at_req is None:
            sub_req = request.model_copy(
                update={"cap_ratio": 1.0, "flex_event": False, "foresight": perfect_mode}
            )
            perfect_at_req = _solve_single_sync(
                sub_req, weather_perfect, grid, allow_swap=False, enforce_cap=False
            )

        if perfect_mode == "live_forecast":
            forecast_plan = perfect_at_req
            note = "Live 72h forecast mode active; forecast accuracy backtest uses historical weeks."
            label = "CBC MILP sensitivity (swaps off). Live 72h forecast curve."
        else:
            f_req = request.model_copy(
                update={"cap_ratio": 1.0, "flex_event": False, "foresight": "historical_forecast"}
            )
            forecast_plan = _solve_single_sync(
                f_req, weather_forecast, grid, allow_swap=False, enforce_cap=False
            )
            note = (
                "Decisions for the forecast case used the Open-Meteo Historical Forecast issued ahead of each hour; "
                "water was scored on Open-Meteo Archive Actuals."
            )
            label = (
                "CBC MILP sensitivity (swaps off). Forecast series is the real Open-Meteo Historical Forecast, "
                "scored on Archive Actuals."
            )

        return SensitivityResponse(
            sample=bool(perfect_at_req.meta.sample),
            label=label,
            swaps_included=False,
            points=points,
            foresight=ForesightComparison(
                flexible_share=request.flexible_share,
                perfect_peak_cut_pct=round(perfect_at_req.optimized.water_capacity_impact * 100.0, 2),
                forecast_peak_cut_pct=round(forecast_plan.optimized.water_capacity_impact * 100.0, 2),
                perfect_peak_day_gal=perfect_at_req.optimized.peak_day_gal,
                forecast_peak_day_gal=forecast_plan.optimized.peak_day_gal,
                note=note,
            ),
        )

    result = await asyncio.to_thread(_run_sweep)
    _SENS_CACHE[cache_key] = (now, result)
    return result


@router.post("/export/csv")
async def export_plan_csv(request: PlanRequest) -> StreamingResponse:
    plan = await create_plan(request)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "time_local",
            "dry_bulb_c",
            "wet_bulb_c",
            "rh_pct",
            "sister_temp_c",
            "baseline_it_mw",
            "optimized_it_mw",
            "fixed_mw",
            "deferrable_mw",
            "pausable_mw",
            "time_shift_in_mw",
            "time_shift_out_mw",
            "space_shift_out_mw",
            "sister_added_mw",
            "cooling_mode",
            "swap_fraction",
            "baseline_water_gal",
            "plant_consumption_gal",
            "utility_withdrawal_gal",
            "tank_level_gal",
            "tank_fill_gal",
            "tank_draw_gal",
            "grid_demand_mw",
            "grid_stress",
            "grid_peak",
        ]
    )
    for h in plan.hours:
        writer.writerow(
            [
                h.time,
                h.temp_c,
                h.wet_bulb_c,
                h.rh_pct,
                h.sister_temp_c,
                h.baseline_load_mw,
                h.load_mw,
                h.fixed_mw,
                h.deferrable_mw,
                h.pausable_mw,
                h.time_shift_in_mw,
                h.time_shift_out_mw,
                h.space_shift_out_mw,
                h.sister_added_mw,
                h.cooling_mode,
                h.swap_fraction,
                h.baseline_water_gal,
                h.consumption_gal,
                h.utility_gal,
                h.tank_level_gal,
                h.tank_fill_gal,
                h.tank_draw_gal,
                "" if h.grid_demand_mw is None else h.grid_demand_mw,
                h.grid_stress,
                h.grid_peak,
            ]
        )

    buf.seek(0)
    filename = f"thirstcap_{plan.meta.site_id}_{plan.meta.start}_{plan.meta.end}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _remember(cache: dict, key: tuple, value):
    cache[key] = (time.monotonic(), value)
    return value


@router.post("/tank-sizing", response_model=TankSizingResponse)
async def create_tank_sizing(request: PlanRequest) -> TankSizingResponse:
    cache_key = tank_cache_key(request)
    now = time.monotonic()
    cached = _TANK_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _SENS_TTL_SEC:
        return cached[1]

    precomputed = match_tank(request)
    if precomputed is not None:
        return _remember(_TANK_CACHE, cache_key, precomputed)

    settings = get_settings()
    weather = await load_weather(
        site_id=request.site_id,
        start=request.start,
        end=request.end,
        foresight="live_forecast" if request.foresight == "live_forecast" else "perfect",
        custom_site=request.custom_site,
        live_days=request.live_days,
    )
    grid = build_grid_series(weather.site_id, weather.grid_ba, weather.times, weather.temp_c)
    result = await asyncio.to_thread(
        run_tank_sweep,
        request,
        weather,
        grid,
        time_limit_sec=settings.cbc_sweep_time_limit_sec,
        gap_rel=settings.cbc_sweep_gap_rel,
        cbc_threads=settings.cbc_sweep_threads,
        note="Computed on demand with a 4s CBC budget per window (1.5% gap, 1 thread).",
    )
    return _remember(_TANK_CACHE, cache_key, result)


@router.post("/fleet-compare", response_model=FleetCompareResponse)
async def create_fleet_compare(request: PlanRequest) -> FleetCompareResponse:
    cache_key = fleet_cache_key(request)
    now = time.monotonic()
    cached = _FLEET_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _SENS_TTL_SEC:
        return cached[1]

    precomputed = match_fleet(request)
    if precomputed is not None:
        return _remember(_FLEET_CACHE, cache_key, precomputed)

    settings = get_settings()
    fleet_mode = "live_forecast" if request.foresight == "live_forecast" else "perfect"
    try:
        weathers = await asyncio.wait_for(
            asyncio.gather(
                *[
                    load_weather(
                        site_id=s_id,
                        start=st,
                        end=en,
                        foresight=fleet_mode,
                        live_days=request.live_days,
                    )
                    for s_id, st, en, _, _ in FLEET_BENCHMARKS
                ]
            ),
            timeout=12.0,
        )
    except asyncio.TimeoutError as exc:
        raise DomainError(
            503,
            "fleet_timeout",
            "Fleet weather fetch exceeded 12s. Default controls are served from the precomputed 2026 summer run; this control set has no stored result.",
        ) from exc

    result = await asyncio.to_thread(
        run_fleet_sweep,
        request,
        weathers,
        time_limit_sec=settings.cbc_sweep_time_limit_sec,
        gap_rel=settings.cbc_sweep_gap_rel,
        cbc_threads=settings.cbc_sweep_threads,
        workers=2,
        note="Computed on demand with a 4s CBC budget per window (1.5% gap, 1 thread).",
    )
    return _remember(_FLEET_CACHE, cache_key, result)
