"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Database } from "lucide-react";
import { tooltipStyle } from "@/components/charts/tooltip";
import { runTankSizing } from "@/lib/api";
import { formatGal, formatUsd, formatUsdCompact } from "@/lib/format";
import type { PlanRequest, TankSizingResponse } from "@/lib/types";

export function TankSizingTab({
  request,
  currentTank,
  onApplyRecommendedTank,
}: {
  request: PlanRequest;
  currentTank: number;
  onApplyRecommendedTank: (gallons: number) => void;
}) {
  const [data, setData] = useState<TankSizingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqKey = JSON.stringify({
    site_id: request.site_id,
    start: request.start,
    end: request.end,
    flexible_share: request.flexible_share,
    plant_model: request.plant_model,
    it_capacity_mw: request.it_capacity_mw,
    coc: request.coc,
    electricity_price_usd_per_mwh: request.electricity_price_usd_per_mwh,
    foresight: request.foresight,
    custom_site: request.custom_site,
  });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    runTankSizing(request)
      .then((res) => {
        if (!cancel) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Tank sizing sweep failed.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <div className="h-64 animate-pulse rounded-md bg-subtle" />
        <p className="mt-3 text-center text-xs text-marine-muted">
          Running 6-point CBC MILP storage capacity sweep (0 to 160,000 gal)…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-flex/40 bg-flex-tint/40 p-4 text-xs text-flex">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.points.map((p) => ({
    label: p.tank_gallons === 0 ? "0 gal" : `${Math.round(p.tank_gallons / 1000)}k gal`,
    avoidedM: Number((p.avoided_capex_mid_usd / 1_000_000).toFixed(2)),
    tankCostM: Number((p.est_tank_build_cost_usd / 1_000_000).toFixed(2)),
    peakCut: Number(p.peak_cut_pct.toFixed(1)),
  }));

  const bestPoint = data.points.find((p) => p.tank_gallons === data.recommended_tank_gal);

  return (
    <div className="space-y-4">
      {/* Optimal Tank Callout */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-hydro/30 bg-hydro-tint/40 p-4">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-hydro-dark" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-bold text-marine">
              Optimal Water Storage Size for {data.site_name}:{" "}
              <span className="num text-hydro-dark">{formatGal(data.recommended_tank_gal)} gal</span>
            </h2>
            <p className="mt-0.5 text-xs text-marine-muted">
              Delivers{" "}
              <strong className="num text-marine">{bestPoint?.peak_cut_pct.toFixed(1)}%</strong> peak-day cut with{" "}
              <strong className="num text-marine">
                {bestPoint ? formatUsdCompact(bestPoint.net_capex_benefit_usd) : "—"}
              </strong>{" "}
              net CAPEX benefit (municipal supply avoided minus ${data.tank_cost_per_gal_usd.toFixed(2)}/gal steel tank CAPEX).
            </p>
          </div>
        </div>

        {Math.round(currentTank) !== Math.round(data.recommended_tank_gal) ? (
          <button
            type="button"
            onClick={() => onApplyRecommendedTank(data.recommended_tank_gal)}
            className="rounded-md bg-marine px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-hydro"
          >
            Apply {formatGal(data.recommended_tank_gal)} gal &amp; Solve
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Active Setting
          </span>
        )}
      </section>

      {/* Tank Size vs Avoided Municipal CAPEX & Peak Cut Chart */}
      <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <h3 className="font-display text-base font-bold text-marine">
          Storage Volume vs. Avoided Municipal CAPEX &amp; Peak Reduction
        </h3>
        <p className="mt-0.5 text-xs text-marine-muted">
          Evaluated via PuLP CBC MILP at 20%–30% flexible compute (dry-cooling swaps off) to size purely physical buffer value.
        </p>

        <div className="mt-4 h-72 w-full" role="img" aria-label="Tank volume ROI chart comparing avoided municipal CAPEX against build cost and peak cut percentage">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="usd"
                tickFormatter={(v) => `$${v}M`}
                tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#0D9488", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (String(name).includes("%")) return [`${Number(value).toFixed(1)}%`, String(name)];
                  return [`$${Number(value).toFixed(2)}M`, String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <Bar yAxisId="usd" dataKey="avoidedM" name="Avoided Municipal CAPEX ($M mid)" fill="#0369A1" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar yAxisId="usd" dataKey="tankCostM" name="Est. Tank Build Cost ($M)" fill="#94A3B8" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line yAxisId="pct" type="monotone" dataKey="peakCut" name="Peak Cut (%)" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Comparison Table */}
        <div className="mt-4 overflow-x-auto border-t border-line pt-3">
          <table className="w-full min-w-[38rem] text-left text-xs">
            <thead className="border-b border-line text-[11px] font-semibold text-marine-faint">
              <tr>
                <th className="py-2 pr-3">Tank Volume</th>
                <th className="py-2 pr-3">MILP Peak Day</th>
                <th className="py-2 pr-3">Peak Cut</th>
                <th className="py-2 pr-3">Est. Tank CAPEX</th>
                <th className="py-2 pr-3">Avoided Utility CAPEX (Mid)</th>
                <th className="py-2">Net Benefit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.points.map((pt) => {
                const isBest = pt.tank_gallons === data.recommended_tank_gal;
                return (
                  <tr key={pt.tank_gallons} className={isBest ? "bg-hydro-tint/25 font-semibold" : ""}>
                    <td className="num py-2 pr-3 text-marine">
                      {formatGal(pt.tank_gallons)} gal {isBest ? "(Optimal)" : ""}
                    </td>
                    <td className="num py-2 pr-3 text-marine-muted">{formatGal(pt.peak_day_gal)} gal</td>
                    <td className="num py-2 pr-3 text-hydro-dark">{pt.peak_cut_pct.toFixed(1)}%</td>
                    <td className="num py-2 pr-3 text-marine-muted">{formatUsd(pt.est_tank_build_cost_usd)}</td>
                    <td className="num py-2 pr-3 text-marine">{formatUsd(pt.avoided_capex_mid_usd)}</td>
                    <td className="num py-2 font-bold text-hydro-teal">{formatUsd(pt.net_capex_benefit_usd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
