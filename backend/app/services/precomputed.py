"""Committed CBC sweep results for the default fleet and tank requests.

Default UI calls return these payloads immediately. Live 7-day fleet requests
with the same controls return the 2026 summer run, labelled as a fallback,
because ten MILPs plus weather fetches do not finish on a 0.1 CPU instance.
"""

from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path

from app.config import DATA_DIR
from app.schemas import FleetCompareResponse, PlanRequest, TankSizingResponse
from app.services.weather import SITE_REGISTRY

PRECOMPUTED_DIR = DATA_DIR / "precomputed"

# Dashboard defaults (drought tighten 0.30 is on, so flex_event is true).
UI_FLEET = {
    "flexible_share": 0.20,
    "tank_gallons": 40_000.0,
    "cap_ratio": 0.78,
    "flex_event": True,
    "flex_tighten": 0.30,
    "plant_model": "physical",
    "it_capacity_mw": 100.0,
    "coc": 4.0,
    "electricity_price_usd_per_mwh": 85.0,
    "reclaimed_water_share": 0.35,
}

# Pydantic defaults used by the API tests and any client that omits the knobs.
SCHEMA_FLEET = {
    **UI_FLEET,
    "flex_event": False,
    "reclaimed_water_share": 0.0,
}

TANK_KNOBS = {
    "flexible_share": 0.20,
    "plant_model": "physical",
    "it_capacity_mw": 100.0,
    "coc": 4.0,
    "electricity_price_usd_per_mwh": 85.0,
}

LIVE_FLEET_NOTE = (
    "Live 7-day Open-Meteo fleet solve is not run on the free-tier API "
    "(10 CBC MILPs plus weather fetches exceed the request budget, and the provider may return 429). "
    "Showing the precomputed 2026 summer-peak fleet for the same default controls: "
    "20% flexible load, 40,000 gal tank, cap ratio 0.78, stage-2 drought (−30%), 35% reclaimed water, 100 MW, CoC 4, $85/MWh."
)


def _near(left: float, right: float, digits: int) -> bool:
    return round(float(left), digits) == round(float(right), digits)


def _fleet_knobs(request: PlanRequest, expected: dict) -> bool:
    return (
        _near(request.flexible_share, expected["flexible_share"], 3)
        and _near(request.tank_gallons, expected["tank_gallons"], 0)
        and _near(request.cap_ratio, expected["cap_ratio"], 3)
        and bool(request.flex_event) is bool(expected["flex_event"])
        and _near(request.flex_tighten, expected["flex_tighten"], 3)
        and request.plant_model == expected["plant_model"]
        and _near(request.it_capacity_mw, expected["it_capacity_mw"], 1)
        and _near(request.coc, expected["coc"], 1)
        and _near(request.electricity_price_usd_per_mwh, expected["electricity_price_usd_per_mwh"], 1)
        and _near(request.reclaimed_water_share, expected["reclaimed_water_share"], 3)
    )


def _tank_knobs(request: PlanRequest) -> bool:
    if request.custom_site is not None or request.site_id not in SITE_REGISTRY:
        return False
    return (
        _near(request.flexible_share, TANK_KNOBS["flexible_share"], 3)
        and request.plant_model == TANK_KNOBS["plant_model"]
        and _near(request.it_capacity_mw, TANK_KNOBS["it_capacity_mw"], 1)
        and _near(request.coc, TANK_KNOBS["coc"], 1)
        and _near(request.electricity_price_usd_per_mwh, TANK_KNOBS["electricity_price_usd_per_mwh"], 1)
    )


@lru_cache(maxsize=1)
def load_fleet_ui() -> FleetCompareResponse | None:
    return _load_fleet("fleet_ui.json")


@lru_cache(maxsize=1)
def load_fleet_schema() -> FleetCompareResponse | None:
    return _load_fleet("fleet_schema.json")


@lru_cache(maxsize=1)
def load_tanks() -> dict[str, TankSizingResponse]:
    path = PRECOMPUTED_DIR / "tanks.json"
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    sites = raw.get("sites") if isinstance(raw, dict) else None
    if not isinstance(sites, dict):
        return {}
    return {site_id: TankSizingResponse.model_validate(payload) for site_id, payload in sites.items()}


