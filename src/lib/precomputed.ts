import fleetUiJson from "../../backend/data/precomputed/fleet_ui.json";
import tanksJson from "../../backend/data/precomputed/tanks.json";
import type { FleetCompareResponse, FleetSiteSummary, PlanRequest, TankSizingResponse } from "@/lib/types";

export const FLEET_UI = fleetUiJson as FleetCompareResponse;

const tankFile = tanksJson as { scenario: string; sites: Record<string, TankSizingResponse> };

export const TANK_SCENARIO = tankFile.scenario;
export const TANKS: Record<string, TankSizingResponse> = tankFile.sites;

export const REPO_URL = "https://github.com/codedbyasim/thirstcap";

/** Dashboard defaults that the precomputed UI fleet was solved with. */
export function isUiFleetDefault(request: PlanRequest): boolean {
  return (
    near(request.flexible_share, 0.2) &&
    near(request.tank_gallons, 40_000) &&
    near(request.cap_ratio, 0.78) &&
    request.flex_event === true &&
    near(request.flex_tighten, 0.3) &&
    (request.plant_model ?? "physical") === "physical" &&
    near(request.it_capacity_mw ?? 100, 100) &&
    near(request.coc ?? 4, 4) &&
    near(request.electricity_price_usd_per_mwh ?? 85, 85) &&
    near(request.reclaimed_water_share ?? 0, 0.35)
  );
}

export function isDefaultTankKnobs(request: PlanRequest): boolean {
  return (
    request.site_id !== "custom" &&
    !request.custom_site &&
    near(request.flexible_share, 0.2) &&
    (request.plant_model ?? "physical") === "physical" &&
    near(request.it_capacity_mw ?? 100, 100) &&
    near(request.coc ?? 4, 4) &&
    near(request.electricity_price_usd_per_mwh ?? 85, 85)
  );
}

export function fleetSite(siteId: string): FleetSiteSummary | null {
  return FLEET_UI.sites.find((site) => site.site_id === siteId) ?? null;
}

export function defaultTank(request: PlanRequest): TankSizingResponse | null {
  if (!isDefaultTankKnobs(request)) return null;
  return TANKS[request.site_id] ?? null;
}

export function fleetSnapshot(horizon: "live" | "peak2026", request: PlanRequest): FleetCompareResponse | null {
  if (!isUiFleetDefault(request)) return null;
  if (horizon === "peak2026") return FLEET_UI;
  return {
    ...FLEET_UI,
    data_source: "precomputed_live_fallback",
    note:
      "Live 7-day fleet solve is served from the precomputed 2026 summer-peak run when the free-tier API cannot finish ten CBC solves plus weather fetches. Same default controls.",
  };
}

export function peakCutLabel(fleet: FleetCompareResponse = FLEET_UI): string {
  const cuts = fleet.sites.map((site) => site.peak_cut_pct);
  if (cuts.length === 0) return "—";
  const min = Math.min(...cuts);
  const max = Math.max(...cuts);
  if (Math.abs(min - max) < 0.05) return `${min.toFixed(1)}%`;
  return `${min.toFixed(1)}%–${max.toFixed(1)}%`;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-6;
}
