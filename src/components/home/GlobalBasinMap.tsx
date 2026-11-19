"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Globe2, Loader2, Search, ShieldCheck } from "lucide-react";
import { BENCHMARKS } from "@/data/benchmarks";
import { geocodeCity, runPlan } from "@/lib/api";
import { formatCompact, formatNum, formatUsdCompact } from "@/lib/format";
import { projectGeo, SITES, summerPeak2026Window, type SiteId } from "@/lib/sites";
import type { CustomSiteInput, GeocodeResult, PlanResponse } from "@/lib/types";

const CONTINENT_PATHS = [
  "M 35 65 L 95 40 L 170 42 L 260 36 L 348 88 L 325 112 L 298 134 L 282 178 L 260 190 L 266 225 L 245 224 L 210 198 L 190 176 L 160 144 L 142 96 L 105 74 L 46 66 Z",
  "M 275 228 L 325 220 L 368 248 L 406 276 L 388 325 L 342 365 L 315 398 L 296 420 L 294 360 L 274 282 Z",
  "M 472 142 L 474 118 L 496 96 L 526 80 L 552 38 L 610 46 L 628 96 L 584 118 L 548 138 L 518 128 L 486 144 Z",
  "M 478 82 L 498 76 L 502 100 L 478 98 Z",
  "M 468 148 L 532 142 L 592 158 L 618 210 L 642 220 L 610 272 L 580 354 L 548 362 L 532 272 L 488 238 L 452 208 Z",
  "M 594 156 L 622 140 L 656 176 L 686 177 L 704 196 L 716 230 L 742 186 L 788 220 L 826 196 L 856 142 L 948 64 L 845 34 L 732 30 L 640 48 L 622 102 L 578 132 Z",
  "M 840 315 L 920 302 L 942 346 L 912 378 L 852 365 Z",
];

