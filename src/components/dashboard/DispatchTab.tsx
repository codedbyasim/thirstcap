"use client";

import { Terminal } from "lucide-react";
import { HourlyChart } from "@/components/charts/HourlyChart";
import { TankChart } from "@/components/charts/TankChart";
import { DispatchMatrix } from "@/components/dashboard/DispatchMatrix";
import { formatGal, hourLabel, shortDate } from "@/lib/format";
import type { PlanResponse } from "@/lib/types";

export function DispatchTab({
  plan,
  horizon,
  onChangeHorizon,
  tankCapacity,
}: {
  plan: PlanResponse;
  horizon: "72h" | "week";
  onChangeHorizon: (h: "72h" | "week") => void;
  tankCapacity: number;
}) {
  const canToggleWeek = plan.hours.length > 72;
  const slice = !canToggleWeek || horizon === "72h" ? plan.hours.slice(0, 72) : plan.hours;

  const hourlyRows = slice.map((h, i) => ({
    label: i % 24 === 0 ? shortDate(h.time.slice(0, 10)) : hourLabel(h.time),
    time: h.time,
    temp: h.temp_c,
    wetBulb: h.wet_bulb_c ?? h.temp_c - 4,
    load: h.load_mw,
    space: h.space_shift_out_mw,
    mode: h.cooling_mode,
  }));

  const tankRows = slice.map((h, i) => ({
    label: i % 24 === 0 ? shortDate(h.time.slice(0, 10)) : hourLabel(h.time),
    time: h.time,
    level: h.tank_level_gal ?? 0,
    fill: h.tank_fill_gal ?? 0,
    draw: h.tank_draw_gal ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* Hourly Compute & Wet-Bulb Chart */}
      <section aria-labelledby="hourly-dispatch-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="hourly-dispatch-heading" className="font-display text-base font-bold text-marine">
              Hourly IT Load Dispatch &amp; Ambient Wet-Bulb Profile
            </h2>
            <p className="mt-0.5 text-xs text-marine-muted">
              Flexible compute leaves peak temperature/wet-bulb hours for cooler nights or the sister site.
            </p>
          </div>
          {canToggleWeek ? (
            <div className="flex rounded-md border border-line bg-subtle p-0.5 text-xs font-semibold" role="group" aria-label="Horizon view">
              {(["72h", "week"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={horizon === opt}
                  onClick={() => onChangeHorizon(opt)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    horizon === opt ? "bg-surface text-marine shadow-sm" : "text-marine-muted hover:text-marine"
                  }`}
                >
                  {opt === "72h" ? "First 72h" : "Full 7 days"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-3">
          <HourlyChart rows={hourlyRows} itCap={plan.meta.it_capacity_mw ?? 100} />
        </div>
      </section>

      {/* Interactive Day x 24h Cooling & Shift Matrix */}
      <section aria-labelledby="matrix-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3">
          <h2 id="matrix-heading" className="font-display text-base font-bold text-marine">
            Hourly Cooling Mode &amp; Load-Shift Matrix
          </h2>
          <p className="mt-0.5 text-xs text-marine-muted">
            Click any hour cell to inspect dry-bulb, wet-bulb, IT shift, tank level, and balancing-authority grid demand.
          </p>
        </div>
        <DispatchMatrix hours={slice} />
      </section>

      {/* Tank State-of-Charge */}
      <section aria-labelledby="tank-chart-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="tank-chart-heading" className="font-display text-base font-bold text-marine">
              On-Site Water Tank State-of-Charge
            </h2>
            <p className="mt-0.5 text-xs text-marine-muted">
              Tank starts full ({formatGal(tankCapacity)} gal) and dispatches across hot peak hours to flatten daily utility draws.
            </p>
          </div>
          <span className="num text-xs font-semibold text-hydro-teal">
            Capacity: {formatGal(tankCapacity)} gal
          </span>
        </div>
        <div className="mt-3">
          {tankCapacity > 0 ? (
            <TankChart rows={tankRows} capacity={tankCapacity} />
          ) : (
            <p className="rounded-md bg-subtle px-3 py-6 text-center text-xs text-marine-muted">
              Tank storage is set to 0 gal. Increase the Water Tank slider in Configuration to evaluate storage shaving.
            </p>
          )}
        </div>
      </section>

      {/* Actionable Compute & Plant Dispatch Windows */}
      {plan.dispatch_windows && plan.dispatch_windows.length > 0 ? (
        <section aria-labelledby="dispatch-windows-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-hydro" aria-hidden="true" />
            <h2 id="dispatch-windows-heading" className="font-display text-base font-bold text-marine">
              Actionable Compute &amp; Cooling Dispatch Windows
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-marine-muted">
            Scheduler hints from the MILP. Nothing here is connected to a live Slurm, Kubernetes, or PLC system.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="border-b border-line text-[11px] font-semibold text-marine-faint">
                <tr>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Local Window</th>
                  <th className="py-2 pr-3">Peak Magnitude</th>
                  <th className="py-2 pr-3">Operational Effect</th>
                  <th className="py-2">Scheduler / BMS Integration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plan.dispatch_windows.slice(0, 12).map((w, idx) => (
                  <tr key={`${w.action_type}-${w.start_time}-${idx}`}>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                          w.action_type === "DRY_COOL_SWAP"
                            ? "bg-swap-tint text-swap"
                            : w.action_type === "TANK_DISCHARGE"
                              ? "bg-hydro-tealtint text-teal-900"
                              : w.action_type === "SPACE_SHIFT"
                                ? "bg-heat-tint text-heat"
                                : "bg-hydro-tint text-hydro-dark"
                        }`}
                      >
                        {w.action_type}
                      </span>
                    </td>
                    <td className="num py-2 pr-3 whitespace-nowrap text-marine">
                      {w.start_time.replace("T", " ")} {"->"} {w.end_time.slice(11, 16)} ({w.hours_count}h)
                    </td>
                    <td className="num py-2 pr-3 font-semibold text-marine">
                      {w.peak_magnitude.toLocaleString("en-US")} {w.unit}
                    </td>
                    <td className="py-2 pr-3 text-marine-muted">{w.summary}</td>
                    <td className="py-2 text-marine-faint">{w.scheduler_hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
