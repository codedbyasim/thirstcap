"""Health and dataset status endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from app.config import DATA_DIR, get_settings
from app.schemas import HealthDatasets, HealthResponse
from app.services.weather import SITE_REGISTRY

router = APIRouter(prefix="/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    settings = get_settings()
    fixtures_dir = DATA_DIR / "fixtures"
    fixtures_count = len(list(fixtures_dir.glob("*.json"))) if fixtures_dir.exists() else 0

    datasets = HealthDatasets(
        eia930_miso=(DATA_DIR / "eia930" / "MISO_2025.json").exists(),
        eia930_azps=(DATA_DIR / "eia930" / "AZPS_2025.json").exists(),
        eia930_pjm=(DATA_DIR / "eia930" / "PJM_2025.json").exists(),
        alibaba_gpu_2020=(DATA_DIR / "alibaba" / "gpu_2020_weekly_profile.json").exists(),
        calibration_loaded=(DATA_DIR / "calibration.json").exists(),
        fixtures_count=fixtures_count,
        sites_count=len(SITE_REGISTRY),
    )
    return HealthResponse(
        status="ok",
        service="thirstcap",
        version=settings.version,
        sample=False,
        solver="PuLP-CBC",
        datasets=datasets,
    )
