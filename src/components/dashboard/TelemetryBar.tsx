"use client";

import { Cpu, Download, Droplets, Flame, Radio, Zap } from "lucide-react";
import type { PlanResponse } from "@/lib/types";

export function TelemetryBar({
  plan,
  siteLabel,
  windowLabel,
  onExportCsv,
  exporting,
}: {
  plan: PlanResponse | null;
  siteLabel: string;
  windowLabel: string;
  onExportCsv: () => void;
  exporting: boolean;
}) {
  const prov = plan?.meta.data_provenance;
  const isSample = plan ? plan.meta.sample : false;

  return (
    <div className="no-print rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg font-bold tracking-tight text-marine sm:text-xl">
              {siteLabel}
            </h1>
            <span className="num rounded border border-line bg-subtle px-2 py-0.5 text-xs font-medium text-marine-muted">
              {windowLabel}
            </span>
            {plan?.meta.flex_event ? (
              <span className="inline-flex items-center gap-1 rounded bg-flex px-2 py-0.5 text-xs font-semibold text-white">
                <Zap className="h-3 w-3" aria-hidden="true" />
                FLEX EVENT -30%
              </span>
            ) : null}
          </div>
          {plan ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
              <Badge
                Icon={Cpu}
                label={prov?.solver ?? `${plan.meta.model} (${plan.meta.solve_time_ms ?? 0}ms)`}
                tone={isSample ? "warn" : "ok"}
              />
              <Badge
                Icon={Flame}
                label={prov?.weather ?? "Open-Meteo Weather"}
                tone="neutral"
              />
              <Badge
                Icon={Zap}
                label={prov?.grid ?? "Grid Stress"}
                tone="neutral"
              />
              <Badge
                Icon={Radio}
                label={prov?.workload ?? "Alibaba GPU 2020"}
                tone="neutral"
              />
              <Badge
                Icon={Droplets}
                label={prov?.plant ?? `Plant (${plan.meta.plant_model ?? "physical"})`}
                tone="neutral"
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          disabled={!plan || exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-marine transition-colors hover:border-hydro hover:text-hydro disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{exporting ? "Exporting…" : "Export Hourly CSV"}</span>
        </button>
      </div>
    </div>
  );
}

function Badge({
  Icon,
  label,
  tone,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-line bg-subtle text-marine-muted";

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded border px-2 py-0.5 ${cls}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
