/**
 * SAMPLE planner.
 *
 * It is not the MILP. It exists so the dashboard runs before the FastAPI
 * service does. Temperatures are real Open-Meteo hours. Water uses the toy
 * cooling curve from the project brief (11 Nov 2026):
 *
 *   evaporative assist starts at 25°C dry-bulb and rises linearly
 *   to 1.8 L/kWh at 40°C. Above 40°C the same slope continues.
 *   Turning evaporation off costs +0.15 PUE.
 *   IT plant: 100 MW capacity, 70 MW flat average.
 *
 * The search moves the flexible slice toward cooler hours or a cooler sister
 * hour, then uses the tank to cut the worst days, then buys dry cooling only
 * if the utility cap is still broken. Grid-peak hours are swapped last.
 */

import type {
  DayPoint,
  Foresight,
  HourPoint,
  LeverReport,
  Metrics,
  PlanRequest,
  PlanResponse,
  SensitivityResponse,
} from "./types";

export const BASE_MW = 70;
export const IT_CAP_MW = 100;
export const GAL_PER_LITER = 0.264172052358;
export const PUE_PENALTY = 0.15;
/** Residual blowdown when evaporation is forced off above 25°C. */
export const DRY_WUE = 0.02;
export const SAMPLE_ASSUMPTIONS = [
  "100 MW IT capacity and a flat 70 MW average. The Alibaba trace is a backend step, not this planner.",
  "Toy cooling curve from the project brief: 0 L/kWh at or below 25°C, 1.8 L/kWh at 40°C, linear in between and above.",
  "Flexible share is a slider from 5% to 30%. Inference-heavy hours cannot move.",
  "Sister campuses are sample pairings (Duluth, Des Moines, Islamabad), not operating sites.",
  "The tank starts the week full. Water drawn from it was withdrawn before this window.",
  "Grid stress is a sample afternoon shape, not EIA-930.",
  "Dry cooling costs +0.15 PUE on the switched megawatts, the brief's reference penalty.",
  "This is a heuristic. The MILP objective and constraints are specified in BACKEND.md.",
];

const ADVANCE_H = 18;
const DELAY_H = 24;

export function toyWue(tempC: number): number {
  if (tempC <= 25) return 0;
  return ((tempC - 25) / 15) * 1.8;
}

export function gallonsFromLoad(mw: number, tempC: number, swapFraction = 0): number {
  if (mw <= 0 || tempC <= 25) return 0;
  const fraction = clamp(swapFraction, 0, 1);
  const wue = toyWue(tempC) * (1 - fraction) + DRY_WUE * fraction;
  return wue * mw * 1000 * GAL_PER_LITER;
}

export type SeriesInput = {
  times: string[];
  tempC: number[];
  sisterTempC: number[];
  sisterName: string;
  request: PlanRequest;
  /** When false, dry-cooling swaps are not used. Sensitivity uses this. */
  allowSwap?: boolean;
  /** Decision temperatures. Water is always scored on the real series. */
  decisionTempC?: number[];
  decisionSisterTempC?: number[];
};

type Move = { from: number; to: number; mw: number; kind: "time" | "space" };

type Built = {
  response: PlanResponse;
  schedulePeakGal: number;
};

export function runSamplePlan(input: SeriesInput): PlanResponse {
  return build(input).response;
}

