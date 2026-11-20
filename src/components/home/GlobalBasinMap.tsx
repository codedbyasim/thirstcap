"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, Globe2, Loader2, Search, ShieldCheck } from "lucide-react";
import { geocodeCity, runPlan } from "@/lib/api";
import { formatCompact, formatGal, formatNum, formatUsdCompact } from "@/lib/format";
import { fleetSite } from "@/lib/precomputed";
import { SITES, summerPeak2026Window, type SiteId } from "@/lib/sites";
import type { CustomSiteInput, GeocodeResult, PlanResponse } from "@/lib/types";

function peakShavedGal(row: { baseline_peak_gal: number; optimized_peak_gal: number }): number {
  return Math.max(0, row.baseline_peak_gal - row.optimized_peak_gal);
}

const WorldCorridorMap = dynamic(
  () => import("@/components/home/WorldCorridorMap").then((mod) => mod.WorldCorridorMap),
  {
    ssr: false,
    loading: () => <div className="h-[440px] animate-pulse rounded-xl bg-[#071525] sm:h-[480px]" />,
  },
);

export function GlobalBasinMap() {
  const reduced = useReducedMotion();
  const [selectedId, setSelectedId] = useState<SiteId>("dubai");
  const [customCity, setCustomCity] = useState<CustomSiteInput | null>(null);
  const [customPlan, setCustomPlan] = useState<PlanResponse | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearching(true);
      geocodeCity(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  async function selectAnyCity(r: GeocodeResult) {
    const city: CustomSiteInput = {
      name: r.country ? `${r.name}, ${r.country}` : r.name,
      country: r.country,
      lat: r.lat,
      lon: r.lon,
      timezone: r.timezone,
    };
    setCustomCity(city);
    setQuery("");
    setResults([]);
    setCustomLoading(true);
    setCustomPlan(null);
    const win = summerPeak2026Window(r.lat);
    try {
      const plan = await runPlan({
        site_id: "custom",
        start: win.start,
        end: win.end,
        flexible_share: 0.2,
        tank_gallons: 40_000,
        cap_ratio: 0.78,
        flex_event: true,
        flex_tighten: 0.3,
        foresight: "perfect",
        plant_model: "physical",
        it_capacity_mw: 100,
        coc: 4.0,
        reclaimed_water_share: 0.35,
        custom_site: city,
      });
      setCustomPlan(plan);
    } finally {
      setCustomLoading(false);
    }
  }

  const site = SITES.find((s) => s.id === selectedId) ?? SITES[0];
  const corridor = fleetSite(selectedId);

  return (
    <section id="global-basins" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-hydro">
            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            Every City Worldwide + 10 Calibrated Stress Hubs
          </p>
          <h2 className="heading-balance mt-2 font-display text-3xl font-bold tracking-tight text-marine-ink sm:text-4xl">
            Run Any City on Earth or Inspect Global Water Corridors
          </h2>
          <p className="mt-2.5 text-base leading-relaxed text-marine-muted">
            Search any global data center market — from Mumbai, Riyadh, and Tokyo to London, São Paulo, or Johannesburg — to plot it live on the basin map and run 2026 PuLP CBC MILP telemetry.
          </p>
        </div>

        {/* Worldwide City Map Search */}
        <div className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-marine-faint" aria-hidden="true" />
          <input
            id="map-city-search"
            name="map_city_search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plot & analyze any city worldwide…"
            aria-label="Plot any city worldwide on map"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-9 text-sm text-marine-ink shadow-sm placeholder:text-marine-faint focus:border-hydro focus:outline-none"
          />
          {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-hydro" />}
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
              {results.map((r) => (
                <li key={`${r.name}-${r.lat}-${r.lon}`}>
                  <button
                    type="button"
                    onClick={() => void selectAnyCity(r)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-subtle"
                  >
                    <span className="font-semibold text-marine-ink">
                      {r.name}
                      {r.admin1 ? `, ${r.admin1}` : ""}
                    </span>
                    <span className="font-mono text-[11px] text-hydro">{r.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Interactive SVG Corridor Map + Live Basin Spotlight Panel */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#04111D] p-3 shadow-xl lg:col-span-8 sm:p-4">
          <WorldCorridorMap
            selectedId={selectedId}
            customCity={customCity}
            customWri={customPlan?.business_impact?.wri_stress_score ?? null}
            reduced={Boolean(reduced)}
            onSelectSite={(id) => {
              setCustomCity(null);
              setSelectedId(id);
            }}
          />
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-400">
            Basemap is OpenFreeMap (OpenStreetMap data, no API key). Pins use registry latitude and longitude. Color is the registry WRI score. The dashed arc is the model sister site for the selection. Scroll-zoom turns on after you click or focus the map.
          </p>
        </div>

        {/* Selected Basin OR Custom Global City Spotlight */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm lg:col-span-4">
          {customCity ? (
            <>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-700">
                    Global Live Geocoder
                  </span>
                  {customPlan?.business_impact && (
                    <span className="num rounded-full bg-sky-50 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-700">
                      WRI {customPlan.business_impact.wri_stress_score}/100
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-display text-2xl font-bold text-marine-ink">{customCity.name}</h3>
                <p className="num mt-1 text-xs font-medium text-hydro">
                  {customCity.lat.toFixed(2)}, {customCity.lon.toFixed(2)} · {customCity.timezone}
                </p>

                {customLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-marine-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-hydro" />
                    Solving 2026 peak-summer CBC MILP for {customCity.name.split(",")[0]}…
                  </div>
                ) : customPlan ? (
                  <>
                    <p className="mt-3 text-xs leading-relaxed text-marine-muted">
                      {customPlan.business_impact?.regulatory_framework}. Sister routing paired with{" "}
                      <strong>{customPlan.meta.sister_name}</strong> ({customPlan.meta.start} to {customPlan.meta.end}).
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                      <div>
                        <dt className="text-[11px] text-marine-muted">Stage 2 Peak Cut</dt>
                        <dd className="num font-display text-lg font-bold text-emerald-700">
                          -{formatNum(customPlan.optimized.water_capacity_impact * 100, 1)}%
                        </dd>
                        <dd className="num text-[11px] text-marine-muted">
                          {formatCompact(customPlan.optimized.peak_day_gal)} gal cap
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-marine-muted">Permit Shield</dt>
                        <dd className="num font-display text-lg font-bold text-marine-ink">
                          {customPlan.business_impact?.permit_shield_score ?? 90}/100
                        </dd>
                        <dd className="num text-[11px] text-marine-muted">
                          EU EED Grade {customPlan.business_impact?.eu_eed_rating ?? "A"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-marine-muted">5-Yr Net ROI</dt>
                        <dd className="num font-display text-lg font-bold text-hydro">
                          {formatUsdCompact(customPlan.business_impact?.five_year_net_roi_usd ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-marine-muted">Homes Protected</dt>
                        <dd className="num font-display text-lg font-bold text-marine-ink">
                          {(customPlan.business_impact?.households_daily_water_protected ?? 0).toLocaleString("en-US")}/d
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>

              <Link
                href={`/dashboard?mode=peak2026&custom_name=${encodeURIComponent(customCity.name)}&lat=${customCity.lat}&lon=${customCity.lon}&tz=${encodeURIComponent(customCity.timezone)}&country=${encodeURIComponent(customCity.country ?? "")}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                Inspect {customCity.name.split(",")[0]} 2026 Peak Plan
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-marine-ink/5 px-2.5 py-1 font-mono text-[11px] font-semibold text-marine-muted">
                    {site.corridorGroup}
                  </span>
                  <span
                    className={`num rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
                      site.wriScore >= 75
                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                        : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                    }`}
                  >
                    WRI {site.wriScore}/100 · {site.stressTier}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-2xl font-bold text-marine-ink">
                  {site.name}, {site.country}
                </h3>
                <p className="mt-1 text-xs font-medium text-hydro">{site.regulation}</p>
                <p className="mt-3 text-sm leading-relaxed text-marine-muted">{site.why}</p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-subtle/70 p-3.5 text-xs">
                  <p className="font-semibold text-marine-ink">Sister Failover Route: {site.sisterName}</p>
                  <p className="mt-1 text-marine-muted">{site.sisterNote}</p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <dt className="text-[11px] text-marine-muted">Shaved vs baseline</dt>
                    <dd className="num font-display text-lg font-bold text-emerald-700">
                      {corridor ? `${formatGal(peakShavedGal(corridor))} gal` : "—"}
                    </dd>
                    <dd className="text-[11px] text-marine-muted">
                      This site’s uncontrolled peak day minus its CBC peak
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">Permit Shield (w/ TSE)</dt>
                    <dd className="num inline-flex items-center gap-1 font-display text-lg font-bold text-marine-ink">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      {corridor ? `${corridor.permit_shield_score ?? "—"}/100` : "—"}
                    </dd>
                    <dd className="num text-[11px] text-marine-muted">
                      EU EED Grade {corridor?.eu_eed_rating ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">5-Yr Net Financial ROI</dt>
                    <dd className="num font-display text-lg font-bold text-hydro">
                      {corridor ? formatUsdCompact(corridor.five_year_net_roi_usd ?? 0) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">Households Protected</dt>
                    <dd className="num font-display text-lg font-bold text-marine-ink">
                      {corridor ? `${corridor.households_daily_water_protected.toLocaleString("en-US")}/d` : "—"}
                    </dd>
                  </div>
                </dl>
                {corridor ? (
                  <p className="mt-3 text-[11px] leading-relaxed text-marine-muted">
                    Precomputed CBC for {corridor.window}. Stage-2 defaults: cap 0.78 tightened 30%, 35% reclaimed, 40,000 gal tank, 100 MW.
                  </p>
                ) : null}
              </div>

              <Link
                href={`/dashboard?site=${site.id}&mode=live`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-marine px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-marine-panel"
              >
                Launch {site.name} Live Control Plane
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 10-Basin Interactive Directory Strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SITES.map((s) => {
          const active = !customCity && s.id === selectedId;
          const row = fleetSite(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setCustomCity(null);
                setSelectedId(s.id);
              }}
              aria-pressed={active}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                active
                  ? "border-hydro bg-sky-50/70 ring-1 ring-hydro/30"
                  : "border-line bg-surface hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-sm font-bold text-marine-ink">{s.name}</span>
                <span
                  className={`num rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    s.wriScore >= 75 ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"
                  }`}
                >
                  WRI {s.wriScore}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-marine-muted">
                {s.country} · {s.grid}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                <span className="num font-semibold text-emerald-700" title="Peak-day gallons shaved versus this site's uncontrolled baseline">
                  {row ? `${formatCompact(peakShavedGal(row))} gal shaved` : "—"}
                </span>
                <span className="num font-semibold text-marine-ink">
                  {row ? `${formatUsdCompact(row.five_year_net_roi_usd ?? 0)} ROI` : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
