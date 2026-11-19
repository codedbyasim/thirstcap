"""Application settings and physical/optimizer constants loaded from environment and calibration."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ThirstCap"
    version: str = "2.0.0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # MILP objective penalties (BACKEND.md section 5)
    lambda1: float = 0.15  # Extra dry-cooling electricity weight
    lambda2: float = 0.25  # Grid-peak extra MW weight
    lambda3: float = 0.05  # Job delay weight

    # Plant & solver defaults
    default_coc: float = 4.0
    default_it_cap_mw: float = 100.0
    default_mean_it_ratio: float = 0.70
    sister_cap_ratio: float = 1.10
    cbc_time_limit_sec: int = 15

    # Business economics defaults (Han et al. 2026: $10M–$40M per MGD peak capacity)
    default_electricity_price_usd_per_mwh: float = 85.0
    capex_low_usd_per_mgd: float = 10_000_000.0
    capex_high_usd_per_mgd: float = 40_000_000.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def load_calibration() -> dict:
    cal_path = DATA_DIR / "calibration.json"
    if cal_path.exists():
        return json.loads(cal_path.read_text(encoding="utf-8"))
    return {
        "calibration_multiplier": 1.0,
        "note": "Default uncalibrated multiplier (run scripts/calibrate_plant.py).",
    }
