/** REST contract shared by the sample planner and the FastAPI service. */

export type CoolingMode = "dry" | "evaporative" | "swap";

export type Foresight = "perfect" | "historical_forecast";

export type PlanRequest = {
  site_id: string;
  start: string;
  end: string;
  /** Share of IT energy that may move. 0.05–0.30. */
  flexible_share: number;
  /** Tank volume in US gallons. */
  tank_gallons: number;
  /**
   * Daily withdrawal cap as a fraction of the baseline peak day.
   * 1 means "the cap is today's unconstrained peak".
   */
  cap_ratio: number;
  /** Utility water-flex event. Tightens the cap by `flex_tighten`. */
  flex_event: boolean;
  /** Fraction to remove from the cap during a flex event. Default 0.30. */
  flex_tighten: number;
  foresight: Foresight;
};

export type Metrics = {
  peak_day_gal: number;
  peak_day_date: string;
  mean_day_gal: number;
  /** Peak-day withdrawal (L) / IT energy served locally that day (kWh). */
  pwue_l_per_kwh: number;
  /** Peak day ÷ mean day inside this window. Not an annual peaking factor. */
  peaking_factor: number;
  extra_mwh: number;
  /** Extra electrical MW added on a sample grid-peak hour. */
  grid_peak_mw: number;
  /** Energy-weighted lateness across all IT energy. Advances count as 0. */
  avg_job_delay_min: number;
  /** Energy-weighted |shift| of the flexible slice only, in minutes. */
  avg_flexible_shift_min: number;
  /** (baseline peak − this peak) / baseline peak. 0 if this is the baseline. */
  water_capacity_impact: number;
  total_gal: number;
};

export type HourPoint = {
  time: string;
  temp_c: number;
  sister_temp_c: number;
  baseline_load_mw: number;
  load_mw: number;
  time_shift_in_mw: number;
  time_shift_out_mw: number;
  space_shift_out_mw: number;
  sister_added_mw: number;
  baseline_water_gal: number;
  /** Plant consumption after the cooling-mode choice. */
  consumption_gal: number;
  /** Withdrawal from the utility, after the tank. */
  utility_gal: number;
  cooling_mode: CoolingMode;
  swap_fraction: number;
  grid_stress: number;
  grid_peak: boolean;
};

export type DayPoint = {
  date: string;
  temp_max_c: number;
  baseline_gal: number;
  /** After time-shift and space-shift, before the tank and before swaps. */
  scheduled_gal: number;
  optimized_gal: number;
  cap_gal: number;
};

export type LeverReport = {
  time_shift_mwh: number;
  space_shift_mwh: number;
  sister_name: string;
  /** Gallons evaporated at the sister because of load we sent. Not a transfer of the same water. */
  sister_added_gal: number;
  sister_baseline_peak_gal: number;
  sister_peak_with_shift_gal: number;
  swap_mwh: number;
  swap_hours: number;
  tank_net_draw_gal: number;
  peak_baseline_gal: number;
  peak_after_schedule_gal: number;
  peak_after_tank_gal: number;
  peak_final_gal: number;
};

export type PlanMeta = {
  sample: boolean;
  label: string;
  model: string;
  weather_source: "open-meteo-archive" | "backend";
  site_id: string;
  sister_name: string;
  start: string;
  end: string;
  cap_gal: number;
  cap_ratio_effective: number;
  cap_met: boolean;
  cap_shortfall_gal: number;
  flex_event: boolean;
  assumptions: string[];
};

export type PlanResponse = {
  meta: PlanMeta;
  baseline: Metrics;
  optimized: Metrics;
  levers: LeverReport;
  hours: HourPoint[];
  days: DayPoint[];
};

export type SensitivityPoint = {
  flexible_share: number;
  peak_cut_pct: number;
  extra_mwh: number;
  peak_day_gal: number;
};

export type HealthResponse = {
  status: "ok";
  service: "thirstcap";
  version: string;
  sample: boolean;
};

export type SensitivityResponse = {
  sample: boolean;
  label: string;
  /** Swaps are off so the curve is the value of flexible work, not of buying water with electricity. */
  swaps_included: false;
  points: SensitivityPoint[];
  foresight: {
    flexible_share: number;
    perfect_peak_cut_pct: number;
    forecast_peak_cut_pct: number;
    perfect_peak_day_gal: number;
    forecast_peak_day_gal: number;
    note: string;
  };
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