export function runSensitivity(
  input: Omit<SeriesInput, "request"> & { request: PlanRequest },
): SensitivityResponse {
  const shares = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
  const points = shares.map((flexible_share) => {
    const plan = runSamplePlan({
      ...input,
      allowSwap: false,
      request: {
        ...input.request,
        flexible_share,
        flex_event: false,
        cap_ratio: 1,
        foresight: "perfect",
      },
    });
    return {
      flexible_share,
      peak_cut_pct: plan.optimized.water_capacity_impact * 100,
      extra_mwh: plan.optimized.extra_mwh,
      peak_day_gal: plan.optimized.peak_day_gal,
    };
  });

  const share = input.request.flexible_share;
  const perfect = runSamplePlan({
    ...input,
    allowSwap: false,
    request: { ...input.request, flexible_share: share, flex_event: false, cap_ratio: 1, foresight: "perfect" },
  });
  const noisyPrimary = forecastNoise(input.tempC, 1.7);
  const noisySister = forecastNoise(input.sisterTempC, 2.4);
  const forecast = runSamplePlan({
    ...input,
    allowSwap: false,
    decisionTempC: noisyPrimary,
    decisionSisterTempC: noisySister,
    request: {
      ...input.request,
      flexible_share: share,
      flex_event: false,
      cap_ratio: 1,
      foresight: "historical_forecast",
    },
  });

  return {
    sample: true,
    label:
      "SAMPLE sensitivity. Swaps are off, so the curve is the value of moving work, not of buying a lower cap with electricity. Forecast noise is synthetic: a cool bias of a few degrees, not the Open-Meteo historical-forecast archive.",
    swaps_included: false,
    points,
    foresight: {
      flexible_share: share,
      perfect_peak_cut_pct: perfect.optimized.water_capacity_impact * 100,
      forecast_peak_cut_pct: forecast.optimized.water_capacity_impact * 100,
      perfect_peak_day_gal: perfect.optimized.peak_day_gal,
      forecast_peak_day_gal: forecast.optimized.peak_day_gal,
      note:
        "The forecast case plans against a noisier temperature series and is scored on the real hours. The backend replaces this with Open-Meteo historical forecasts.",
    },
  };
}

