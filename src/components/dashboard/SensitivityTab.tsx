"use client";

import { SensitivityChart } from "@/components/charts/SensitivityChart";
import { formatGal, formatNum } from "@/lib/format";
import type { PlanResponse, SensitivityResponse } from "@/lib/types";

export function SensitivityTab({
  plan,
  sensitivity,
  sensError,
  flexibleShare,
}: {
  plan: PlanResponse;
  sensitivity: SensitivityResponse | null;
  sensError: string | null;
  flexibleShare: number;
}) {
  const mix = plan.business_impact?.workload_mix_pct ?? { fixed: 80, deferrable: 8, pausable: 12 };

  return (
    <div className="space-y-4">
      {/* Flexible Share Sweep + Real Forecast Error Comparison */}
      <section aria-labelledby="sens-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <h2 id="sens-heading" className="font-display text-base font-bold text-marine">
          Value of Compute Flexibility (Dry-Cooling Swaps Disabled)
        </h2>
        <p className="mt-0.5 text-xs text-marine-muted">
          Measures pure peak reduction from shifting AI workloads + tank storage without buying extra dry-cooling electricity.
        </p>

        {sensError ? (
          <p className="mt-3 rounded-md border border-flex/30 bg-flex-tint/40 px-3 py-2 text-xs text-flex">
            {sensError}
          </p>
        ) : null}

        {sensitivity ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <SensitivityChart points={sensitivity.points} />

            <div className="flex flex-col justify-between rounded-md border border-line bg-subtle/50 p-4 text-xs">
              <div>
                <h3 className="font-display text-sm font-bold text-marine">
                  Forecast Foresight Backtest ({Math.round(flexibleShare * 100)}% Flex)
                </h3>
                <div className="mt-3 space-y-2 border-y border-line py-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-marine-muted">Perfect Weather</span>
                    <span className="num font-bold text-hydro-dark">
                      {formatNum(sensitivity.foresight.perfect_peak_cut_pct, 1)}% ({formatGal(sensitivity.foresight.perfect_peak_day_gal)} gal)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-marine-muted">Historical Forecast</span>
                    <span className="num font-bold text-marine">
                      {formatNum(sensitivity.foresight.forecast_peak_cut_pct, 1)}% ({formatGal(sensitivity.foresight.forecast_peak_day_gal)} gal)
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 leading-5 text-marine-muted">{sensitivity.foresight.note}</p>
              </div>
              <p className="mt-3 text-[11px] text-marine-faint">{sensitivity.label}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 h-60 animate-pulse rounded-md bg-subtle" aria-label="Computing sensitivity sweep" />
        )}
      </section>

      {/* Alibaba PAI 2020 Workload Mix + Assumptions Audit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="workload-mix-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h2 id="workload-mix-heading" className="font-display text-base font-bold text-marine">
            Alibaba PAI 2020 GPU Workload Classification
          </h2>
          <p className="mt-0.5 text-xs text-marine-muted">
            759,033 production ML jobs grouped by job runtime and scaled to the active flexible share.
          </p>

          <div className="mt-4 flex h-4 w-full overflow-hidden rounded-md border border-line">
            <div
              className="bg-marine"
              style={{ width: `${mix.fixed ?? 80}%` }}
              title={`Fixed (<15m): ${mix.fixed ?? 80}%`}
            />
            <div
              className="bg-hydro"
              style={{ width: `${mix.deferrable ?? 10}%` }}
              title={`Deferrable (15m–2h): ${mix.deferrable ?? 10}%`}
            />
            <div
              className="bg-hydro-teal"
              style={{ width: `${mix.pausable ?? 10}%` }}
              title={`Pausable (>2h): ${mix.pausable ?? 10}%`}
            />
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-line p-2.5">
              <dt className="font-medium text-marine-muted">Fixed (&lt;15m)</dt>
              <dd className="num mt-0.5 text-sm font-bold text-marine">{mix.fixed ?? 80}%</dd>
              <dd className="text-[11px] text-marine-faint">Locked arrival hr</dd>
            </div>
            <div className="rounded border border-line p-2.5">
              <dt className="font-medium text-marine-muted">Deferrable</dt>
              <dd className="num mt-0.5 text-sm font-bold text-hydro-dark">{mix.deferrable ?? 10}%</dd>
              <dd className="text-[11px] text-marine-faint">15m–2h batch</dd>
            </div>
            <div className="rounded border border-line p-2.5">
              <dt className="font-medium text-marine-muted">Pausable</dt>
              <dd className="num mt-0.5 text-sm font-bold text-hydro-teal">{mix.pausable ?? 10}%</dd>
              <dd className="text-[11px] text-marine-faint">&gt;2h training</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="audit-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h2 id="audit-heading" className="font-display text-base font-bold text-marine">
            Model Calibration &amp; Engineering Assumptions
          </h2>
          <p className="mt-0.5 text-xs text-marine-muted">
            Every physical parameter, boundary condition, and non-US grid disclosure returned directly by the solver.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-5 text-marine-muted">
            {plan.meta.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
