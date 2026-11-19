"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Calendar, CheckCircle2, Droplets, Globe, Radio, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { optimizerErrorText, runFleetCompare } from "@/lib/api";
import { formatGal, formatNum, formatUsdCompact } from "@/lib/format";
import { fleetSnapshot } from "@/lib/precomputed";
import type { HorizonMode } from "@/components/dashboard/ControlPanel";
import type { SiteId } from "@/lib/sites";
import type { FleetCompareResponse, PlanRequest } from "@/lib/types";

export function FleetTab({
  request,
  onInspectCampus,
}: {
  request: PlanRequest;
  onInspectCampus: (siteId: SiteId, mode?: HorizonMode) => void;
}) {
  const [fleetHorizon, setFleetHorizon] = useState<"live" | "peak2026">(
    request.foresight === "live_forecast" ? "live" : "peak2026",
  );
  const [fleet, setFleet] = useState<FleetCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [retry, setRetry] = useState(0);

  const reqKey = JSON.stringify({
    fleetHorizon,
    flexible_share: request.flexible_share,
    tank_gallons: request.tank_gallons,
    cap_ratio: request.cap_ratio,
    flex_event: request.flex_event,
    flex_tighten: request.flex_tighten,
    plant_model: request.plant_model,
    it_capacity_mw: request.it_capacity_mw,
    coc: request.coc,
    electricity_price_usd_per_mwh: request.electricity_price_usd_per_mwh,
    reclaimed_water_share: request.reclaimed_water_share ?? 0,
  });

  useEffect(() => {
    let cancel = false;
    const fleetReq: PlanRequest = {
      ...request,
      foresight: fleetHorizon === "live" ? "live_forecast" : "perfect",
      live_days: 7,
    };
    const snapshot = fleetSnapshot(fleetHorizon, fleetReq);
    setFleet(snapshot);
    setLoading(true);
    setError(null);
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    runFleetCompare(fleetReq)
      .then((res) => {
        if (!cancel) setFleet(res);
      })
      .catch((err: unknown) => {
        if (!cancel) {
          setError(optimizerErrorText(err, "Fleet comparison failed."));
          if (!snapshot) setFleet(null);
        }
      })
      .finally(() => {
        if (!cancel) setLoading(false);
        window.clearInterval(timer);
      });
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, retry]);

  return (
    <div className="space-y-4">
      {/* Fleet Mode Switcher: Live Today (Nov 2026) vs 2026 Summer Peak */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-bold text-marine">
            10-City Global Portfolio Comparison
          </h2>
          <p className="text-xs text-marine-muted">
            {fleetHorizon === "live"
              ? "Solving real-time 7-day forecasts across all 10 global corridors today."
              : "Stress-testing all 10 global corridors on their 2026 Peak Summer heatwave weeks."}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-line bg-subtle p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFleetHorizon("live")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
              fleetHorizon === "live" ? "bg-surface text-marine shadow-sm" : "text-marine-muted"
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Live 7-Day (Now)
          </button>
          <button
            type="button"
            onClick={() => setFleetHorizon("peak2026")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
              fleetHorizon === "peak2026" ? "bg-surface text-marine shadow-sm" : "text-marine-muted"
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-hydro" aria-hidden="true" />
            2026 Summer Peak
          </button>
        </div>
      </div>

      {loading && !fleet ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-subtle" />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-marine-muted">
            Solving all 10 corridors with PuLP CBC… {elapsed}s elapsed
          </p>
        </div>
      ) : null}

      {loading && fleet ? (
        <p className="text-center text-[11px] text-marine-muted">Checking the solver… {elapsed}s</p>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-flex/40 bg-flex-tint/40 p-4 text-xs text-flex">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="inline-flex items-center gap-1 rounded-md bg-flex px-2.5 py-1 font-semibold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {fleet?.note ? (
        <p className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-[11px] leading-relaxed text-marine-muted">
          {fleet.note}
        </p>
      ) : null}

      {fleet ? (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            <SummaryTile
              Icon={Droplets}
              label="10-Basin Peak Shaved"
              value={`${formatNum(fleet.total_mgd_avoided, 3)} MGD`}
              sub={`${formatGal(fleet.total_peak_gal_saved)} gal/day kept off utilities`}
            />
            <SummaryTile
              Icon={Users}
              label="Community Water Protected"
              value={`${fleet.total_households_protected.toLocaleString("en-US")} homes`}
              sub={`${fleet.total_people_protected.toLocaleString("en-US")} people/day (@ 150 L/day)`}
            />
            <SummaryTile
              Icon={Globe}
              label="Portfolio Avoided CAPEX"
              value={`${formatUsdCompact(fleet.total_capex_low_usd)}–${formatUsdCompact(fleet.total_capex_high_usd)}`}
              sub={`Across ${fleet.sites.length} × ${request.it_capacity_mw ?? 100} MW corridors`}
            />
            <SummaryTile
              Icon={CheckCircle2}
              label="Portfolio Extra Power"
              value={`${formatNum(fleet.total_extra_mwh, 1)} MWh`}
              sub="Total dry-cooling electricity across portfolio"
            />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {fleet.sites.map((site) => (
              <article key={site.site_id} className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-sm">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-marine">
                        {site.site_name}, {site.country}
                      </h3>
                      <p className="num text-xs text-marine-faint">
                        {site.window} | {site.grid_source}
                      </p>
                      {site.regulatory_framework ? (
                        <p className="mt-0.5 text-[11px] font-medium text-hydro">{site.regulatory_framework}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`num rounded px-2 py-0.5 text-[11px] font-semibold ${
                          (site.wri_stress_score ?? 50) >= 75
                            ? "bg-flex-tint text-flex"
                            : "bg-swap-tint text-swap"
                        }`}
                      >
                        WRI {site.wri_stress_score ?? 50} · {site.basin_stress_tier}
                      </span>
                      <span className="num inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Shield {site.permit_shield_score ?? 80}/100 · EED {site.eu_eed_rating ?? "B"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-line bg-subtle/50 p-3 text-xs">
                    <div>
                      <span className="block text-[11px] text-marine-faint">Baseline Peak</span>
                      <span className="num font-semibold text-heat">{formatGal(site.baseline_peak_gal)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-marine-faint">MILP Peak</span>
                      <span className="num font-bold text-hydro-dark">{formatGal(site.optimized_peak_gal)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-marine-faint">Peak Cut</span>
                      <span className="num font-bold text-emerald-700">-{site.peak_cut_pct.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-marine-muted">
                    <span>
                      <strong className="num text-marine">{site.households_daily_water_protected.toLocaleString("en-US")}</strong>{" "}
                      homes saved/d
                    </span>
                    <span>
                      5-Yr ROI: <strong className="num text-hydro-dark">{formatUsdCompact(site.five_year_net_roi_usd ?? 0)}</strong>
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-marine-faint">
                    Humid wet-bulb (&gt;20°C Tw): <span className="num font-semibold">{site.humid_wet_bulb_hours}/168h</span> | Extra power:{" "}
                    <span className="num font-semibold">{site.extra_mwh.toFixed(1)} MWh</span>
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className={`text-xs font-semibold ${site.cap_met ? "text-emerald-700" : "text-flex"}`}>
                    {site.cap_met ? "Firm Cap Held" : "Cap Shortfall"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onInspectCampus(site.site_id as SiteId, fleetHorizon)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-marine transition-colors hover:border-hydro hover:text-hydro"
                  >
                    <span>Inspect Campus</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryTile({
  Icon,
  label,
  value,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-marine-muted">
        <Icon className="h-4 w-4 text-hydro" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="num mt-2 font-display text-xl font-bold text-marine">{value}</p>
      <p className="mt-1 text-[11px] text-marine-faint">{sub}</p>
    </div>
  );
}