function build(input: SeriesInput): Built {
  const allowSwap = input.allowSwap !== false;
  const n = input.tempC.length;
  if (n !== input.sisterTempC.length || n !== input.times.length || n % 24 !== 0) {
    throw new Error("Weather series must be whole days and aligned.");
  }
  const req = input.request;
  const flex = clamp(req.flexible_share, 0.05, 0.3);
  const tank = Math.max(0, req.tank_gallons);
  const decision = input.decisionTempC ?? input.tempC;
  const decisionSister = input.decisionSisterTempC ?? input.sisterTempC;

  const stress = gridStress(input.tempC);
  const gridCut = percentile(stress, 0.85);

  const local = Array<number>(n).fill(BASE_MW);
  const sisterAdded = Array<number>(n).fill(0);
  const removable = Array<number>(n).fill(BASE_MW * flex);
  const moves: Move[] = [];

  for (let pass = 0; pass < 8; pass += 1) {
    const order = indices(n).sort((a, b) => toyWue(decision[b]) - toyWue(decision[a]) || a - b);
    let movedThisPass = 0;
    for (const i of order) {
      if (removable[i] < 0.2) continue;
      const here = toyWue(decision[i]);
      if (here < 0.05) continue;
      let best: { kind: "time" | "space"; j: number; w: number } | null = null;
      for (let j = 0; j < n; j += 1) {
        const dt = j - i;
        if (dt < -ADVANCE_H || dt > DELAY_H) continue;
        if (j !== i && local[j] < IT_CAP_MW - 0.2) {
          const w = toyWue(decision[j]);
          if (w < here - 0.08 && (!best || w < best.w - 1e-9)) best = { kind: "time", j, w };
        }
        if (sisterAdded[j] < IT_CAP_MW - BASE_MW - 0.2) {
          const w = toyWue(decisionSister[j]);
          if (w < here - 0.12 && (!best || w < best.w - 0.05)) best = { kind: "space", j, w };
        }
      }
      if (!best) continue;
      const room =
        best.kind === "time"
          ? IT_CAP_MW - local[best.j]
          : IT_CAP_MW - BASE_MW - sisterAdded[best.j];
      const mw = Math.min(removable[i], room);
      if (mw < 0.2) continue;
      local[i] -= mw;
      removable[i] -= mw;
      if (best.kind === "time") local[best.j] += mw;
      else sisterAdded[best.j] += mw;
      moves.push({ from: i, to: best.j, mw, kind: best.kind });
      movedThisPass += mw;
    }
    if (movedThisPass < 0.5) break;
  }

  const timeIn = Array<number>(n).fill(0);
  const timeOut = Array<number>(n).fill(0);
  const spaceOut = Array<number>(n).fill(0);
  let delayMwhH = 0;
  let absShiftMwhH = 0;
  let timeMwh = 0;
  let spaceMwh = 0;
  for (const move of moves) {
    absShiftMwhH += move.mw * Math.abs(move.to - move.from);
    delayMwhH += move.mw * Math.max(0, move.to - move.from);
    if (move.kind === "time") {
      timeMwh += move.mw;
      timeOut[move.from] += move.mw;
      timeIn[move.to] += move.mw;
    } else {
      spaceMwh += move.mw;
      spaceOut[move.from] += move.mw;
    }
  }

  const scheduledGal = local.map((mw, i) => gallonsFromLoad(mw, input.tempC[i], 0));
  const scheduledDaily = daySum(scheduledGal);
  const schedulePeakGal = Math.max(...scheduledDaily);

  const baselineGal = input.tempC.map((t) => gallonsFromLoad(BASE_MW, t, 0));
  const baselineDaily = daySum(baselineGal);
  const baselinePeak = Math.max(...baselineDaily);
  const tighten = req.flex_event ? clamp(req.flex_tighten, 0, 0.8) : 0;
  const capRatio = clamp(req.cap_ratio, 0.4, 1) * (1 - tighten);
  const capGal = baselinePeak * capRatio;

  const swap = Array<number>(n).fill(0);
  let extraMwh = 0;
  const consumption = scheduledGal.slice();

  const applySwap = () => {
    for (let i = 0; i < n; i += 1) {
      consumption[i] = gallonsFromLoad(local[i], input.tempC[i], swap[i]);
    }
  };

  if (allowSwap && capGal > 0) {
    let stall = 0;
    let previous = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 4000; step += 1) {
      const peak = minPeak(daySum(consumption), tank).peak;
      if (peak <= capGal * 1.002) break;
      if (peak > previous - 0.5) {
        stall += 1;
        if (stall > 3) break;
      } else stall = 0;
      previous = peak;
      const hour = pickSwapHour(input.tempC, local, swap, stress, gridCut, stall > 0);
      if (hour < 0) break;
      const slice = Math.min(4, local[hour] * (1 - swap[hour]));
      if (slice < 0.05) {
        swap[hour] = 1;
        continue;
      }
      swap[hour] = Math.min(1, swap[hour] + slice / local[hour]);
      extraMwh += PUE_PENALTY * slice;
      applySwap();
    }
  }

  const afterSwapDaily = daySum(consumption);
  const tanked = minPeak(afterSwapDaily, tank);
  const noSwapTank = minPeak(scheduledDaily, tank);

  const utilityHourly = spreadUtility(consumption, input.tempC, tanked.utility);
  const days = dailyPoints(input.times, input.tempC, baselineDaily, scheduledDaily, tanked.utility, capGal);

  let gridPeakMw = 0;
  let swapMwh = 0;
  let swapHours = 0;
  for (let i = 0; i < n; i += 1) {
    const swappedMw = local[i] * swap[i];
    swapMwh += swappedMw;
    if (swap[i] > 0.05) swapHours += 1;
    if (stress[i] >= gridCut) gridPeakMw = Math.max(gridPeakMw, PUE_PENALTY * swappedMw);
  }

  const sisterCons = sisterAdded.map((mw, i) => gallonsFromLoad(mw, input.sisterTempC[i], 0));
  const sisterBaseDaily = daySum(input.sisterTempC.map((t) => gallonsFromLoad(BASE_MW, t, 0)));
  const sisterWithDaily = daySum(
    input.sisterTempC.map((t, i) => gallonsFromLoad(BASE_MW + sisterAdded[i], t, 0)),
  );

  const startLevel = tank;
  const endLevel = tanked.endLevel;
  const tankNetDraw = Math.max(0, startLevel - endLevel);

  const levers: LeverReport = {
    time_shift_mwh: round(timeMwh, 1),
    space_shift_mwh: round(spaceMwh, 1),
    sister_name: input.sisterName,
    sister_added_gal: round(sisterCons.reduce((a, b) => a + b, 0), 0),
    sister_baseline_peak_gal: round(Math.max(...sisterBaseDaily), 0),
    sister_peak_with_shift_gal: round(Math.max(...sisterWithDaily), 0),
    swap_mwh: round(swapMwh, 1),
    swap_hours: swapHours,
    tank_net_draw_gal: round(tankNetDraw, 0),
    peak_baseline_gal: round(baselinePeak, 0),
    peak_after_schedule_gal: round(schedulePeakGal, 0),
    peak_after_tank_gal: round(noSwapTank.peak, 0),
    peak_final_gal: round(tanked.peak, 0),
  };

  const hours: HourPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const mode = modeOf(input.tempC[i], swap[i]);
    hours.push({
      time: input.times[i],
      temp_c: round(input.tempC[i], 1),
      sister_temp_c: round(input.sisterTempC[i], 1),
      baseline_load_mw: BASE_MW,
      load_mw: round(local[i], 2),
      time_shift_in_mw: round(timeIn[i], 2),
      time_shift_out_mw: round(timeOut[i], 2),
      space_shift_out_mw: round(spaceOut[i], 2),
      sister_added_mw: round(sisterAdded[i], 2),
      baseline_water_gal: round(baselineGal[i], 1),
      consumption_gal: round(consumption[i], 1),
      utility_gal: round(utilityHourly[i], 1),
      cooling_mode: mode,
      swap_fraction: round(swap[i], 3),
      grid_stress: round(stress[i], 3),
      grid_peak: stress[i] >= gridCut,
    });
  }

  const totalItMwh = BASE_MW * n;
  const movedMwh = timeMwh + spaceMwh;
  const baselineMetrics = metricsFrom(baselineDaily, days.map((d) => dateLoads(hours, d.date, "baseline")), baselineDaily.map((_, i) => BASE_MW * 24), 0, 0, 0, baselinePeak);
  const optimizedIt = days.map((d) => dateLoads(hours, d.date, "optimized"));
  const optimizedMetrics = metricsFrom(
    tanked.utility,
    optimizedIt,
    days.map(() => 0),
    extraMwh,
    gridPeakMw,
    (delayMwhH / totalItMwh) * 60,
    baselinePeak,
  );
  optimizedMetrics.avg_flexible_shift_min = movedMwh > 0 ? (absShiftMwhH / movedMwh) * 60 : 0;
  roundMetrics(baselineMetrics);
  roundMetrics(optimizedMetrics);

  const peak = tanked.peak;
  const shortfall = Math.max(0, peak - capGal);
  const sample = true;
  const foresightNote: Foresight = req.foresight;

  const response: PlanResponse = stampPeakDates({
    meta: {
      sample,
      label: sampleLabel(foresightNote),
      model: "sample-heuristic-toy-curve-v1",
      weather_source: "open-meteo-archive",
      site_id: req.site_id,
      sister_name: input.sisterName,
      start: req.start,
      end: req.end,
      cap_gal: round(capGal, 0),
      cap_ratio_effective: round(capRatio, 4),
      cap_met: shortfall <= Math.max(50, capGal * 0.005),
      cap_shortfall_gal: round(shortfall, 0),
      flex_event: req.flex_event,
      assumptions: SAMPLE_ASSUMPTIONS,
    },
    baseline: baselineMetrics,
    optimized: optimizedMetrics,
    levers,
    hours,
    days,
  });
  return { response, schedulePeakGal };
}

