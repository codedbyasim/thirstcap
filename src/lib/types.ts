/** REST contract shared with the FastAPI PuLP/CBC MILP service. */

export type CoolingMode = "dry" | "evaporative" | "swap";

export type Foresight = "perfect" | "historical_forecast" | "live_forecast";

export type PlantModelKind = "physical" | "toy";

export type CustomSiteInput = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  timezone: string;
  sister_name?: string;
  sister_lat?: number;
  sister_lon?: number;
  sister_timezone?: string;
};

export type PlanRequest = {
  site_id: string;
  start: string;
  end: string;
  flexible_share: number;
  tank_gallons: number;
  cap_ratio: number;
  flex_event: boolean;
  flex_tighten: number;
  foresight: Foresight;
  live_days?: number;
  plant_model?: PlantModelKind;
  it_capacity_mw?: number;
  coc?: number;
  electricity_price_usd_per_mwh?: number;
  reclaimed_water_share?: number;
  water_tariff_usd_per_kgal?: number;
  custom_site?: CustomSiteInput;
};

export type Metrics = {
  peak_day_gal: number;
  peak_day_date: string;
  mean_day_gal: number;
  pwue_l_per_kwh: number;
  peaking_factor: number;
  extra_mwh: number;
  grid_peak_mw: number;
  avg_job_delay_min: number;
  avg_flexible_shift_min: number;
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
  consumption_gal: number;
  utility_gal: number;
  cooling_mode: CoolingMode;
  swap_fraction: number;
  grid_stress: number;
  grid_peak: boolean;
  wet_bulb_c?: number;
  rh_pct?: number;
  tank_level_gal?: number;
  tank_fill_gal?: number;
  tank_draw_gal?: number;
  grid_demand_mw?: number | null;
  fixed_mw?: number;
  deferrable_mw?: number;
  pausable_mw?: number;
};

export type DayPoint = {
  date: string;
  temp_max_c: number;
  baseline_gal: number;
  scheduled_gal: number;
  optimized_gal: number;
  cap_gal: number;
};

export type LeverReport = {
  time_shift_mwh: number;
  space_shift_mwh: number;
  sister_name: string;
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

export type DataProvenance = {
  weather: string;
  grid: string;
  workload: string;
  plant: string;
  solver: string;
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
  site_name?: string;
  region?: string;
  timezone?: string;
  plant_model?: string;
  solver_status?: string;
  solve_time_ms?: number;
  calibration_multiplier?: number;
  it_capacity_mw?: number;
  coc?: number;
  data_provenance?: DataProvenance;
};

export type BusinessImpact = {
  peak_mgd_avoided: number;
  avoided_capex_low_usd: number;
  avoided_capex_high_usd: number;
  avoided_capex_mid_usd: number;
  extra_power_cost_usd: number;
  electricity_price_usd_per_mwh: number;
  sister_guardrail_met: boolean;
  humid_wet_bulb_hours: number;
  workload_mix_pct: Record<string, number>;
  households_daily_water_protected?: number;
  people_daily_water_protected?: number;
  extra_co2_tonnes?: number;
  co2_avoided_vs_all_dry_tonnes?: number;
  basin_stress_tier?: string;
  wri_stress_score?: number;
  regulatory_framework?: string;
  permit_shield_score?: number;
  permit_shield_status?: string;
  eu_eed_rating?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  potable_peak_day_gal?: number;
  reclaimed_peak_day_gal?: number;
  water_tariff_usd_per_kgal?: number;
  annual_tariff_savings_usd?: number;
  five_year_net_roi_usd?: number;
  tank_payback_years?: number;
};

export type DispatchWindow = {
  action_type: "DEFER_BATCH" | "SPACE_SHIFT" | "DRY_COOL_SWAP" | "TANK_DISCHARGE";
  start_time: string;
  end_time: string;
  hours_count: number;
  peak_magnitude: number;
  unit: string;
  summary: string;
  scheduler_hint: string;
};

export type UtilitySignalPayload = {
  signal_id: string;
  protocol: string;
  facility_id: string;
  drought_stage: string;
  flex_event_active: boolean;
  curtailment_pct: number;
  firm_daily_cap_gal: number;
  firm_daily_cap_mgd: number;
  valid_from: string;
  valid_until: string;
  compliance_verified: boolean;
};

export type TankSizingPoint = {
  tank_gallons: number;
  peak_day_gal: number;
  peak_cut_pct: number;
  extra_mwh: number;
  avoided_capex_mid_usd: number;
  est_tank_build_cost_usd: number;
  net_capex_benefit_usd: number;
};

export type TankSizingResponse = {
  site_id: string;
  site_name: string;
  recommended_tank_gal: number;
  tank_cost_per_gal_usd: number;
  points: TankSizingPoint[];
};

export type FleetSiteSummary = {
  site_id: string;
  site_name: string;
  country: string;
  window: string;
  basin_stress_tier: string;
  grid_source: string;
  baseline_peak_gal: number;
  optimized_peak_gal: number;
  peak_cut_pct: number;
  peak_mgd_avoided: number;
  avoided_capex_low_usd: number;
  avoided_capex_high_usd: number;
  households_daily_water_protected: number;
  extra_mwh: number;
  humid_wet_bulb_hours: number;
  cap_met: boolean;
  wri_stress_score?: number;
  regulatory_framework?: string;
  permit_shield_score?: number;
  eu_eed_rating?: string;
  five_year_net_roi_usd?: number;
};

export type FleetCompareResponse = {
  total_peak_gal_saved: number;
  total_mgd_avoided: number;
  total_households_protected: number;
  total_people_protected: number;
  total_capex_low_usd: number;
  total_capex_high_usd: number;
  total_extra_mwh: number;
  sites: FleetSiteSummary[];
};

export type PlanResponse = {
  meta: PlanMeta;
  baseline: Metrics;
  optimized: Metrics;
  levers: LeverReport;
  hours: HourPoint[];
  days: DayPoint[];
  business_impact?: BusinessImpact | null;
  dispatch_windows?: DispatchWindow[];
  utility_signal?: UtilitySignalPayload | null;
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
  solver?: string;
  datasets?: {
    eia930_miso: boolean;
    eia930_azps: boolean;
    eia930_pjm?: boolean;
    alibaba_gpu_2020: boolean;
    calibration_loaded: boolean;
    fixtures_count: number;
    sites_count?: number;
  };
};

export type GeocodeResult = {
  name: string;
  country: string;
  admin1: string;
  lat: number;
  lon: number;
  timezone: string;
};

export type SensitivityResponse = {
  sample: boolean;
  label: string;
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
