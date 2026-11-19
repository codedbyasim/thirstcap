#!/usr/bin/env python3
"""Write default fleet-compare and tank-sizing results under backend/data/precomputed/.

Uses the same sweep functions as the API, with the ordinary 15s CBC limit (solves
finish well inside it on archive fixtures). Commit the JSON so the free-tier API
can return these requests without solving.

    python backend/scripts/precompute_sweeps.py
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.plan import FLEET_BENCHMARKS, run_fleet_sweep, run_tank_sweep  # noqa: E402
from app.schemas import PlanRequest  # noqa: E402
from app.services.grid import build_grid_series  # noqa: E402
from app.services.precomputed import PRECOMPUTED_DIR, SCHEMA_FLEET, UI_FLEET, write_json  # noqa: E402
from app.services.weather import SITE_REGISTRY, load_weather  # noqa: E402

UI_NOTE = (
    "Precomputed PuLP CBC fleet compare for each registry site's 2026 peak window. "
    "Controls: flexible share 0.20, tank 40,000 gal, cap ratio 0.78, stage-2 drought "
    "(flex_event, tighten 0.30), reclaimed water 0.35, 100 MW, cycles of concentration 4, "
    "$85/MWh. Weather is the committed Open-Meteo archive fixture for that window. "
    "Capex uses Han et al. 2026, $10M–$40M per MGD of peak supply avoided."
)
SCHEMA_NOTE = (
    "Precomputed PuLP CBC fleet compare for each registry site's 2026 peak window "
    "at API schema defaults: flexible share 0.20, tank 40,000 gal, cap ratio 0.78, "
    "flex_event off, reclaimed water 0, 100 MW, CoC 4, $85/MWh. "
    "Weather is the committed Open-Meteo archive fixture. "
    "Capex uses Han et al. 2026, $10M–$40M per MGD."
)


def _fleet_request(knobs: dict) -> PlanRequest:
    return PlanRequest(
        site_id="dubai",
        start="2026-07-20",
        end="2026-07-26",
        foresight="perfect",
        flexible_share=knobs["flexible_share"],
        tank_gallons=knobs["tank_gallons"],
        cap_ratio=knobs["cap_ratio"],
        flex_event=knobs["flex_event"],
        flex_tighten=knobs["flex_tighten"],
        plant_model=knobs["plant_model"],
        it_capacity_mw=knobs["it_capacity_mw"],
        coc=knobs["coc"],
        electricity_price_usd_per_mwh=knobs["electricity_price_usd_per_mwh"],
        reclaimed_water_share=knobs["reclaimed_water_share"],
    )


async def _weathers():
    return await asyncio.gather(
        *[
            load_weather(site_id=site_id, start=start, end=end, foresight="perfect")
            for site_id, start, end, _country, _grid in FLEET_BENCHMARKS
        ]
    )


async def _fleet(name: str, knobs: dict, note: str) -> None:
    t0 = time.perf_counter()
    weathers = await _weathers()
    result = await asyncio.to_thread(
        run_fleet_sweep,
        _fleet_request(knobs),
        weathers,
        workers=4,
        data_source="precomputed",
        note=note,
    )
    write_json(PRECOMPUTED_DIR / name, result.model_dump())
    print(f"{name}: {len(result.sites)} sites, {result.total_mgd_avoided} MGD, {time.perf_counter() - t0:.1f}s", flush=True)


async def _tanks() -> None:
    sites: dict = {}
    t0 = time.perf_counter()
    for site_id, meta in SITE_REGISTRY.items():
        req = PlanRequest(
            site_id=site_id,
            start=meta["default_start"],
            end=meta["default_end"],
            foresight="perfect",
            flexible_share=0.20,
            tank_gallons=40_000,
            plant_model="physical",
            it_capacity_mw=100,
            coc=4.0,
            electricity_price_usd_per_mwh=85,
        )
        weather = await load_weather(site_id, meta["default_start"], meta["default_end"], "perfect")
        grid = build_grid_series(weather.site_id, weather.grid_ba, weather.times, weather.temp_c)
        result = await asyncio.to_thread(
            run_tank_sweep,
            req,
            weather,
            grid,
            data_source="precomputed",
            note=(
                f"Precomputed 6-point CBC tank sweep for {meta['name']} "
                f"({meta['default_start']} to {meta['default_end']}). "
                "Swaps off, cap unconstrained, flexible share 0.20, physical plant, 100 MW, CoC 4, $85/MWh. "
                "Tank build cost is the model constant $2.50/gal. "
                "Avoided capex uses Han et al. 2026, $10M–$40M per MGD."
            ),
        )
        sites[site_id] = result.model_dump()
        print(f"tank {site_id}: recommended {result.recommended_tank_gal:.0f} gal", flush=True)
    write_json(
        PRECOMPUTED_DIR / "tanks.json",
        {
            "scenario": "Registry 2026 peak windows, default tank knobs, swaps off.",
            "sites": sites,
        },
    )
    print(f"tanks.json: {len(sites)} sites, {time.perf_counter() - t0:.1f}s", flush=True)


async def main() -> None:
    await _fleet("fleet_ui.json", UI_FLEET, UI_NOTE)
    await _fleet("fleet_schema.json", SCHEMA_FLEET, SCHEMA_NOTE)
    await _tanks()


if __name__ == "__main__":
    asyncio.run(main())