export type UncontrolledHour = {
  time: string;
  temp_c: number;
  sister_temp_c: number;
  water_gal: number;
  grid_stress: number;
  grid_peak: boolean;
};

export function uncontrolledWeek(
  times: string[],
  tempC: number[],
  sisterTempC: number[],
): { days: { date: string; temp_max_c: number; baseline_gal: number }[]; hours: UncontrolledHour[] } {
  const stress = gridStress(tempC);
  const cut = percentile(stress, 0.85);
  const hours: UncontrolledHour[] = tempC.map((temp, i) => ({
    time: times[i],
    temp_c: round(temp, 1),
    sister_temp_c: round(sisterTempC[i], 1),
    water_gal: round(gallonsFromLoad(BASE_MW, temp, 0), 1),
    grid_stress: round(stress[i], 3),
    grid_peak: stress[i] >= cut,
  }));
  const daily = daySum(hours.map((h) => h.water_gal));
  const days = daily.map((gal, d) => ({
    date: times[d * 24].slice(0, 10),
    temp_max_c: round(Math.max(...tempC.slice(d * 24, d * 24 + 24)), 1),
    baseline_gal: round(gal, 0),
  }));
  return { days, hours };
}

export function runBaseline(input: SeriesInput): PlanResponse {
  const held: PlanRequest = {
    ...input.request,
    flexible_share: 0.05,
    tank_gallons: 0,
    cap_ratio: 1,
    flex_event: false,
    foresight: "perfect",
  };
  const plan = runSamplePlan({ ...input, request: held, allowSwap: false, decisionTempC: undefined });
  // Baseline metrics ignore the unused 5% flexibility by recomputing from the uncontrolled hours.
  // runSamplePlan always reports the uncontrolled plant on `baseline`, which is what callers show
  // before the button is pressed. Returning the full object keeps one code path.
  plan.meta.label =
    "SAMPLE baseline. Real Open-Meteo temperatures, uncontrolled 70 MW flat load, toy cooling curve. Not a measured facility.";
  return plan;
}

