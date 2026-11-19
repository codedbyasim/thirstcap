"""Pydantic v2 request and response schemas matching BACKEND.md contract + additive production telemetry."""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

CoolingMode = Literal["dry", "evaporative", "swap"]
ForesightMode = Literal["perfect", "historical_forecast", "live_forecast"]
PlantModelKind = Literal["physical", "toy"]


class CustomSiteInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    country: Optional[str] = Field(default=None, max_length=80)
    lat: float = Field(ge=-90.0, le=90.0)
    lon: float = Field(ge=-180.0, le=180.0)
    timezone: str = Field(default="auto", min_length=1, max_length=64)
    sister_name: Optional[str] = Field(default=None, max_length=80)
    sister_lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    sister_lon: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    sister_timezone: Optional[str] = Field(default=None, max_length=64)


class PlanRequest(BaseModel):
    site_id: str = Field(min_length=1, max_length=64)
    start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    flexible_share: float = Field(default=0.20, ge=0.05, le=0.30)
    tank_gallons: float = Field(default=40_000.0, ge=0.0, le=2_000_000.0)
    cap_ratio: float = Field(default=0.78, ge=0.40, le=1.0)
    flex_event: bool = False
    flex_tighten: float = Field(default=0.30, ge=0.0, le=0.80)
    foresight: ForesightMode = "perfect"
    live_days: int = Field(default=7, ge=3, le=7)

    # Additive production & facility configuration fields
    plant_model: PlantModelKind = "physical"
    it_capacity_mw: float = Field(default=100.0, ge=10.0, le=500.0)
    coc: float = Field(default=4.0, ge=2.5, le=8.0)
    electricity_price_usd_per_mwh: float = Field(default=85.0, ge=0.0, le=500.0)
    reclaimed_water_share: float = Field(default=0.0, ge=0.0, le=0.85)
    water_tariff_usd_per_kgal: Optional[float] = Field(default=None, ge=0.0, le=50.0)
    custom_site: Optional[CustomSiteInput] = None
    lambda1: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    lambda2: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    lambda3: Optional[float] = Field(default=None, ge=0.0, le=2.0)

    @model_validator(mode="after")
    def validate_custom_site(self) -> "PlanRequest":
        if self.site_id == "custom" and self.custom_site is None:
            raise ValueError("custom_site is required when site_id is 'custom'.")
        return self


class Metrics(BaseModel):
    peak_day_gal: float
    peak_day_date: str
    mean_day_gal: float
    pwue_l_per_kwh: float
    peaking_factor: float
    extra_mwh: float
    grid_peak_mw: float
    avg_job_delay_min: float
    avg_flexible_shift_min: float
    water_capacity_impact: float
    total_gal: float


class HourPoint(BaseModel):
    time: str
    temp_c: float
    sister_temp_c: float
    baseline_load_mw: float
    load_mw: float
    time_shift_in_mw: float
    time_shift_out_mw: float
    space_shift_out_mw: float
    sister_added_mw: float
    baseline_water_gal: float
    consumption_gal: float
    utility_gal: float
    cooling_mode: CoolingMode
    swap_fraction: float
    grid_stress: float
    grid_peak: bool

    # Additive physical & operational telemetry
    wet_bulb_c: float = 0.0
    rh_pct: float = 50.0
    tank_level_gal: float = 0.0
    tank_fill_gal: float = 0.0
    tank_draw_gal: float = 0.0
    grid_demand_mw: Optional[float] = None
    fixed_mw: float = 0.0
    deferrable_mw: float = 0.0
    pausable_mw: float = 0.0


class DayPoint(BaseModel):
    date: str
    temp_max_c: float
    baseline_gal: float
    scheduled_gal: float
    optimized_gal: float
    cap_gal: float


class LeverReport(BaseModel):
    time_shift_mwh: float
    space_shift_mwh: float
    sister_name: str
    sister_added_gal: float
    sister_baseline_peak_gal: float
    sister_peak_with_shift_gal: float
    swap_mwh: float
    swap_hours: int
    tank_net_draw_gal: float
    peak_baseline_gal: float
    peak_after_schedule_gal: float
    peak_after_tank_gal: float
    peak_final_gal: float


class DataProvenance(BaseModel):
    weather: str
    grid: str
    workload: str
    plant: str
    solver: str


class PlanMeta(BaseModel):
    sample: bool
    label: str
    model: str
    weather_source: Literal["open-meteo-archive", "backend"]
    site_id: str
    sister_name: str
    start: str
    end: str
    cap_gal: float
    cap_ratio_effective: float
    cap_met: bool
    cap_shortfall_gal: float
    flex_event: bool
    assumptions: list[str]

    # Additive production provenance
    site_name: str = ""
    region: str = ""
    timezone: str = "UTC"
    plant_model: str = "physical"
    solver_status: str = "Optimal"
    solve_time_ms: int = 0
    calibration_multiplier: float = 1.0
    it_capacity_mw: float = 100.0
    coc: float = 4.0
    data_provenance: Optional[DataProvenance] = None


