"use client";

import { Clock, Database, Globe, Leaf, ShieldCheck, Users, Zap } from "lucide-react";
import { DailyWaterChart } from "@/components/charts/DailyWaterChart";
import { formatGal, formatMgd, formatNum, formatUsd, formatUsdCompact, shortDate, weekday } from "@/lib/format";
import type { PlanResponse } from "@/lib/types";

export function PeakCapTab({
  plan,
  siteLabel,
  windowLabel,
}: {
  plan: PlanResponse;
  siteLabel: string;
  windowLabel: string;
}) {
  const { levers, business_impact: biz, meta, optimized } = plan;
  const dailyRows = plan.days.map((d) => ({
    label: weekday(d.date),
    date: shortDate(d.date),
    temp: d.temp_max_c,
    baseline: d.baseline_gal,
    optimized: d.optimized_gal,
  }));

  const waterfall = [
    { label: "Uncontrolled Baseline", gal: levers.peak_baseline_gal, tone: "bg-heat-bright" },
    { label: "After Compute Shift", gal: levers.peak_after_schedule_gal, tone: "bg-hydro" },
    { label: "After Storage Tank", gal: levers.peak_after_tank_gal, tone: "bg-hydro-teal" },
    { label: "Final CBC MILP Peak", gal: levers.peak_final_gal, tone: "bg-marine" },
  ];

  return (
    <div className="space-y-4">
      {/* Primary Daily Withdrawal vs Firm Cap Chart */}
      <section aria-labelledby="daily-chart-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="daily-chart-heading" className="font-display text-base font-bold text-marine">
              Daily Utility Withdrawal vs. Firm Peak Cap
            </h2>
            <p className="mt-0.5 text-xs text-marine-muted">
              {siteLabel} ({windowLabel}). Orange bars show uncontrolled evaporation; hydro blue shows the CBC MILP schedule.
            </p>
          </div>
          <span className="num text-xs font-semibold text-marine">
            Cap: {formatGal(meta.cap_gal)} gal/day ({formatMgd(meta.cap_gal)})
          </span>
        </div>

        <div className="mt-3">
          <DailyWaterChart rows={dailyRows} cap={meta.cap_gal} showOptimized />
        </div>

        <details className="mt-3 border-t border-line pt-2.5 text-xs">
          <summary className="cursor-pointer font-semibold text-hydro hover:text-hydro-dark">
            Inspect daily water &amp; temperature table
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="border-b border-line text-[11px] font-semibold text-marine-faint">
                <tr>
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Max °C</th>
                  <th className="py-1.5 pr-3">Baseline gal</th>
                  <th className="py-1.5 pr-3">After Shift gal</th>
                  <th className="py-1.5 pr-3">MILP Withdrawal gal</th>
                  <th className="py-1.5">Firm Cap gal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plan.days.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 pr-3 font-medium text-marine">{d.date}</td>
                    <td className="num py-1.5 pr-3 text-marine-muted">{d.temp_max_c.toFixed(1)}</td>
                    <td className="num py-1.5 pr-3 text-marine-muted">{formatGal(d.baseline_gal)}</td>
                    <td className="num py-1.5 pr-3 text-marine-muted">{formatGal(d.scheduled_gal)}</td>
                    <td className="num py-1.5 pr-3 font-semibold text-hydro-dark">{formatGal(d.optimized_gal)}</td>
                    <td className="num py-1.5 text-marine-faint">{formatGal(d.cap_gal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Community Water & Carbon Impact Strip */}
      {biz ? (
        <section aria-labelledby="community-impact-heading" className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          <div className="bg-surface p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-marine-muted">
              <Users className="h-4 w-4 text-hydro-teal" aria-hidden="true" />
              <h2 id="community-impact-heading">Municipal Household Equivalent</h2>
            </div>
            <p className="num mt-1.5 text-xl font-bold text-marine">
              {(biz.households_daily_water_protected ?? 0).toLocaleString("en-US")} homes / day
            </p>
            <p className="mt-1 text-[11px] text-marine-faint">
              Peak-day supply kept available (@ 300 gal/household US EPA avg)
            </p>
          </div>
          <div className="bg-surface p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-marine-muted">
              <Users className="h-4 w-4 text-hydro" aria-hidden="true" />
              <span>Daily Citizen Drinking / WASH Equivalent</span>
            </div>
            <p className="num mt-1.5 text-xl font-bold text-marine">
              {(biz.people_daily_water_protected ?? 0).toLocaleString("en-US")} people / day
            </p>
            <p className="mt-1 text-[11px] text-marine-faint">
              Equates to 150 L/person/day basic urban allocation in {biz.basin_stress_tier ?? "stressed"} basins
            </p>
          </div>
          <div className="bg-surface p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-marine-muted">
              <Leaf className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>Carbon Saved vs. All-Dry Cooling</span>
            </div>
            <p className="num mt-1.5 text-xl font-bold text-emerald-800">
              {formatNum(biz.co2_avoided_vs_all_dry_tonnes ?? 0, 1)} t CO₂ avoided
            </p>
            <p className="mt-1 text-[11px] text-marine-faint">
              Targeted dry swaps added only {formatNum(biz.extra_co2_tonnes ?? 0, 1)} t CO₂ across window
            </p>
          </div>
        </section>
      ) : null}

      {/* Business ROI + 4-Lever Waterfall */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Business Value & Sister Guardrail */}
        <section aria-labelledby="roi-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h2 id="roi-heading" className="font-display text-base font-bold text-marine">
            Utility Capacity Economics &amp; Sister Guardrail
          </h2>
          <p className="mt-0.5 text-xs text-marine-muted">
            Municipal treatment &amp; pipe CAPEX avoided ($10M–$40M/MGD, Han et al. 2026) versus forced dry-cooling power spend.
          </p>

          {biz ? (
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
              <div className="bg-subtle/60 p-3">
                <span className="block text-[11px] font-medium text-marine-faint">Peak Supply Avoided</span>
                <span className="num mt-1 block text-lg font-bold text-marine">
                  {formatNum(biz.peak_mgd_avoided, 3)} MGD
                </span>
              </div>
              <div className="bg-subtle/60 p-3">
                <span className="block text-[11px] font-medium text-marine-faint">Avoided Water CAPEX</span>
                <span className="num mt-1 block text-lg font-bold text-hydro-dark">
                  {formatUsdCompact(biz.avoided_capex_low_usd)}–{formatUsdCompact(biz.avoided_capex_high_usd)}
                </span>
              </div>
              <div className="bg-surface p-3">
                <span className="block text-[11px] font-medium text-marine-faint">
                  Extra Power Cost (${Math.round(biz.electricity_price_usd_per_mwh)}/MWh)
                </span>
                <span className="num mt-1 block text-base font-bold text-swap">
                  {formatUsd(biz.extra_power_cost_usd)}
                </span>
              </div>
              <div className="bg-surface p-3">
                <span className="block text-[11px] font-medium text-marine-faint">Humid Wet-Bulb Hours (&gt;20°C Tw)</span>
                <span className="num mt-1 block text-base font-bold text-marine">
                  {biz.humid_wet_bulb_hours} / {plan.hours.length} h
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-md border border-line bg-subtle/50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-marine">
                Sister Campus ({levers.sister_name}) 110% Cap Guardrail
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {biz?.sister_guardrail_met !== false ? "GUARDRAIL MET" : "AT LIMIT"}
              </span>
            </div>
            <p className="mt-1.5 text-marine-muted">
              Baseline peak <span className="num font-semibold text-marine">{formatGal(levers.sister_baseline_peak_gal)} gal</span>
              {" -> "}
              with shifted load <span className="num font-semibold text-marine">{formatGal(levers.sister_peak_with_shift_gal)} gal</span>
              {" ("}
              <span className="num">{formatGal(levers.sister_added_gal)} gal</span> evaporated across window).
            </p>
          </div>
        </section>

        {/* 4-Stage Peak Reduction Waterfall & Lever Breakdown */}
        <section aria-labelledby="waterfall-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h2 id="waterfall-heading" className="font-display text-base font-bold text-marine">
            4-Lever Joint Control Waterfall
          </h2>
          <p className="mt-0.5 text-xs text-marine-muted">
            Contribution of each control lever from uncontrolled plant peak down to the firm utility cap.
          </p>

          <ol className="mt-3 space-y-2.5">
            {waterfall.map((step) => {
              const pct = levers.peak_baseline_gal > 0 ? Math.max(2, (step.gal / levers.peak_baseline_gal) * 100) : 0;
              return (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-marine">{step.label}</span>
                    <span className="num font-semibold text-marine">{formatGal(step.gal)} gal</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-subtle">
                    <div className={`h-full ${step.tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
            <LeverItem
              Icon={Clock}
              title="Time-Shift"
              value={`${formatNum(levers.time_shift_mwh, 0)} MWh`}
              sub="Moved -18h to +24h locally"
            />
            <LeverItem
              Icon={Globe}
              title="Space-Shift"
              value={`${formatNum(levers.space_shift_mwh, 0)} MWh`}
              sub={`Offloaded to ${levers.sister_name}`}
            />
            <LeverItem
              Icon={Zap}
              title="Dry-Cooling Swap"
              value={`${formatNum(levers.swap_mwh, 0)} MWh (${levers.swap_hours}h)`}
              sub={`+${formatNum(optimized.extra_mwh, 1)} MWh @ +0.15 PUE`}
            />
            <LeverItem
              Icon={Database}
              title="Tank Net Draw"
              value={`${formatGal(levers.tank_net_draw_gal)} gal`}
              sub={`${formatGal(meta.cap_gal > 0 ? plan.hours[0]?.tank_level_gal ?? 0 : 0)} gal end-hr level`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function LeverItem({
  Icon,
  title,
  value,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded border border-line bg-subtle/40 p-2.5">
      <div className="flex items-center gap-1.5 text-marine-muted">
        <Icon className="h-3.5 w-3.5 text-hydro" aria-hidden="true" />
        <span className="font-semibold text-marine">{title}</span>
      </div>
      <p className="num mt-1 font-semibold text-marine">{value}</p>
      <p className="text-[11px] text-marine-faint">{sub}</p>
    </div>
  );
}