function sampleLabel(foresight: Foresight): string {
  const forecast =
    foresight === "historical_forecast"
      ? " Decisions used a synthetic forecast error and were scored on the real hours."
      : "";
  return `SAMPLE. Illustrative planner on real Open-Meteo temperatures and the brief's toy cooling curve. Not the MILP and not a measured data center.${forecast} Do not put these numbers in the video or on the project page.`;
}

function metricsFrom(
  dailyGal: number[],
  dailyItMwh: number[],
  _unused: number[],
  extraMwh: number,
  gridPeakMw: number,
  delayMin: number,
  baselinePeak: number,
): Metrics {
  void _unused;
  let peak = -Infinity;
  let peakIndex = 0;
  let sum = 0;
  for (let i = 0; i < dailyGal.length; i += 1) {
    sum += dailyGal[i];
    if (dailyGal[i] > peak) {
      peak = dailyGal[i];
      peakIndex = i;
    }
  }
  const mean = sum / dailyGal.length;
  const itKwh = Math.max(1, dailyItMwh[peakIndex] * 1000);
  const liters = peak / GAL_PER_LITER;
  return {
    peak_day_gal: peak,
    peak_day_date: "",
    mean_day_gal: mean,
    pwue_l_per_kwh: liters / itKwh,
    peaking_factor: mean > 1 ? peak / mean : 0,
    extra_mwh: extraMwh,
    grid_peak_mw: gridPeakMw,
    avg_job_delay_min: delayMin,
    avg_flexible_shift_min: 0,
    water_capacity_impact: baselinePeak > 0 ? Math.max(0, (baselinePeak - peak) / baselinePeak) : 0,
    total_gal: sum,
  };
}

function dateLoads(hours: HourPoint[], date: string, kind: "baseline" | "optimized"): number {
  let mwh = 0;
  for (const hour of hours) {
    if (!hour.time.startsWith(date)) continue;
    mwh += kind === "baseline" ? hour.baseline_load_mw : hour.load_mw;
  }
  return mwh;
}

function roundMetrics(m: Metrics) {
  m.peak_day_gal = round(m.peak_day_gal, 0);
  m.mean_day_gal = round(m.mean_day_gal, 0);
  m.pwue_l_per_kwh = round(m.pwue_l_per_kwh, 3);
  m.peaking_factor = round(m.peaking_factor, 2);
  m.extra_mwh = round(m.extra_mwh, 1);
  m.grid_peak_mw = round(m.grid_peak_mw, 3);
  m.avg_job_delay_min = round(m.avg_job_delay_min, 1);
  m.avg_flexible_shift_min = round(m.avg_flexible_shift_min, 1);
  m.water_capacity_impact = round(m.water_capacity_impact, 4);
  m.total_gal = round(m.total_gal, 0);
}

function dailyPoints(
  times: string[],
  temp: number[],
  baseline: number[],
  scheduled: number[],
  optimized: number[],
  cap: number,
): DayPoint[] {
  const days = baseline.length;
  const out: DayPoint[] = [];
  for (let d = 0; d < days; d += 1) {
    const sliceT = temp.slice(d * 24, d * 24 + 24);
    out.push({
      date: times[d * 24].slice(0, 10),
      temp_max_c: round(Math.max(...sliceT), 1),
      baseline_gal: round(baseline[d], 0),
      scheduled_gal: round(scheduled[d], 0),
      optimized_gal: round(optimized[d], 0),
      cap_gal: round(cap, 0),
    });
  }
  return out;
}

function modeOf(temp: number, swap: number): HourPoint["cooling_mode"] {
  if (temp <= 25) return "dry";
  if (swap >= 0.5) return "swap";
  return "evaporative";
}