function guessSisterGeo(lat: number, lon: number) {
  if (lon < -50 && lat >= 15) return projectGeo(46.7867, -92.1005);
  if (lon < -30 && lat < 15) return projectGeo(-39.8196, -73.2452);
  if (-15 <= lon && lon <= 40 && lat >= 35) return projectGeo(59.9139, 10.7522);
  if (-20 <= lon && lon <= 62 && lat < 35) return projectGeo(47.3769, 8.5417);
  if (62 < lon && lon <= 92 && lat >= 5) return projectGeo(33.6844, 73.0479);
  if (lon > 92 && lat >= 0) return projectGeo(43.0618, 141.3545);
  return projectGeo(-42.8821, 147.3272);
}

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
  const bm = BENCHMARKS[selectedId];
  const customPin = customCity ? projectGeo(customCity.lat, customCity.lon) : null;
  const customSisterPin = customCity ? guessSisterGeo(customCity.lat, customCity.lon) : null;

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
          <svg
            viewBox="0 0 1000 440"
            className="h-auto w-full select-none"
            role="img"
            aria-label="Global data center water-stress hotspot corridors and custom city locator"
          >
            <defs>
              <radialGradient id="map-glow" cx="55%" cy="42%" r="55%">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#04111D" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect width="1000" height="440" fill="#04111D" rx="12" />
            <rect width="1000" height="440" fill="url(#map-glow)" rx="12" />

            {[88, 176, 264, 352].map((y) => (
              <line key={`h-${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="#1E3A5F" strokeOpacity="0.35" strokeWidth="1" />
            ))}
            {[166, 333, 500, 666, 833].map((x) => (
              <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="440" stroke="#1E3A5F" strokeOpacity="0.35" strokeWidth="1" />
            ))}

            {CONTINENT_PATHS.map((d, idx) => (
              <path key={idx} d={d} fill="#0D2640" stroke="#1E4976" strokeWidth="1.2" strokeLinejoin="round" />
            ))}

            {/* 10 Corridor Failover Arcs */}
            {SITES.map((s) => {
              const active = !customCity && s.id === selectedId;
              const mx = (s.mapCoords.x + s.sisterMapCoords.x) / 2;
              const my = Math.min(s.mapCoords.y, s.sisterMapCoords.y) - (active ? 28 : 16);
              const pathD = `M ${s.mapCoords.x} ${s.mapCoords.y} Q ${mx} ${my} ${s.sisterMapCoords.x} ${s.sisterMapCoords.y}`;
              return (
                <g key={`arc-${s.id}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={active ? "#10B981" : "#38BDF8"}
                    strokeWidth={active ? 2.2 : 1}
                    strokeOpacity={active ? 0.95 : 0.22}
                    strokeDasharray="4 4"
                  />
                  {active && (
                    <circle
                      cx={s.sisterMapCoords.x}
                      cy={s.sisterMapCoords.y}
                      r="4.5"
                      fill="#10B981"
                      stroke="#04111D"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              );
            })}

            {/* 10 Primary Hotspot Markers */}
            {SITES.map((s) => {
              const active = !customCity && s.id === selectedId;
              const extreme = s.wriScore >= 75;
              const color = extreme ? "#F43F5E" : "#38BDF8";
              return (
                <g
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setCustomCity(null);
                    setSelectedId(s.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${s.name}, ${s.country}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setCustomCity(null);
                      setSelectedId(s.id);
                    }
                  }}
                >
                  {!reduced && active && (
                    <motion.circle
                      cx={s.mapCoords.x}
                      cy={s.mapCoords.y}
                      r="10"
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      initial={{ r: 7, opacity: 0.9 }}
                      animate={{ r: 22, opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <circle
                    cx={s.mapCoords.x}
                    cy={s.mapCoords.y}
                    r={active ? 8 : 5.5}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth={active ? 2.2 : 1.2}
                  />
                  {active && (
                    <g transform={`translate(${Math.min(820, s.mapCoords.x + 12)}, ${Math.max(24, s.mapCoords.y - 14)})`}>
                      <rect width="166" height="24" rx="6" fill="#081B2E" stroke="#38BDF8" strokeWidth="1" />
                      <text x="10" y="16" fill="#FFFFFF" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                        {s.name} · WRI {s.wriScore}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Live Searched Global Custom City Pin */}
            {customCity && customPin && customSisterPin && (
              <g>
                <path
                  d={`M ${customPin.x} ${customPin.y} Q ${(customPin.x + customSisterPin.x) / 2} ${Math.min(customPin.y, customSisterPin.y) - 28} ${customSisterPin.x} ${customSisterPin.y}`}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.2"
                  strokeDasharray="4 4"
                />
                <circle cx={customSisterPin.x} cy={customSisterPin.y} r="4.5" fill="#10B981" stroke="#04111D" strokeWidth="1.5" />
                {!reduced && (
                  <motion.circle
                    cx={customPin.x}
                    cy={customPin.y}
                    r="10"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.2"
                    initial={{ r: 7, opacity: 0.9 }}
                    animate={{ r: 24, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <circle cx={customPin.x} cy={customPin.y} r="8.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.2" />
                <g transform={`translate(${Math.min(810, customPin.x + 12)}, ${Math.max(24, customPin.y - 14)})`}>
                  <rect width="175" height="24" rx="6" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
                  <text x="10" y="16" fill="#FFFFFF" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                    {customCity.name.split(",")[0]} · Global Live
                  </text>
                </g>
              </g>
            )}
          </svg>
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
                    <dt className="text-[11px] text-marine-muted">2026 Peak Cut</dt>
                    <dd className="num font-display text-lg font-bold text-emerald-700">-{bm.flex30.cut_pct}%</dd>
                    <dd className="num text-[11px] text-marine-muted">{formatCompact(bm.flex30.opt_peak)} gal cap</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">Permit Shield (w/ TSE)</dt>
                    <dd className="num inline-flex items-center gap-1 font-display text-lg font-bold text-marine-ink">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      {bm.flex30_tse35.shield}/100
                    </dd>
                    <dd className="num text-[11px] text-marine-muted">EU EED Grade {bm.flex30_tse35.eed}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">5-Yr Net Financial ROI</dt>
                    <dd className="num font-display text-lg font-bold text-hydro">
                      {formatUsdCompact(bm.flex30_tse35.roi5y)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-marine-muted">Households Protected</dt>
                    <dd className="num font-display text-lg font-bold text-marine-ink">
                      {bm.flex30.homes.toLocaleString("en-US")}/d
                    </dd>
                  </div>
                </dl>
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
          const b = BENCHMARKS[s.id];
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
                <span className="num font-semibold text-emerald-700">-{b.flex30.cut_pct}% cap</span>
                <span className="num font-semibold text-marine-ink">{formatUsdCompact(b.flex30_tse35.roi5y)} ROI</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
