"use client";

import { Award, CheckCircle2, Droplets, FileCheck2, Printer, ShieldCheck, TrendingUp } from "lucide-react";
import { formatGal, formatMgd, formatNum, formatUsd, formatUsdCompact } from "@/lib/format";
import type { PlanRequest, PlanResponse } from "@/lib/types";

const EED_SCALE = [
  { grade: "A", range: "<= 0.35 L/kWh", desc: "Top-tier closed / reclaimed loop" },
  { grade: "B", range: "0.36–0.65", desc: "EU green compliance benchmark" },
  { grade: "C", range: "0.66–0.95", desc: "Moderate hybrid evaporative" },
  { grade: "D", range: "0.96–1.25", desc: "Standard seasonal cooling" },
  { grade: "E", range: "1.26–1.55", desc: "Elevated hot-climate draw" },
  { grade: "F", range: "1.56–1.85", desc: "High basin scarcity pressure" },
  { grade: "G", range: "> 1.85", desc: "Moratorium / audit risk zone" },
] as const;

export function ComplianceTab({
  plan,
  request,
}: {
  plan: PlanResponse;
  request: PlanRequest;
}) {
  const { meta, baseline, optimized, business_impact: biz } = plan;
  const reclaimedShare = request.reclaimed_water_share ?? 0;
  const tariff = biz?.water_tariff_usd_per_kgal ?? 5.5;
  const estTankCost = request.tank_gallons * 2.5;
  const annualTariff = biz?.annual_tariff_savings_usd ?? 0;
  const annualPowerCost = (biz?.extra_power_cost_usd ?? 0) * 12;
  const capexLow = biz?.avoided_capex_low_usd ?? 0;
  const net5y = biz?.five_year_net_roi_usd ?? 0;

  const activeGrade = biz?.eu_eed_rating ?? "B";
  const potableWue = optimized.pwue_l_per_kwh * (1 - reclaimedShare);

  const shieldChecks = [
    {
      label: "Daily Firm Municipal Cap Compliance",
      ok: meta.cap_met,
      pts: meta.cap_met ? "35 / 35" : "12 / 35",
      detail: meta.cap_met
        ? `Held under ${formatGal(meta.cap_gal)} gal/d across all 7 days.`
        : `Shortfall of ${formatGal(meta.cap_shortfall_gal)} gal on extreme heat hour.`,
    },
    {
      label: "Peak-Shaving Effectiveness",
      ok: optimized.water_capacity_impact >= 0.2,
      pts: `${Math.min(25, Math.round(optimized.water_capacity_impact * 100 * 0.65))} / 25`,
      detail: `Shaved -${formatNum(optimized.water_capacity_impact * 100, 1)}% off uncontrolled cooling peak.`,
    },
    {
      label: "Utility Electric Peak Protection",
      ok: optimized.grid_peak_mw <= 0.1,
      pts: optimized.grid_peak_mw <= 0.1 ? "15 / 15" : "5 / 15",
      detail: `${formatNum(optimized.grid_peak_mw, 2)} MW added during top-15% regional grid hours.`,
    },
    {
      label: "Cross-Basin Sister Campus Guardrail",
      ok: Boolean(biz?.sister_guardrail_met),
      pts: biz?.sister_guardrail_met ? "10 / 10" : "0 / 10",
      detail: `Prevents hiding water withdrawal in ${meta.sister_name} above 110% ceiling.`,
    },
    {
      label: "Reclaimed / TSE Non-Potable Cooling Blend",
      ok: reclaimedShare >= 0.25,
      pts: `${Math.min(15, Math.round(reclaimedShare * 25))} / 15`,
      detail: `${Math.round(reclaimedShare * 100)}% reclaimed source cuts municipal potable reliance.`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* EU EED (2024/1364) + ISO 30134-9 Rating Panel */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-hydro">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              EU Energy Efficiency Directive (2024/1364) &amp; ISO/IEC 30134-9
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-marine">
              Potable WUE Traceability &amp; Statutory Sustainability Grade
            </h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-3 py-2 text-xs font-semibold text-marine hover:border-hydro hover:text-hydro"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print Boardroom Audit
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-7">
          {EED_SCALE.map((item) => {
            const active = item.grade === activeGrade;
            return (
              <div
                key={item.grade}
                className={`rounded-lg border p-2.5 text-center transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30"
                    : "border-line bg-canvas text-marine-muted"
                }`}
              >
                <p className={`font-display text-xl font-bold ${active ? "text-emerald-700" : "text-marine"}`}>
                  {item.grade}
                </p>
                <p className="num mt-0.5 text-[10px] font-semibold">{item.range}</p>
                <p className="mt-1 text-[10px] leading-tight">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-subtle/50 p-3 text-xs">
            <span className="text-marine-muted">Gross Peak-Day WUE</span>
            <p className="num mt-1 font-display text-lg font-bold text-marine">
              {formatNum(optimized.pwue_l_per_kwh, 3)} L/kWh
            </p>
          </div>
          <div className="rounded-lg border border-line bg-subtle/50 p-3 text-xs">
            <span className="text-marine-muted">Net Municipal Potable WUE ({Math.round(reclaimedShare * 100)}% TSE)</span>
            <p className="num mt-1 font-display text-lg font-bold text-emerald-700">
              {formatNum(potableWue, 3)} L/kWh
            </p>
          </div>
          <div className="rounded-lg border border-line bg-subtle/50 p-3 text-xs">
            <span className="text-marine-muted">Peak Municipal Potable Draw</span>
            <p className="num mt-1 font-display text-lg font-bold text-hydro-dark">
              {formatGal(biz?.potable_peak_day_gal ?? optimized.peak_day_gal)} gal/d
            </p>
          </div>
        </div>
      </section>

      {/* 2-Column Split: Permit Shield Scorecard + CFO 5-Year Financial Model */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-marine">Permit &amp; Moratorium Shield Breakdown</h2>
            </div>
            <span className="num rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              {biz?.permit_shield_score ?? 80} / 100
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {shieldChecks.map((row) => (
              <li key={row.label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-none last:pb-0">
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${row.ok ? "text-emerald-600" : "text-amber-500"}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold text-marine">{row.label}</p>
                    <p className="text-[11px] text-marine-muted">{row.detail}</p>
                  </div>
                </div>
                <span className="num shrink-0 font-mono text-xs font-bold text-marine">{row.pts}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-hydro" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-marine">CFO 5-Year Water &amp; Tariff ROI Model</h2>
            </div>
            <span className="num rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-hydro-dark">
              ${tariff.toFixed(2)}/kgal Tariff
            </span>
          </div>

          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-marine-muted">5-Year Municipal Water Tariff Savings</dt>
              <dd className="num font-semibold text-emerald-700">+{formatUsd(annualTariff * 5)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-marine-muted">Avoided Municipal Supply CAPEX (Conservative Low)</dt>
              <dd className="num font-semibold text-emerald-700">+{formatUsd(capexLow)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-marine-muted">
                On-Site Storage Build CAPEX ({formatGal(request.tank_gallons)} gal × $2.50)
              </dt>
              <dd className="num font-semibold text-heat">-{formatUsd(estTankCost)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-marine-muted">5-Year Off-Peak Dry-Cooling Power OPEX</dt>
              <dd className="num font-semibold text-heat">-{formatUsd(annualPowerCost * 5)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-marine px-3.5 py-3 text-white">
              <dt className="font-display text-sm font-bold">Net 5-Year Value Creation (NPV Basis)</dt>
              <dd className="num font-display text-lg font-bold text-emerald-400">
                {formatUsdCompact(net5y)} ({formatUsd(net5y)})
              </dd>
            </div>
          </dl>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-marine-muted">
            <Droplets className="h-3.5 w-3.5 shrink-0 text-hydro" aria-hidden="true" />
            <span>
              Uncontrolled weekly baseline {formatGal(baseline.total_gal)} gal -&gt;{" "}
              {formatGal(optimized.total_gal)} gal total cooling ({formatMgd(biz?.peak_mgd_avoided ? biz.peak_mgd_avoided * 1_000_000 : 0)} peak shaved).
            </span>
          </p>
        </section>
      </div>

      {/* Audit Provenance Footer */}
      <section className="rounded-xl border border-line bg-subtle/60 p-4 text-xs text-marine-muted">
        <p className="flex items-center gap-1.5 font-semibold text-marine">
          <FileCheck2 className="h-4 w-4 text-hydro" aria-hidden="true" />
          Audit-Ready Traceability Log ({meta.site_name ?? meta.site_id})
        </p>
        <p className="mt-1">
          Regulatory context: <strong>{biz?.regulatory_framework}</strong>. Model: <span className="num">{meta.model}</span> · Status:{" "}
          <span className="num">{meta.solver_status ?? "Optimal"}</span> · Solve Latency:{" "}
          <span className="num">{meta.solve_time_ms ?? 0} ms</span>.
        </p>
      </section>
    </div>
  );
}
