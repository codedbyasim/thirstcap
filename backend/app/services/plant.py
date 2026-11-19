"""Cooling plant physics (calibrated wet-bulb physical model + toy contract curve) and tank LP/bisect helper."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from app.config import load_calibration

GAL_PER_LITER = 0.264172052358
LATENT_HEAT_KJ_PER_KG = 2450.0
BASE_EVAP_L_PER_KWH_HEAT = 3600.0 / LATENT_HEAT_KJ_PER_KG  # ~1.469387755
PUE_EVAP = 1.15
PUE_CHILLER = 1.25
PUE_PENALTY = 0.15
DRY_RESIDUAL_WUE = 0.02


@dataclass(frozen=True)
class PlantCoefficients:
    evap_gal_per_mwh: float
    dry_gal_per_mwh: float
    extra_mw_per_dry_mw: float
    evap_wue_l_per_kwh: float
    dry_wue_l_per_kwh: float
    natural_dry: bool
    regime: Literal["dry", "evaporative", "chiller"]


def toy_wue(temp_c: float) -> float:
    """Toy cooling curve from BACKEND.md section 5 (0 <= 25C, 1.8 @ 40C, linear above 40C)."""
    if temp_c <= 25.0:
        return 0.0
    return ((temp_c - 25.0) / 15.0) * 1.8


def physical_wue(
    temp_db_c: float,
    wet_bulb_c: float,
    coc: float = 4.0,
    multiplier: float | None = None,
) -> tuple[float, Literal["dry", "evaporative", "chiller"]]:
    """Calibrated physical wet-bulb cooling tower + chiller make-up WUE (L / IT kWh)."""
    if temp_db_c <= 25.0:
        return 0.0, "dry"

    if multiplier is None:
        multiplier = float(load_calibration().get("calibration_multiplier", 1.0))

    coc_clamped = max(1.5, coc)
    coc_factor = coc_clamped / (coc_clamped - 1.0)

    if wet_bulb_c <= 20.0:
        evap_fraction = min(1.0, max(0.15, (temp_db_c - 25.0) / 8.0))
        raw = BASE_EVAP_L_PER_KWH_HEAT * PUE_EVAP * evap_fraction * coc_factor
        return raw * multiplier, "evaporative"

    humidity_lift = 1.0 + 0.03 * max(0.0, wet_bulb_c - 20.0)
    raw = BASE_EVAP_L_PER_KWH_HEAT * PUE_CHILLER * humidity_lift * coc_factor
    return raw * multiplier, "chiller"


def hourly_coefficients(
    temp_db_c: float,
    wet_bulb_c: float,
    plant_model: Literal["physical", "toy"] = "physical",
    coc: float = 4.0,
    multiplier: float | None = None,
) -> PlantCoefficients:
    """Return exact linear water/power coefficients per IT MW for one hour."""
    if temp_db_c <= 25.0:
        return PlantCoefficients(
            evap_gal_per_mwh=0.0,
            dry_gal_per_mwh=0.0,
            extra_mw_per_dry_mw=0.0,
            evap_wue_l_per_kwh=0.0,
            dry_wue_l_per_kwh=0.0,
            natural_dry=True,
            regime="dry",
        )

    if plant_model == "toy":
        wue = toy_wue(temp_db_c)
        regime: Literal["dry", "evaporative", "chiller"] = "evaporative"
    else:
        wue, regime = physical_wue(temp_db_c, wet_bulb_c, coc=coc, multiplier=multiplier)

    return PlantCoefficients(
        evap_gal_per_mwh=wue * 1000.0 * GAL_PER_LITER,
        dry_gal_per_mwh=DRY_RESIDUAL_WUE * 1000.0 * GAL_PER_LITER,
        extra_mw_per_dry_mw=PUE_PENALTY,
        evap_wue_l_per_kwh=wue,
        dry_wue_l_per_kwh=DRY_RESIDUAL_WUE,
        natural_dry=False,
        regime=regime,
    )


def gallons_for_load(
    mw: float,
    temp_db_c: float,
    wet_bulb_c: float,
    swap_fraction: float = 0.0,
    plant_model: Literal["physical", "toy"] = "physical",
    coc: float = 4.0,
    multiplier: float | None = None,
) -> float:
    if mw <= 0.0 or temp_db_c <= 25.0:
        return 0.0
    coeff = hourly_coefficients(temp_db_c, wet_bulb_c, plant_model=plant_model, coc=coc, multiplier=multiplier)
    frac = min(1.0, max(0.0, swap_fraction))
    return mw * ((1.0 - frac) * coeff.evap_gal_per_mwh + frac * coeff.dry_gal_per_mwh)


def _feasible_tank(daily: list[float], tank_gal: float, target: float) -> tuple[bool, list[float], float]:
    level = tank_gal
    utility: list[float] = []
    for w in daily:
        lo_d = max(level - tank_gal, w - target)
        hi_d = min(level, w)
        if lo_d > hi_d + 1e-4:
            return False, utility, level
        utility.append(w - lo_d)
        level -= lo_d
    return True, utility, level


def optimal_tank_dispatch(daily: list[float], tank_gal: float) -> tuple[float, list[float], float]:
    """Minimize peak daily utility withdrawal given daily plant consumption and a full-start tank."""
    if not daily:
        return 0.0, [], 0.0
    hi0 = max(max(daily), 0.0)
    if tank_gal <= 0.0:
        return hi0, list(daily), 0.0
    ok0, _, _ = _feasible_tank(daily, tank_gal, hi0)
    if not ok0:
        return hi0, list(daily), tank_gal

    lo, hi = 0.0, hi0
    for _ in range(48):
        mid = 0.5 * (lo + hi)
        ok, _, _ = _feasible_tank(daily, tank_gal, mid)
        if ok:
            hi = mid
        else:
            lo = mid
    ok, utility, end_level = _feasible_tank(daily, tank_gal, hi)
    if not ok:
        return hi0, list(daily), tank_gal
    return max(utility), utility, end_level