class BusinessImpact(BaseModel):
    peak_mgd_avoided: float
    avoided_capex_low_usd: float
    avoided_capex_high_usd: float
    avoided_capex_mid_usd: float
    extra_power_cost_usd: float
    electricity_price_usd_per_mwh: float
    sister_guardrail_met: bool
    humid_wet_bulb_hours: int
    workload_mix_pct: dict[str, float]
    households_daily_water_protected: int = 0
    people_daily_water_protected: int = 0
    extra_co2_tonnes: float = 0.0
    co2_avoided_vs_all_dry_tonnes: float = 0.0
    basin_stress_tier: str = "Regional"
    wri_stress_score: int = 50
    regulatory_framework: str = "Regional Municipal Water Allocation"
    permit_shield_score: int = 80
    permit_shield_status: str = "Permit Ready"
    eu_eed_rating: Literal["A", "B", "C", "D", "E", "F", "G"] = "B"
    potable_peak_day_gal: float = 0.0
    reclaimed_peak_day_gal: float = 0.0
    water_tariff_usd_per_kgal: float = 5.5
    annual_tariff_savings_usd: float = 0.0
    five_year_net_roi_usd: float = 0.0
    tank_payback_years: float = 0.0


class DispatchWindow(BaseModel):
    action_type: Literal["DEFER_BATCH", "SPACE_SHIFT", "DRY_COOL_SWAP", "TANK_DISCHARGE"]
    start_time: str
    end_time: str
    hours_count: int
    peak_magnitude: float
    unit: str
    summary: str
    scheduler_hint: str


class UtilitySignalPayload(BaseModel):
    signal_id: str
    protocol: str = "ThirstCap-WaterDR-v1"
    facility_id: str
    drought_stage: str
    flex_event_active: bool
    curtailment_pct: float
    firm_daily_cap_gal: float
    firm_daily_cap_mgd: float
    valid_from: str
    valid_until: str
    compliance_verified: bool


class PlanResponse(BaseModel):
    meta: PlanMeta
    baseline: Metrics
    optimized: Metrics
    levers: LeverReport
    hours: list[HourPoint]
    days: list[DayPoint]
    business_impact: Optional[BusinessImpact] = None
    dispatch_windows: list[DispatchWindow] = Field(default_factory=list)
    utility_signal: Optional[UtilitySignalPayload] = None


class TankSizingPoint(BaseModel):
    tank_gallons: float
    peak_day_gal: float
    peak_cut_pct: float
    extra_mwh: float
    avoided_capex_mid_usd: float
    est_tank_build_cost_usd: float
    net_capex_benefit_usd: float


class TankSizingResponse(BaseModel):
    site_id: str
    site_name: str
    recommended_tank_gal: float
    tank_cost_per_gal_usd: float = 2.5
    points: list[TankSizingPoint]
    data_source: str = "computed"
    note: str = ""


class FleetSiteSummary(BaseModel):
    site_id: str
    site_name: str
    country: str
    window: str
    basin_stress_tier: str
    grid_source: str
    baseline_peak_gal: float
    optimized_peak_gal: float
    peak_cut_pct: float
    peak_mgd_avoided: float
    avoided_capex_low_usd: float
    avoided_capex_high_usd: float
    households_daily_water_protected: int
    extra_mwh: float
    humid_wet_bulb_hours: int
    cap_met: bool
    wri_stress_score: int = 50
    regulatory_framework: str = ""
    permit_shield_score: int = 80
    eu_eed_rating: str = "B"
    five_year_net_roi_usd: float = 0.0


class FleetCompareResponse(BaseModel):
    total_peak_gal_saved: float
    total_mgd_avoided: float
    total_households_protected: int
    total_people_protected: int
    total_capex_low_usd: float
    total_capex_high_usd: float
    total_extra_mwh: float
    sites: list[FleetSiteSummary]
    data_source: str = "computed"
    note: str = ""


class SensitivityPoint(BaseModel):
    flexible_share: float
    peak_cut_pct: float
    extra_mwh: float
    peak_day_gal: float


class ForesightComparison(BaseModel):
    flexible_share: float
    perfect_peak_cut_pct: float
    forecast_peak_cut_pct: float
    perfect_peak_day_gal: float
    forecast_peak_day_gal: float
    note: str


class SensitivityResponse(BaseModel):
    sample: bool
    label: str
    swaps_included: Literal[False] = False
    points: list[SensitivityPoint]
    foresight: ForesightComparison


class HealthDatasets(BaseModel):
    eia930_miso: bool
    eia930_azps: bool
    eia930_pjm: bool = False
    alibaba_gpu_2020: bool
    calibration_loaded: bool
    fixtures_count: int
    sites_count: int = 10


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["thirstcap"] = "thirstcap"
    version: str
    sample: bool = False
    solver: str = "PuLP-CBC"
    datasets: Optional[HealthDatasets] = None


class GeocodeResult(BaseModel):
    name: str
    country: str
    admin1: str = ""
    lat: float
    lon: float
    timezone: str


class GeocodeResponse(BaseModel):
    results: list[GeocodeResult]


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail
