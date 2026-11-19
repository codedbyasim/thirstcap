"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatDelta, formatGal, formatMgd, formatNum, formatUsd, formatUsdCompact, shortDate } from "@/lib/format";
import type { PlanResponse } from "@/lib/types";

export function KpiGrid({ plan }: { plan: PlanResponse }) {
  const { baseline, optimized, meta, business_impact: biz } = plan;
  const peakSavedGal = Math.max(0, baseline.peak_day_gal - optimized.peak_day_gal);
  const capexText = biz
    ? `${formatUsdCompact(biz.avoided_capex_low_usd)}–${formatUsdCompact(biz.avoided_capex_high_usd)}`
    : "—";
  const potableGal = biz?.potable_peak_day_gal ?? optimized.peak_day_gal;
  const reclaimedGal = biz?.reclaimed_peak_day_gal ?? 0;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
      <KpiTile
        label="Peak-Day Municipal Draw"
        primary={`${formatGal(potableGal)} gal`}
        baseline={`${formatGal(baseline.peak_day_gal)} gal`}
        delta={formatDelta(potableGal, baseline.peak_day_gal)}
        note={
          reclaimedGal > 0
            ? `${formatGal(reclaimedGal)} gal TSE reclaimed + ${shortDate(optimized.peak_day_date)} total`
            : `${shortDate(baseline.peak_day_date)} baseline -> ${shortDate(optimized.peak_day_date)} peak`
        }
        accent="hydro"
      />
      <KpiTile
        label="5-Year CFO Water & CAPEX ROI"
        primary={biz ? formatUsdCompact(biz.five_year_net_roi_usd ?? 0) : "—"}
        delta={biz ? `${formatNum(biz.tank_payback_years ?? 0, 2)} yr payback` : null}
        note={
          biz
            ? `${formatUsdCompact(biz.annual_tariff_savings_usd ?? 0)}/yr tariff saved @ $${(biz.water_tariff_usd_per_kgal ?? 5.5).toFixed(2)}/kgal`
            : "Tariff savings + municipal CAPEX avoided"
        }
        accent="teal"
      />
      <KpiTile
        label="Avoided Municipal CAPEX"
        primary={capexText}
        delta={biz ? `-${formatMgd(peakSavedGal)}` : null}
        note="Han et al. 2026 ($10M–$40M per MGD peak supply avoided)"
        accent="teal"
      />
      <div className="flex flex-col justify-between bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-marine-muted">Permit Shield &amp; EU EED Rating</p>
          <span className="num inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Grade {biz?.eu_eed_rating ?? "B"}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num font-display text-xl font-bold text-marine">
            {biz?.permit_shield_score ?? 80} / 100
          </span>
          <span className="text-xs font-semibold text-hydro">{biz?.permit_shield_status ?? "Permit Ready"}</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-marine-faint">
          pWUE {formatNum(optimized.pwue_l_per_kwh, 2)} L/kWh | Peaking factor{" "}
          {formatNum(baseline.peaking_factor, 2)} -&gt; {formatNum(optimized.peaking_factor, 2)}
        </p>
      </div>
      <KpiTile
        label="Dry-Cooling Power Trade-off"
        primary={`+${formatNum(optimized.extra_mwh, 1)} MWh`}
        delta={biz ? formatUsd(biz.extra_power_cost_usd) : null}
        note={`${formatNum(optimized.grid_peak_mw, 2)} MW added on top-15% grid peak | Delay ${formatNum(optimized.avg_job_delay_min, 1)}m`}
        accent="swap"
      />
      <div className="flex flex-col justify-between bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-marine-muted">Utility Cap Compliance</span>
          {meta.cap_met ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              CAP MET
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-flex-tint px-2 py-0.5 text-[11px] font-semibold text-flex">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              SHORTFALL
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num font-display text-xl font-bold text-marine">
            {formatNum(optimized.water_capacity_impact * 100, 1)}%
          </span>
          <span className="text-xs font-medium text-marine-muted">total peak shaved</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-marine-faint">
          {meta.cap_met
            ? `Every day held under ${formatGal(meta.cap_gal)} gal/day (${formatMgd(meta.cap_gal)}).`
            : `Cap ${formatGal(meta.cap_gal)} gal missed by ${formatGal(meta.cap_shortfall_gal)} gal without breaking limits.`}
        </p>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  primary,
  baseline,
  delta,
  note,
  accent,
}: {
  label: string;
  primary: string;
  baseline?: string;
  delta?: string | null;
  note: string;
  accent: "hydro" | "teal" | "swap" | "neutral";
}) {
  const deltaCls =
    accent === "swap"
      ? "bg-swap-tint text-swap"
      : accent === "teal"
        ? "bg-hydro-tealtint text-teal-900"
        : "bg-hydro-tint text-hydro-dark";

  return (
    <article className="flex flex-col justify-between bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-marine-muted">{label}</p>
        {delta ? <span className={`num rounded px-1.5 py-0.5 text-[11px] font-semibold ${deltaCls}`}>{delta}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {baseline ? <span className="num text-xs text-marine-faint line-through">{baseline}</span> : null}
        <span className="num font-display text-xl font-bold text-marine">{primary}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-marine-faint">{note}</p>
    </article>
  );
}