export function minPeak(daily: number[], tank: number): { utility: number[]; peak: number; endLevel: number } {
  const hi0 = Math.max(...daily, 0);
  if (tank <= 0 || daily.length === 0) {
    return { utility: daily.slice(), peak: hi0, endLevel: 0 };
  }
  if (!dispatchTank(daily, tank, hi0).ok) {
    return { utility: daily.slice(), peak: hi0, endLevel: tank };
  }
  let lo = 0;
  let hi = hi0;
  for (let k = 0; k < 42; k += 1) {
    const mid = (lo + hi) / 2;
    if (dispatchTank(daily, tank, mid).ok) hi = mid;
    else lo = mid;
  }
  const best = dispatchTank(daily, tank, hi);
  const utility = best.ok ? best.utility : daily.slice();
  return { utility, peak: Math.max(...utility, 0), endLevel: best.endLevel };
}

function dispatchTank(
  daily: number[],
  tank: number,
  target: number,
): { ok: boolean; utility: number[]; endLevel: number } {
  let level = tank;
  const utility: number[] = [];
  for (const w of daily) {
    const loD = Math.max(level - tank, w - target);
    const hiD = Math.min(level, w);
    if (loD > hiD + 1e-4) return { ok: false, utility, endLevel: level };
    utility.push(w - loD);
    level -= loD;
  }
  return { ok: true, utility, endLevel: level };
}

function spreadUtility(consumption: number[], temp: number[], dailyUtility: number[]): number[] {
  const out = consumption.slice();
  const days = dailyUtility.length;
  for (let d = 0; d < days; d += 1) {
    const start = d * 24;
    const idx = indices(24).map((h) => start + h);
    const sum = idx.reduce((a, i) => a + consumption[i], 0);
    let delta = sum - dailyUtility[d];
    if (Math.abs(delta) < 1) {
      const fix = dailyUtility[d] - sum;
      out[idx[0]] += fix;
      continue;
    }
    const order = idx.slice().sort((a, b) => (delta > 0 ? temp[b] - temp[a] : temp[a] - temp[b]));
    if (delta > 0) {
      for (const i of order) {
        if (delta <= 0) break;
        const take = Math.min(delta, out[i]);
        out[i] -= take;
        delta -= take;
      }
    } else {
      let fill = -delta;
      const coolest = order[0];
      out[coolest] += fill;
      fill = 0;
    }
  }
  return out;
}

function pickSwapHour(
  temp: number[],
  load: number[],
  swap: number[],
  stress: number[],
  gridCut: number,
  allowGrid: boolean,
): number {
  let best = -1;
  let score = 0;
  for (let i = 0; i < temp.length; i += 1) {
    if (swap[i] >= 0.999) continue;
    if (load[i] <= 0.1) continue;
    const save = toyWue(temp[i]) - DRY_WUE;
    if (save <= 0.04) continue;
    if (!allowGrid && stress[i] >= gridCut) continue;
    if (save > score) {
      score = save;
      best = i;
    }
  }
  return best;
}

function gridStress(temp: number[]): number[] {
  const tMin = Math.min(...temp);
  const tMax = Math.max(...temp);
  return temp.map((t, i) => {
    const hour = i % 24;
    const diurnal = Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI));
    const norm = (t - tMin) / Math.max(1, tMax - tMin);
    return 0.75 * diurnal + 0.25 * norm;
  });
}

export function forecastNoise(temp: number[], phase: number): number[] {
  // Synthetic, not an Open-Meteo historical forecast. A cool bias makes the
  // planner leave load on hours that are actually evaporating.
  return temp.map((t, i) => {
    const noise = 2.1 * Math.sin(i / 5.4 + phase) + 1.1 * Math.cos(i / 2.4 + phase);
    return clamp(t - 2.4 + noise, -15, 55);
  });
}

function daySum(values: number[]): number[] {
  const days = values.length / 24;
  const out: number[] = [];
  for (let d = 0; d < days; d += 1) {
    let sum = 0;
    for (let h = 0; h < 24; h += 1) sum += values[d * 24 + h];
    out.push(sum);
  }
  return out;
}

function indices(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function percentile(values: number[], p: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

/** Fill peak-day dates once the day table exists. Called by the API wrapper. */
export function stampPeakDates(plan: PlanResponse): PlanResponse {
  const baseDay = [...plan.days].sort((a, b) => b.baseline_gal - a.baseline_gal)[0];
  const optDay = [...plan.days].sort((a, b) => b.optimized_gal - a.optimized_gal)[0];
  plan.baseline.peak_day_date = baseDay?.date ?? plan.meta.start;
  plan.optimized.peak_day_date = optDay?.date ?? plan.meta.start;
  return plan;
}
