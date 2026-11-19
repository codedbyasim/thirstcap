"""Rolling-horizon PuLP CBC MILP optimizer for joint compute shifting, cooling swaps, and tank dispatch."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Literal
import pulp

from app.config import get_settings
from app.errors import DomainError
from app.services.grid import GridSeries
from app.services.plant import (
    PlantCoefficients,
    gallons_for_load,
    hourly_coefficients,
    optimal_tank_dispatch,
)
from app.services.weather import WeatherBundle
from app.services.workload import WorkloadSchedule

ADVANCE_H = 18
DELAY_H = 24
WINDOW_H = 72
COMMIT_H = 24


@dataclass
class SolvedPlan:
    baseline_water_gal: list[float]
    scheduled_water_gal: list[float]
    consumption_gal: list[float]
    utility_gal: list[float]
    local_mw: list[float]
    time_shift_in_mw: list[float]
    time_shift_out_mw: list[float]
    space_shift_out_mw: list[float]
    sister_added_mw: list[float]
    swap_fraction: list[float]
    cooling_mode: list[Literal["dry", "evaporative", "swap"]]
    tank_level_gal: list[float]
    tank_fill_gal: list[float]
    tank_draw_gal: list[float]
    extra_mwh_hourly: list[float]
    time_shift_mwh: float
    space_shift_mwh: float
    delay_mwh_h: float
    abs_shift_mwh_h: float
    sister_added_gal: float
    sister_baseline_peak_gal: float
    sister_peak_with_shift_gal: float
    peak_after_tank_gal: float
    cap_gal: float
    cap_ratio_effective: float
    solver_status: str
    solve_time_ms: int
    cbc_produced: bool


def _solve_rolling_window(
    w0: int,
    w1: int,
    commit_end: int,
    n_total: int,
    it_cap: float,
    fixed_mw: list[float],
    rem_flex: list[float],
    precommitted_pri: list[float],
    precommitted_sis: list[float],
    sister_base_mw: list[float],
    pri_coeff: list[PlantCoefficients],
    sis_coeff: list[PlantCoefficients],
    grid_peak: list[bool],
    init_tank_gal: float,
    tank_cap_gal: float,
    baseline_peak_gal: float,
    sister_cap_gal: float,
    cap_gal: float | None,
    allow_swap: bool,
    lambda1: float,
    lambda2: float,
    lambda3: float,
    time_limit_sec: int,
    allow_cap_slack: bool,
    gap_rel: float | None = None,
    cbc_threads: int | None = None,
) -> dict:
    """Solve one rolling horizon [w0, w1) with PuLP CBC."""
    hours = list(range(w0, w1))
    # Days touched by this window (grouping every 24h chunk in [w0, w1))
    day_groups: list[list[int]] = []
    for pos in range(0, len(hours), 24):
        day_groups.append(hours[pos : pos + 24])

    # Eligible arrivals: any arrival a whose -18..+24 window overlaps [w0, w1) and has remaining flex > 0
    arrivals = [
        a
        for a in range(max(0, w0 - DELAY_H), min(n_total, w1 + ADVANCE_H))
        if rem_flex[a] > 1e-6
    ]

    prob = pulp.LpProblem(f"ThirstCap_w{w0}", pulp.LpMinimize)

    # Decision variables for flexible load placement
    x_pri: dict[tuple[int, int], pulp.LpVariable] = {}
    x_sis: dict[tuple[int, int], pulp.LpVariable] = {}
    arr_arcs: dict[int, list[int]] = {a: [] for a in arrivals}

    for a in arrivals:
        t_min = max(w0, a - ADVANCE_H)
        t_max = min(w1 - 1, a + DELAY_H)
        for t in range(t_min, t_max + 1):
            arr_arcs[a].append(t)
            x_pri[(a, t)] = pulp.LpVariable(f"xp_{a}_{t}", lowBound=0.0, upBound=it_cap)
            x_sis[(a, t)] = pulp.LpVariable(f"xs_{a}_{t}", lowBound=0.0, upBound=it_cap)

    # Hourly plant & tank variables
    p_evap = {t: pulp.LpVariable(f"pe_{t}", lowBound=0.0, upBound=it_cap) for t in hours}
    p_dry = {t: pulp.LpVariable(f"pd_{t}", lowBound=0.0, upBound=it_cap) for t in hours}
    sis_add = {t: pulp.LpVariable(f"sa_{t}", lowBound=0.0, upBound=it_cap) for t in hours}

    fill = {t: pulp.LpVariable(f"fl_{t}", lowBound=0.0, upBound=tank_cap_gal) for t in hours}
    draw = {t: pulp.LpVariable(f"dr_{t}", lowBound=0.0, upBound=tank_cap_gal) for t in hours}
    level = {t: pulp.LpVariable(f"lv_{t}", lowBound=0.0, upBound=tank_cap_gal) for t in hours}
    util = {t: pulp.LpVariable(f"ut_{t}", lowBound=0.0) for t in hours}

    p_peak = pulp.LpVariable("P_peak", lowBound=0.0)
    g_peak = pulp.LpVariable("G_peak", lowBound=0.0)
    slacks = (
        {d_idx: pulp.LpVariable(f"sl_{d_idx}", lowBound=0.0) for d_idx in range(len(day_groups))}
        if allow_cap_slack
        else {}
    )

    # Arrival conservation constraints:
    # - Arrivals inside [w0, w1) must serve ALL their remaining flex inside this window (guaranteed feasible if window ends >= a)
    #   Wait: if a >= w1 - DELAY_H and w1 < n_total, arrival a could partially defer past w1!
    #   To keep future windows feasible without forcing premature local run, allow an unserved carryover ONLY for arrivals in (commit_end, w1) or near w1?
    #   Better: for arrivals a < commit_end, 100% of rem_flex[a] MUST be served inside [w0, w1).
    #   For arrivals a >= commit_end (and inside [w0, w1)), serve inside [w0, w1) as well — wait: for a in [w0, w1), t_max = min(w1-1, a+24).
    #   If a < w1 - 24, full +24h window is inside [w0, w1). If a >= w1 - 24 (last 24h of a non-final 72h window), still feasible to serve within [w0, w1-1]
    #   because [a-18, w1-1] has >= 18 hours available! And for arrivals a >= w1 (up to w1 + 17 advancing into w1 - 1), they only optionally advance <= rem_flex[a].
    for a in arrivals:
        ts = arr_arcs[a]
        if not ts:
            continue
        expr = pulp.lpSum(x_pri[(a, t)] + x_sis[(a, t)] for t in ts)
        if w0 <= a < w1:
            prob += expr == rem_flex[a], f"arr_eq_{a}"
        else:
            # Future arrival beyond w1 may optionally advance into [w0, w1)
            prob += expr <= rem_flex[a], f"arr_le_{a}"

    # Hourly balance & capacity constraints
    pri_by_t: dict[int, list[pulp.LpVariable]] = {t: [] for t in hours}
    sis_by_t: dict[int, list[pulp.LpVariable]] = {t: [] for t in hours}
    for (a, t), var in x_pri.items():
        pri_by_t[t].append(var)
    for (a, t), var in x_sis.items():
        sis_by_t[t].append(var)

    for idx, t in enumerate(hours):
        c = pri_coeff[t]
        local_it = fixed_mw[t] + precommitted_pri[t] + pulp.lpSum(pri_by_t[t])
        prob += p_evap[t] + p_dry[t] == local_it, f"mode_sum_{t}"
        prob += p_evap[t] + p_dry[t] <= it_cap, f"pri_cap_{t}"
        if (not allow_swap) or c.natural_dry:
            prob += p_dry[t] == 0.0, f"no_swap_{t}"

        prob += sis_add[t] == precommitted_sis[t] + pulp.lpSum(sis_by_t[t]), f"sis_sum_{t}"
        prob += sister_base_mw[t] + sis_add[t] <= it_cap, f"sis_cap_{t}"

        cons_t = c.evap_gal_per_mwh * p_evap[t] + c.dry_gal_per_mwh * p_dry[t]
        prob += util[t] == cons_t - draw[t] + fill[t], f"util_bal_{t}"

        prev_lvl = init_tank_gal if idx == 0 else level[hours[idx - 1]]
        prob += level[t] == prev_lvl + fill[t] - draw[t], f"tank_bal_{t}"
        if tank_cap_gal <= 0.0:
            prob += fill[t] == 0.0, f"no_fill_{t}"
            prob += draw[t] == 0.0, f"no_draw_{t}"

        if grid_peak[t] and not c.natural_dry and allow_swap:
            prob += c.extra_mw_per_dry_mw * p_dry[t] <= g_peak, f"gpeak_{t}"

    # Daily constraints
    for d_idx, d_hours in enumerate(day_groups):
        daily_u = pulp.lpSum(util[t] for t in d_hours)
        prob += daily_u <= p_peak, f"day_peak_{d_idx}"
        if cap_gal is not None:
            if allow_cap_slack:
                prob += daily_u <= cap_gal + slacks[d_idx], f"day_cap_{d_idx}"
            else:
                prob += daily_u <= cap_gal, f"day_cap_{d_idx}"

        # Sister daily cap guardrail (1.10 * sister baseline peak)
        sis_daily = pulp.lpSum(
            sis_coeff[t].evap_gal_per_mwh * (sister_base_mw[t] + sis_add[t]) for t in d_hours
        )
        prob += sis_daily <= sister_cap_gal, f"sis_daily_cap_{d_idx}"

    # Objective function (BACKEND.md section 5)
    norm_peak = max(1.0, baseline_peak_gal)
    it_mwh_win = max(1.0, sum(fixed_mw[t] + rem_flex[t] for t in hours))
    extra_mwh_expr = pulp.lpSum(pri_coeff[t].extra_mw_per_dry_mw * p_dry[t] for t in hours)
    delay_mwh_h_expr = pulp.lpSum(
        (t - a) * (x_pri[(a, t)] + x_sis[(a, t)])
        for (a, t) in x_pri
        if t > a
    )
    mean_delay_h = (1.0 / it_mwh_win) * delay_mwh_h_expr
    total_cons_expr = pulp.lpSum(
        pri_coeff[t].evap_gal_per_mwh * p_evap[t] + pri_coeff[t].dry_gal_per_mwh * p_dry[t]
        for t in hours
    )
    total_tank_flow = pulp.lpSum(fill[t] + draw[t] for t in hours)

    daily_it_mwh = max(1.0, 24.0 * 0.70 * it_cap)
    obj = (
        (0.05 / norm_peak) * p_peak
        + (lambda1 * 10.0 / daily_it_mwh) * extra_mwh_expr
        + (lambda2 * 10.0 / max(1.0, it_cap)) * g_peak
        + (lambda3 / 24.0) * mean_delay_h
        + (1e-4 / norm_peak) * total_cons_expr
        + (1e-5 / norm_peak) * total_tank_flow
    )
    if allow_cap_slack and slacks:
        obj += (500.0 / max(1.0, cap_gal or norm_peak)) * pulp.lpSum(slacks[d] for d in slacks)

    prob += obj

    solver_kwargs: dict = {"timeLimit": time_limit_sec, "msg": False}
    if gap_rel is not None:
        solver_kwargs["gapRel"] = gap_rel
    if cbc_threads is not None:
        solver_kwargs["threads"] = cbc_threads
    solver = pulp.PULP_CBC_CMD(**solver_kwargs)
    status_code = prob.solve(solver)
    status_str = pulp.LpStatus.get(status_code, "Unknown")

    if status_str not in ("Optimal", "Not Solved") or (
        status_str == "Not Solved" and pulp.value(p_peak) is None
    ):
        return {"ok": False, "status": status_str}
    if status_code in (pulp.LpStatusInfeasible, pulp.LpStatusUnbounded, pulp.LpStatusUndefined):
        return {"ok": False, "status": status_str}

    # Extract window values
    res_xp = {k: max(0.0, float(pulp.value(v) or 0.0)) for k, v in x_pri.items()}
    res_xs = {k: max(0.0, float(pulp.value(v) or 0.0)) for k, v in x_sis.items()}
    res_pe = {t: max(0.0, float(pulp.value(p_evap[t]) or 0.0)) for t in hours}
    res_pd = {t: max(0.0, float(pulp.value(p_dry[t]) or 0.0)) for t in hours}
    res_fl = {t: max(0.0, float(pulp.value(fill[t]) or 0.0)) for t in hours}
    res_dr = {t: max(0.0, float(pulp.value(draw[t]) or 0.0)) for t in hours}
    res_lv = {t: max(0.0, float(pulp.value(level[t]) or 0.0)) for t in hours}
    res_ut = {t: max(0.0, float(pulp.value(util[t]) or 0.0)) for t in hours}

    return {
        "ok": True,
        "status": status_str,
        "x_pri": res_xp,
        "x_sis": res_xs,
        "p_evap": res_pe,
        "p_dry": res_pd,
        "fill": res_fl,
        "draw": res_dr,
        "level": res_lv,
        "util": res_ut,
    }


def solve_plan(
    weather: WeatherBundle,
    grid: GridSeries,
    workload: WorkloadSchedule,
    tank_gallons: float,
    cap_ratio: float,
    flex_event: bool,
    flex_tighten: float,
    plant_model: Literal["physical", "toy"] = "physical",
    it_capacity_mw: float = 100.0,
    coc: float = 4.0,
    allow_swap: bool = True,
    enforce_cap: bool = True,
    lambda1: float | None = None,
    lambda2: float | None = None,
    lambda3: float | None = None,
    time_limit_sec: int | None = None,
    gap_rel: float | None = None,
    cbc_threads: int | None = None,
) -> SolvedPlan:
    t0 = time.perf_counter()
    settings = get_settings()
    cbc_limit = settings.cbc_time_limit_sec if time_limit_sec is None else int(time_limit_sec)
    l1 = settings.lambda1 if lambda1 is None else lambda1
    l2 = settings.lambda2 if lambda2 is None else lambda2
    l3 = settings.lambda3 if lambda3 is None else lambda3

    n = len(weather.times)
    days_count = n // 24

    # Actual coefficients (always used to score physical water & baseline)
    actual_pri_coeff = [
        hourly_coefficients(
            weather.temp_c[i],
            weather.wet_bulb_c[i],
            plant_model=plant_model,
            coc=coc,
        )
        for i in range(n)
    ]
    actual_sis_coeff = [
        hourly_coefficients(
            weather.sister_temp_c[i],
            weather.sister_wet_bulb_c[i],
            plant_model=plant_model,
            coc=coc,
        )
        for i in range(n)
    ]

    # Decision coefficients (equal to actual unless foresight == historical_forecast)
    dec_pri_coeff = [
        hourly_coefficients(
            weather.decision_temp_c[i],
            weather.decision_wet_bulb_c[i],
            plant_model=plant_model,
            coc=coc,
        )
        for i in range(n)
    ]
    dec_sis_coeff = [
        hourly_coefficients(
            weather.decision_sister_temp_c[i],
            weather.decision_sister_wet_bulb_c[i],
            plant_model=plant_model,
            coc=coc,
        )
        for i in range(n)
    ]

    # Uncontrolled baseline on actual temperatures
    base_loads = workload.baseline_total_mw
    baseline_water_gal = [
        gallons_for_load(
            base_loads[i],
            weather.temp_c[i],
            weather.wet_bulb_c[i],
            0.0,
            plant_model=plant_model,
            coc=coc,
        )
        for i in range(n)
    ]
    baseline_daily = [sum(baseline_water_gal[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    baseline_peak = max(baseline_daily) if baseline_daily else 0.0

    # Sister baseline & cap (scored on decision temps inside solver, actual temps for final report)
    dec_sis_base_gal = [
        dec_sis_coeff[i].evap_gal_per_mwh * base_loads[i] for i in range(n)
    ]
    dec_sis_peak = max(sum(dec_sis_base_gal[d * 24 : (d + 1) * 24]) for d in range(days_count))
    sister_cap_gal = max(1.0, settings.sister_cap_ratio * dec_sis_peak)

    actual_sis_base_gal = [
        actual_sis_coeff[i].evap_gal_per_mwh * base_loads[i] for i in range(n)
    ]
    sister_baseline_peak = max(sum(actual_sis_base_gal[d * 24 : (d + 1) * 24]) for d in range(days_count))

    tighten = flex_tighten if flex_event else 0.0
    cap_ratio_eff = min(1.0, max(0.40, cap_ratio)) * (1.0 - min(0.80, max(0.0, tighten)))
    cap_gal = baseline_peak * cap_ratio_eff
    solver_cap = cap_gal if enforce_cap else None

    # Rolling state
    fixed = workload.fixed_mw
    rem_flex = [workload.deferrable_mw[i] + workload.pausable_mw[i] for i in range(n)]
    pre_pri = [0.0] * n
    pre_sis = [0.0] * n

    final_local_mw = [0.0] * n
    final_sis_add_mw = [0.0] * n
    final_time_in = [0.0] * n
    final_time_out = [0.0] * n
    final_space_out = [0.0] * n
    final_swap_frac = [0.0] * n
    final_tank_fill = [0.0] * n
    final_tank_draw = [0.0] * n
    final_tank_level = [0.0] * n

    time_shift_mwh = 0.0
    space_shift_mwh = 0.0
    delay_mwh_h = 0.0
    abs_shift_mwh_h = 0.0
    statuses: list[str] = []

    tank_lvl = float(tank_gallons)
    w0 = 0
    while w0 < n:
        w1 = min(n, w0 + WINDOW_H)
        commit_end = w1 if w1 == n else min(n, w0 + COMMIT_H)

        sol = _solve_rolling_window(
            w0=w0,
            w1=w1,
            commit_end=commit_end,
            n_total=n,
            it_cap=it_capacity_mw,
            fixed_mw=fixed,
            rem_flex=rem_flex,
            precommitted_pri=pre_pri,
            precommitted_sis=pre_sis,
            sister_base_mw=base_loads,
            pri_coeff=dec_pri_coeff,
            sis_coeff=dec_sis_coeff,
            grid_peak=grid.grid_peak,
            init_tank_gal=tank_lvl,
            tank_cap_gal=tank_gallons,
            baseline_peak_gal=baseline_peak,
            sister_cap_gal=sister_cap_gal,
            cap_gal=solver_cap,
            allow_swap=allow_swap,
            lambda1=l1,
            lambda2=l2,
            lambda3=l3,
            time_limit_sec=cbc_limit,
            allow_cap_slack=False,
            gap_rel=gap_rel,
            cbc_threads=cbc_threads,
        )
        if not sol["ok"] and solver_cap is not None:
            sol = _solve_rolling_window(
                w0=w0,
                w1=w1,
                commit_end=commit_end,
                n_total=n,
                it_cap=it_capacity_mw,
                fixed_mw=fixed,
                rem_flex=rem_flex,
                precommitted_pri=pre_pri,
                precommitted_sis=pre_sis,
                sister_base_mw=base_loads,
                pri_coeff=dec_pri_coeff,
                sis_coeff=dec_sis_coeff,
                grid_peak=grid.grid_peak,
                init_tank_gal=tank_lvl,
                tank_cap_gal=tank_gallons,
                baseline_peak_gal=baseline_peak,
                sister_cap_gal=sister_cap_gal,
                cap_gal=solver_cap,
                allow_swap=allow_swap,
                lambda1=l1,
                lambda2=l2,
                lambda3=l3,
                time_limit_sec=cbc_limit,
                allow_cap_slack=True,
                gap_rel=gap_rel,
                cbc_threads=cbc_threads,
            )

        if not sol["ok"]:
            raise DomainError(
                500,
                "solver_error",
                f"CBC MILP solver failed on window [{w0}, {w1}) with status '{sol['status']}'.",
                {"window_start": w0, "status": sol["status"]},
            )

        statuses.append(sol["status"])

        # Commit flows landing in [w0, commit_end) and remaining flows of arrivals in [w0, commit_end)
        for (a, t), mw in sol["x_pri"].items():
            if mw <= 1e-8:
                continue
            if w0 <= t < commit_end:
                rem_flex[a] = max(0.0, rem_flex[a] - mw)
                final_local_mw[t] += mw
                if t != a:
                    time_shift_mwh += mw
                    final_time_out[a] += mw
                    final_time_in[t] += mw
                    abs_shift_mwh_h += mw * abs(t - a)
                    delay_mwh_h += mw * max(0, t - a)
            elif w0 <= a < commit_end and t >= commit_end:
                rem_flex[a] = max(0.0, rem_flex[a] - mw)
                pre_pri[t] += mw
                if t != a:
                    time_shift_mwh += mw
                    final_time_out[a] += mw
                    final_time_in[t] += mw
                    abs_shift_mwh_h += mw * abs(t - a)
                    delay_mwh_h += mw * max(0, t - a)

        for (a, t), mw in sol["x_sis"].items():
            if mw <= 1e-8:
                continue
            if w0 <= t < commit_end:
                rem_flex[a] = max(0.0, rem_flex[a] - mw)
                final_sis_add_mw[t] += mw
                final_space_out[a] += mw
                space_shift_mwh += mw
                abs_shift_mwh_h += mw * abs(t - a)
                delay_mwh_h += mw * max(0, t - a)
            elif w0 <= a < commit_end and t >= commit_end:
                rem_flex[a] = max(0.0, rem_flex[a] - mw)
                pre_sis[t] += mw
                final_space_out[a] += mw
                space_shift_mwh += mw
                abs_shift_mwh_h += mw * abs(t - a)
                delay_mwh_h += mw * max(0, t - a)

        for t in range(w0, commit_end):
            final_local_mw[t] += fixed[t] + pre_pri[t]
            final_sis_add_mw[t] += pre_sis[t]
            pe = sol["p_evap"][t]
            pd = sol["p_dry"][t]
            tot_mode = pe + pd
            final_swap_frac[t] = (pd / tot_mode) if tot_mode > 1e-6 else 0.0
            final_tank_fill[t] = sol["fill"][t]
            final_tank_draw[t] = sol["draw"][t]
            final_tank_level[t] = sol["level"][t]
            tank_lvl = final_tank_level[t]

        if commit_end >= n:
            break
        w0 += COMMIT_H

    # Evaluate final physical consumption & utility withdrawal on ACTUAL weather
    scheduled_water_gal: list[float] = []
    consumption_gal: list[float] = []
    utility_gal: list[float] = []
    extra_mwh_hourly: list[float] = []
    cooling_mode: list[Literal["dry", "evaporative", "swap"]] = []

    lvl_actual = float(tank_gallons)
    for t in range(n):
        c = actual_pri_coeff[t]
        sched_g = c.evap_gal_per_mwh * final_local_mw[t]
        scheduled_water_gal.append(sched_g)

        sf = 0.0 if c.natural_dry else min(1.0, max(0.0, final_swap_frac[t]))
        final_swap_frac[t] = sf
        cons_g = gallons_for_load(
            final_local_mw[t],
            weather.temp_c[t],
            weather.wet_bulb_c[t],
            sf,
            plant_model=plant_model,
            coc=coc,
        )
        consumption_gal.append(cons_g)
        extra_mwh_hourly.append(c.extra_mw_per_dry_mw * final_local_mw[t] * sf)

        if c.natural_dry:
            cooling_mode.append("dry")
        elif sf >= 0.5:
            cooling_mode.append("swap")
        else:
            cooling_mode.append("evaporative")

        # Keep tank balance physically safe when forecast differed from actuals
        fl_t = min(final_tank_fill[t], max(0.0, tank_gallons - lvl_actual))
        dr_t = min(final_tank_draw[t], lvl_actual + fl_t, cons_g + fl_t)
        lvl_actual = lvl_actual + fl_t - dr_t
        util_t = max(0.0, cons_g - dr_t + fl_t)
        final_tank_fill[t] = fl_t
        final_tank_draw[t] = dr_t
        final_tank_level[t] = lvl_actual
        utility_gal.append(util_t)

    scheduled_daily = [sum(scheduled_water_gal[d * 24 : (d + 1) * 24]) for d in range(days_count)]
    peak_after_tank_gal, _, _ = optimal_tank_dispatch(scheduled_daily, tank_gallons)

    sister_added_gal_hourly = [
        actual_sis_coeff[t].evap_gal_per_mwh * final_sis_add_mw[t] for t in range(n)
    ]
    sister_with_daily = [
        sum(
            actual_sis_coeff[t].evap_gal_per_mwh * (base_loads[t] + final_sis_add_mw[t])
            for t in range(d * 24, (d + 1) * 24)
        )
        for d in range(days_count)
    ]

    solve_ms = int((time.perf_counter() - t0) * 1000)
    worst_status = "Optimal" if all(s == "Optimal" for s in statuses) else statuses[0]

    return SolvedPlan(
        baseline_water_gal=baseline_water_gal,
        scheduled_water_gal=scheduled_water_gal,
        consumption_gal=consumption_gal,
        utility_gal=utility_gal,
        local_mw=final_local_mw,
        time_shift_in_mw=final_time_in,
        time_shift_out_mw=final_time_out,
        space_shift_out_mw=final_space_out,
        sister_added_mw=final_sis_add_mw,
        swap_fraction=final_swap_frac,
        cooling_mode=cooling_mode,
        tank_level_gal=final_tank_level,
        tank_fill_gal=final_tank_fill,
        tank_draw_gal=final_tank_draw,
        extra_mwh_hourly=extra_mwh_hourly,
        time_shift_mwh=time_shift_mwh,
        space_shift_mwh=space_shift_mwh,
        delay_mwh_h=delay_mwh_h,
        abs_shift_mwh_h=abs_shift_mwh_h,
        sister_added_gal=sum(sister_added_gal_hourly),
        sister_baseline_peak_gal=sister_baseline_peak,
        sister_peak_with_shift_gal=max(sister_with_daily) if sister_with_daily else 0.0,
        peak_after_tank_gal=peak_after_tank_gal,
        cap_gal=cap_gal,
        cap_ratio_effective=cap_ratio_eff,
        solver_status=worst_status,
        solve_time_ms=solve_ms,
        cbc_produced=True,
    )