def _load_fleet(name: str) -> FleetCompareResponse | None:
    path = PRECOMPUTED_DIR / name
    if not path.exists():
        return None
    return FleetCompareResponse.model_validate(json.loads(path.read_text(encoding="utf-8")))


def match_fleet(request: PlanRequest) -> FleetCompareResponse | None:
    if request.foresight == "live_forecast" and _fleet_knobs(request, UI_FLEET):
        payload = load_fleet_ui()
        if payload is None:
            return None
        return payload.model_copy(update={"data_source": "precomputed_live_fallback", "note": LIVE_FLEET_NOTE})
    if request.foresight != "perfect":
        return None
    if _fleet_knobs(request, UI_FLEET):
        return load_fleet_ui()
    if _fleet_knobs(request, SCHEMA_FLEET):
        return load_fleet_schema()
    return None


def match_tank(request: PlanRequest) -> TankSizingResponse | None:
    if not _tank_knobs(request):
        return None
    payload = load_tanks().get(request.site_id)
    if payload is None:
        return None
    meta = SITE_REGISTRY[request.site_id]
    window = f"{meta['default_start']} to {meta['default_end']}"
    if request.foresight == "live_forecast":
        return payload.model_copy(
            update={
                "data_source": "precomputed_live_fallback",
                "note": (
                    f"Live tank sweep is not solved on the free-tier API (6 sequential CBC MILPs). "
                    f"Showing the precomputed 2026 peak-week sweep for {payload.site_name} ({window}), "
                    "default controls: 20% flexible load, physical plant, 100 MW, CoC 4, $85/MWh. "
                    "Swaps are off and the cap is unconstrained so the curve is storage value only."
                ),
            }
        )
    if request.foresight != "perfect":
        return None
    if request.start != meta["default_start"] or request.end != meta["default_end"]:
        return None
    return payload


def seed_runtime_caches() -> None:
    """Fill the in-memory fleet and tank caches from committed JSON. No solves."""
    from app.routers.plan import (  # local import: router imports this module
        _FLEET_CACHE,
        _TANK_CACHE,
        fleet_cache_key,
        tank_cache_key,
    )

    now = time.monotonic()
    ui_req = _request("dubai", "2026-07-20", "2026-07-26", "perfect", UI_FLEET)
    schema_req = _request("des-moines", "2025-07-08", "2025-07-14", "perfect", SCHEMA_FLEET)
    ui = load_fleet_ui()
    schema = load_fleet_schema()
    if ui is not None:
        _FLEET_CACHE[fleet_cache_key(ui_req)] = (now, ui)
        live_req = ui_req.model_copy(update={"foresight": "live_forecast", "live_days": 7})
        _FLEET_CACHE[fleet_cache_key(live_req)] = (
            now,
            ui.model_copy(update={"data_source": "precomputed_live_fallback", "note": LIVE_FLEET_NOTE}),
        )
    if schema is not None:
        _FLEET_CACHE[fleet_cache_key(schema_req)] = (now, schema)

    tanks = load_tanks()
    for site_id, payload in tanks.items():
        meta = SITE_REGISTRY.get(site_id)
        if meta is None:
            continue
        req = _request(site_id, meta["default_start"], meta["default_end"], "perfect", TANK_KNOBS)
        _TANK_CACHE[tank_cache_key(req)] = (now, payload)


def _request(site_id: str, start: str, end: str, foresight: str, knobs: dict) -> PlanRequest:
    return PlanRequest(
        site_id=site_id,
        start=start,
        end=end,
        foresight=foresight,  # type: ignore[arg-type]
        flexible_share=knobs.get("flexible_share", 0.20),
        tank_gallons=knobs.get("tank_gallons", 40_000),
        cap_ratio=knobs.get("cap_ratio", 0.78),
        flex_event=knobs.get("flex_event", False),
        flex_tighten=knobs.get("flex_tighten", 0.30),
        plant_model=knobs.get("plant_model", "physical"),
        it_capacity_mw=knobs.get("it_capacity_mw", 100),
        coc=knobs.get("coc", 4),
        electricity_price_usd_per_mwh=knobs.get("electricity_price_usd_per_mwh", 85),
        reclaimed_water_share=knobs.get("reclaimed_water_share", 0.0),
    )


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
