"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calendar, Droplets, Flame, Globe, Loader2, Radio, RefreshCw, Search, ShieldCheck, Wind, Zap } from "lucide-react";
import { geocodeCity, optimizerErrorText, runPlan } from "@/lib/api";
import { formatCompact, formatNum, formatUsdCompact } from "@/lib/format";
import { presetsFor, siteById, summerPeak2026Window, type SiteId } from "@/lib/sites";
import type { CustomSiteInput, GeocodeResult, PlanRequest, PlanResponse } from "@/lib/types";

type QuickChoice =
  | { kind: "preset"; siteId: SiteId; short: string; custom?: never }
  | { kind: "custom"; short: string; custom: CustomSiteInput; siteId?: never };

const QUICK_CITIES: QuickChoice[] = [
  { kind: "preset", siteId: "dubai", short: "Dubai" },
  { kind: "preset", siteId: "phoenix", short: "Phoenix" },
  { kind: "preset", siteId: "northern-virginia", short: "N. Virginia" },
  {
    kind: "custom",
    short: "Mumbai",
    custom: { name: "Mumbai, India", country: "India", lat: 19.076, lon: 72.8777, timezone: "Asia/Kolkata" },
  },
  {
    kind: "custom",
    short: "Tokyo",
    custom: { name: "Tokyo, Japan", country: "Japan", lat: 35.6895, lon: 139.6917, timezone: "Asia/Tokyo" },
  },
  { kind: "preset", siteId: "zaragoza", short: "Zaragoza" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function HeroSimulator() {
  const reduced = useReducedMotion();
  const [timeframe, setTimeframe] = useState<"live" | "peak2026">("live");
  const [presetSiteId, setPresetSiteId] = useState<SiteId>("dubai");
  const [customCity, setCustomCity] = useState<CustomSiteInput | null>(null);
  const [flexOn, setFlexOn] = useState(true);
  const [tseOn, setTseOn] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [livePlan, setLivePlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      geocodeCity(q)
        .then((res) => setResults(res))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const requestedWindow = (() => {
    if (timeframe === "live") return { start: todayIso(), end: plusDaysIso(6) };
    if (customCity) {
      const peak = summerPeak2026Window(customCity.lat);
      return { start: peak.start, end: peak.end };
    }
    const preset = presetsFor(presetSiteId)[0];
    return { start: preset.start, end: preset.end };
  })();

  const solveHero = useCallback(async () => {
    const id = seq.current + 1;
    seq.current = id;
    setLivePlan(null);
    setLoading(true);
    setError(null);
    const isLive = timeframe === "live";
    let start = todayIso();
    let end = plusDaysIso(6);
    if (!isLive) {
      if (customCity) {
        const peak = summerPeak2026Window(customCity.lat);
        start = peak.start;
        end = peak.end;
      } else {
        const preset = presetsFor(presetSiteId)[0];
        start = preset.start;
        end = preset.end;
      }
    }
    const req: PlanRequest = {
      site_id: customCity ? "custom" : presetSiteId,
      start,
      end,
      flexible_share: 0.2,
      tank_gallons: 40_000,
      cap_ratio: 0.78,
      flex_event: flexOn,
      flex_tighten: 0.3,
      foresight: isLive ? "live_forecast" : "perfect",
      live_days: 7,
      plant_model: "physical",
      it_capacity_mw: 100,
      coc: 4.0,
      reclaimed_water_share: flexOn && tseOn ? 0.35 : 0,
      ...(customCity ? { custom_site: customCity } : {}),
    };
    try {
      const res = await runPlan(req);
      if (seq.current !== id) return;
      const sameSite = customCity ? res.meta.site_id === "custom" : res.meta.site_id === presetSiteId;
      if (!sameSite) return;
      setLivePlan(res);
    } catch (err: unknown) {
      if (seq.current !== id) return;
      setLivePlan(null);
      setError(optimizerErrorText(err, "Live solve unavailable."));
    } finally {
      if (seq.current === id) setLoading(false);
    }
  }, [customCity, presetSiteId, timeframe, flexOn, tseOn]);

  const reqTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (reqTimerRef.current) window.clearTimeout(reqTimerRef.current);
    reqTimerRef.current = window.setTimeout(() => {
      void solveHero();
    }, 60);
    return () => {
      if (reqTimerRef.current) window.clearTimeout(reqTimerRef.current);
    };
  }, [solveHero]);

  const registrySite = customCity ? null : siteById(presetSiteId);
  const activeName = customCity
    ? customCity.name
    : `${registrySite?.name ?? ""}, ${registrySite?.country ?? ""}`;

  const planMatches =
    livePlan != null &&
    (customCity ? livePlan.meta.site_id === "custom" : livePlan.meta.site_id === presetSiteId);
  const plan = planMatches ? livePlan : null;
  const biz = plan?.business_impact;
  const reclaimedRatio = flexOn && tseOn ? 0.35 : 0;

  const daysData = plan
    ? plan.days.map((d) => ({
        d: d.date.slice(5),
        b: Math.round(d.baseline_gal),
        o: Math.round(d.optimized_gal),
        c: Math.round(d.cap_gal),
      }))
    : [];

  const firmCap = plan ? Math.round(plan.meta.cap_gal) : null;
  const rawMax = daysData.length ? Math.max(1, ...daysData.map((d) => Math.max(d.b, d.o, firmCap ?? 0))) : 1;
  const maxVal = rawMax * 1.1;
  const capPct = firmCap == null ? 0 : Math.max(6, Math.min(95, (firmCap / maxVal) * 100));

  const coolToday = plan ? plan.baseline.peak_day_gal < 100 : false;
  const peakCutPct = plan ? Number((plan.optimized.water_capacity_impact * 100).toFixed(1)) : null;
  const shield = biz?.permit_shield_score;
  const eedGrade = biz?.eu_eed_rating;
  const wriScore = biz?.wri_stress_score ?? registrySite?.wriScore ?? null;
  const framework = biz?.regulatory_framework ?? registrySite?.regulation ?? null;
  const tariff = biz?.water_tariff_usd_per_kgal ?? registrySite?.tariffUsdPerKgal ?? null;
  const potablePeak = plan ? (biz?.potable_peak_day_gal ?? plan.optimized.peak_day_gal) : null;
  const roi5y = biz?.five_year_net_roi_usd;
  const capexLow = biz?.avoided_capex_low_usd;
  const capexHigh = biz?.avoided_capex_high_usd;
  const homesProtected = biz?.households_daily_water_protected;
  const gridPeakMw = plan ? plan.optimized.grid_peak_mw : null;
  const solvedWindow = plan ? `${plan.meta.start} to ${plan.meta.end}` : null;
  const requestedLabel = `${requestedWindow.start} to ${requestedWindow.end}`;
  const windowStr =
    solvedWindow && solvedWindow !== requestedLabel ? `${solvedWindow} · requested ${requestedLabel}` : solvedWindow ?? requestedLabel;

  const dashboardHref = customCity
    ? `/dashboard?mode=${timeframe === "live" ? "live" : "peak2026"}&custom_name=${encodeURIComponent(customCity.name)}&lat=${customCity.lat}&lon=${customCity.lon}&tz=${encodeURIComponent(customCity.timezone)}&country=${encodeURIComponent(customCity.country ?? "")}`
    : `/dashboard?site=${presetSiteId}&mode=${timeframe === "live" ? "live" : "peak2026"}`;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#0A1E33]/95 p-5 shadow-2xl shadow-black/40 sm:p-6">
      {/* Top Bar: Header + Shield/EED Badges */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-400">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Global Live Basin Simulator
            </span>
            <span className="num rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
              {timeframe === "live" ? "LIVE 2026" : "2026 PEAK"}
            </span>
          </div>
          <p className="mt-1 truncate font-display text-lg font-bold text-white">{activeName}</p>
          <p className="text-xs text-slate-400">
            WRI Stress{" "}
            <span className="num font-semibold text-amber-300">{wriScore == null ? "—" : `${wriScore}/100`}</span>
            {framework ? ` · ${framework}` : loading ? " · solving this site" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${
              shield != null && shield >= 80
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-sky-500/40 bg-sky-500/15 text-sky-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {shield == null ? "Shield —" : `Shield ${shield}/100`}
          </span>
          <span className="rounded-full border border-slate-700 bg-[#04111D] px-2.5 py-1 font-mono text-[11px] font-bold text-sky-300">
            {eedGrade ? `EED ${eedGrade}` : "EED —"}
          </span>
        </div>
      </div>

      {/* Worldwide City Search Input */}
      <div className="relative mt-3.5">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          id="hero-city-search"
          name="hero_city_search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ANY city worldwide (Tokyo, Mumbai, London…)"
          aria-label="Search any global city for live water optimization"
          className="w-full rounded-xl border border-slate-700 bg-[#04111D] py-2 pl-9 pr-16 text-xs text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none sm:text-sm"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-sky-400" aria-hidden="true" />
        )}
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-52 divide-y divide-slate-800 overflow-y-auto rounded-xl border border-slate-700 bg-[#04111D] shadow-2xl">
            {results.map((r) => (
              <li key={`${r.name}-${r.lat}-${r.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCity({
                      name: r.country ? `${r.name}, ${r.country}` : r.name,
                      country: r.country,
                      lat: r.lat,
                      lon: r.lon,
                      timezone: r.timezone,
                    });
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-slate-800/80"
                >
                  <span className="font-semibold text-white">
                    {r.name}
                    {r.admin1 ? `, ${r.admin1}` : ""}
                  </span>
                  <span className="num text-[11px] text-sky-300">{r.country}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick Global Pills + Live vs 2026 Peak Switcher */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Featured global cities">
          {QUICK_CITIES.map((c) => {
            const active =
              c.kind === "custom"
                ? Boolean(customCity && customCity.name === c.custom.name)
                : Boolean(!customCity && presetSiteId === c.siteId);
            return (
              <button
                key={c.short}
                type="button"
                onClick={() => {
                  if (c.kind === "custom") {
                    setCustomCity(c.custom);
                  } else {
                    setCustomCity(null);
                    setPresetSiteId(c.siteId);
                  }
                }}
                aria-pressed={active}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-sky-500 text-[#04111D]"
                    : "border border-slate-700/80 bg-[#04111D] text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                {c.short}
              </button>
            );
          })}
        </div>

        <div className="inline-flex rounded-lg border border-slate-700 bg-[#04111D] p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setTimeframe("live")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
              timeframe === "live" ? "bg-emerald-500 text-[#04111D]" : "text-slate-300 hover:text-white"
            }`}
          >
            <Radio className="h-3 w-3" aria-hidden="true" />
            Live 7-Day
          </button>
          <button
            type="button"
            onClick={() => setTimeframe("peak2026")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
              timeframe === "peak2026" ? "bg-sky-500 text-[#04111D]" : "text-slate-300 hover:text-white"
            }`}
          >
            <Calendar className="h-3 w-3" aria-hidden="true" />
            2026 Peak
          </button>
        </div>
      </div>

      {/* Control Toggles: Stage 2 Drought + 35% Reclaimed TSE */}
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setFlexOn((v) => !v)}
          aria-pressed={flexOn}
          className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            flexOn
              ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
              : "border-slate-700 bg-[#04111D] text-slate-300 hover:border-slate-500"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            Stage 2 Drought (-30%)
          </span>
          <span className="num rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
            {flexOn ? "ACTIVE" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTseOn((v) => !v)}
          disabled={!flexOn}
          aria-pressed={flexOn && tseOn}
          className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            !flexOn
              ? "cursor-not-allowed border-slate-800 bg-[#04111D]/60 text-slate-500"
              : tseOn
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-slate-700 bg-[#04111D] text-slate-300 hover:border-slate-500"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            35% Reclaimed TSE Mix
          </span>
          <span className="num rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
            {flexOn && tseOn ? "35%" : "0%"}
          </span>
        </button>
      </div>

      {/* Live Daily Chart Box */}
      <div className="mt-3.5 rounded-xl border border-slate-800 bg-[#04111D] p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            {loading && <Loader2 className="h-3 w-3 animate-spin text-sky-400" />}
            Firm Cap:{" "}
            <strong className="num text-emerald-400">
              {firmCap == null ? "—" : `${formatCompact(firmCap)} gal/day`}
            </strong>
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-orange-500" />
              Baseline
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-sky-400" />
              Potable
            </span>
            {reclaimedRatio > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                TSE
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="h-0 w-3 border-t border-dashed border-emerald-400" />
              Cap
            </span>
          </div>
        </div>

        {!plan ? (
          <div className="mt-2 space-y-2" aria-hidden="true">
            <div className="flex h-36 items-end gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-1">
                  <div className="h-24 animate-pulse rounded-t bg-slate-800" />
                  <div className="mx-auto h-2 w-6 animate-pulse rounded bg-slate-800" />
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-slate-400">
              Solving {activeName.split(",")[0]} for {requestedLabel}…
            </p>
          </div>
        ) : coolToday ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-sky-800/50 bg-sky-950/30 px-4 text-center">
            <Wind className="h-6 w-6 text-sky-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-white">
              Cool Live Weather in {activeName.split(",")[0]} (&lt;25°C Dry-Bulb)
            </p>
            <p className="text-[11px] text-slate-300">
              Free air economizers run with ~0 gal cooling water over {windowStr}.
            </p>
            <button
              type="button"
              onClick={() => setTimeframe("peak2026")}
              className="rounded-lg bg-sky-500 px-3 py-1 text-[11px] font-bold text-[#04111D] hover:bg-sky-400"
            >
              Stress-Test 2026 Peak Summer →
            </button>
          </div>
        ) : (
          <div className="relative mt-2 h-36 select-none pt-3">
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-emerald-400/85"
              style={{ bottom: `calc(20px + ${(capPct / 100) * 108}px)` }}
            >
              <span className="num absolute -top-4 right-0 rounded bg-emerald-950/95 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                CAP {formatCompact(firmCap ?? 0)}
              </span>
            </div>

            <div className="flex h-full items-end gap-2">
              {daysData.map((day) => {
                const baseH = day.b > 0 ? Math.max(6, (day.b / maxVal) * 108) : 2;
                const optTotalH = day.o > 0 ? Math.max(6, (day.o / maxVal) * 108) : 2;
                const potableH = Math.round(optTotalH * (1 - reclaimedRatio));
                const tseH = Math.max(0, optTotalH - potableH);

                return (
                  <div key={day.d} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-[108px] w-full items-end justify-center gap-1">
                      <motion.div
                        className="w-2.5 rounded-t bg-orange-500/80 sm:w-3"
                        initial={false}
                        animate={{ height: baseH }}
                        transition={reduced ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
                        title={`Baseline ${day.d}: ${day.b.toLocaleString("en-US")} gal`}
                      />
                      <div className="flex w-2.5 flex-col-reverse overflow-hidden rounded-t sm:w-3">
                        <motion.div
                          className="w-full bg-sky-400"
                          initial={false}
                          animate={{ height: potableH }}
                          transition={reduced ? { duration: 0 } : { duration: 0.38, ease: "easeOut" }}
                        />
                        {reclaimedRatio > 0 && (
                          <motion.div
                            className="w-full bg-emerald-400"
                            initial={false}
                            animate={{ height: tseH }}
                            transition={reduced ? { duration: 0 } : { duration: 0.38, ease: "easeOut" }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="num text-[10px] text-slate-400">{day.d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom 4 Executive KPI Tiles */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#04111D] p-2.5">
          <p className="text-[10.5px] font-medium text-slate-400">Peak Cut</p>
          <p className="num font-display text-lg font-bold text-emerald-400">
            {!plan ? "—" : coolToday ? "0 gal" : `-${formatNum(peakCutPct ?? 0, 1)}%`}
          </p>
          <p className="num text-[10.5px] text-slate-400">{potablePeak == null ? "—" : `${formatCompact(potablePeak)} pot.`}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#04111D] p-2.5">
          <p className="text-[10.5px] font-medium text-slate-400">5-Yr Net ROI</p>
          <p className="num font-display text-lg font-bold text-sky-300">{roi5y == null ? "—" : formatUsdCompact(roi5y)}</p>
          <p className="num text-[10.5px] text-slate-400">{tariff == null ? "—" : `$${tariff.toFixed(2)}/kgal`}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#04111D] p-2.5">
          <p className="text-[10.5px] font-medium text-slate-400">CAPEX Avoided</p>
          <p className="num font-display text-sm font-bold text-white sm:text-base">
            {capexLow == null || capexHigh == null ? "—" : `${formatUsdCompact(capexLow)}–${formatUsdCompact(capexHigh)}`}
          </p>
          <p className="num text-[10.5px] text-slate-400">
            {homesProtected == null ? "—" : `${homesProtected.toLocaleString("en-US")} homes/d`}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#04111D] p-2.5">
          <p className="text-[10.5px] font-medium text-slate-400">Grid Peak Add</p>
          <p className="num inline-flex items-center gap-1 font-display text-lg font-bold text-white">
            <Zap className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            {gridPeakMw == null ? "—" : `${gridPeakMw} MW`}
          </p>
          <p className="num truncate text-[10.5px] text-slate-400">
            {typeof plan?.meta.solve_time_ms === "number"
              ? `${plan.meta.solve_time_ms.toLocaleString("en-US")} ms CBC`
              : "waiting for solve"}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-rose-950/60 px-2.5 py-1.5 text-[11px] text-rose-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void solveHero()}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-rose-800 px-2 py-0.5 font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400">
          Window: <span className="num text-slate-200">{windowStr}</span>
        </span>
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300"
        >
          Open {activeName.split(",")[0]} in Control Plane
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
