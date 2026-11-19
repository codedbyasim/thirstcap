"use client";

import { Award, Cpu, Download, Droplets, FileCheck2, Flame, Radio, ShieldAlert, ShieldCheck, Users, Zap } from "lucide-react";
import { formatNum, formatUsdCompact } from "@/lib/format";
import type { PlanResponse } from "@/lib/types";

export const DROUGHT_STAGES = [
  { id: 0, tighten: 0, label: "Stage 0: Normal Cap (0%)", short: "Normal" },
  { id: 1, tighten: 0.15, label: "Stage 1: Watch (-15%)", short: "Watch -15%" },
  { id: 2, tighten: 0.3, label: "Stage 2: Heat Alert (-30%)", short: "Alert -30%" },
  { id: 3, tighten: 0.45, label: "Stage 3: Drought Emergency (-45%)", short: "Drought -45%" },
] as const;

export function DashboardHero({
  plan,
  siteLabel,
  windowLabel,
  droughtStage,
  reclaimedShare,
  running,
  exporting,
  onSelectDroughtStage,
  onExportCsv,
  onOpenCertificate,
}: {
  plan: PlanResponse | null;
  siteLabel: string;
  windowLabel: string;
  droughtStage: number;
  reclaimedShare: number;
  running: boolean;
  exporting: boolean;
  onSelectDroughtStage: (tighten: number) => void;
  onExportCsv: () => void;
  onOpenCertificate: () => void;
}) {
  const prov = plan?.meta.data_provenance;
  const biz = plan?.business_impact;
  const isSample = plan ? plan.meta.sample : false;
  const shield = biz?.permit_shield_score ?? 80;

  return (
    <section
      aria-label="Facility optimization command header"
      className="no-print overflow-hidden rounded-2xl border border-slate-800 bg-[#04111D] text-white shadow-lg"
    >
      <div className="p-4 sm:p-6">
        {/* Top Row: Facility Identity + Statutory Compliance Badges + Actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                {siteLabel}
              </h1>
              <span className="num rounded-lg border border-slate-700 bg-[#0A1E33] px-2.5 py-0.5 text-xs font-medium text-sky-200">
                {windowLabel}
              </span>
              {biz ? (
                <>
                  <span
                    className={`num inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                      (biz.wri_stress_score ?? 50) >= 75
                        ? "border-rose-700/70 bg-rose-950/80 text-rose-200"
                        : "border-amber-700/70 bg-amber-950/80 text-amber-200"
                    }`}
                  >
                    WRI {biz.wri_stress_score ?? 50}/100 · {biz.basin_stress_tier}
                  </span>
                  <span
                    className={`num inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                      shield >= 80
                        ? "border-emerald-600/60 bg-emerald-950/80 text-emerald-300"
                        : shield >= 60
                          ? "border-sky-600/60 bg-sky-950/80 text-sky-200"
                          : "border-rose-600/60 bg-rose-950/80 text-rose-200"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Permit Shield {shield}/100 ({biz.permit_shield_status ?? "Ready"})
                  </span>
                  <span className="num inline-flex items-center gap-1 rounded-lg border border-sky-700/60 bg-sky-950/70 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    EU EED Grade {biz.eu_eed_rating ?? "B"}
                  </span>
                </>
              ) : null}
            </div>

            {biz?.regulatory_framework ? (
              <p className="mt-1.5 text-xs text-slate-300">
                <span className="font-semibold text-sky-300">Regulatory Driver:</span> {biz.regulatory_framework}
                {reclaimedShare > 0 ? (
                  <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300">
                    {Math.round(reclaimedShare * 100)}% Reclaimed / TSE Blend Active
                  </span>
                ) : null}
              </p>
            ) : null}

            {plan ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                <ProvenancePill
                  Icon={Cpu}
                  label={prov?.solver ?? `${plan.meta.model} (${plan.meta.solve_time_ms ?? 0}ms)`}
                  tone={isSample ? "warn" : "ok"}
                />
                <ProvenancePill Icon={Flame} label={prov?.weather ?? "Open-Meteo Wet-Bulb"} />
                <ProvenancePill Icon={Zap} label={prov?.grid ?? "Grid Stress"} />
                <ProvenancePill Icon={Radio} label={prov?.workload ?? "Alibaba PAI 2020"} />
                <ProvenancePill Icon={Droplets} label={prov?.plant ?? "Physical CoC"} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCertificate}
              disabled={!plan}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#0A1E33] px-3.5 py-2 text-xs font-semibold text-slate-100 transition-colors hover:border-sky-400 hover:text-white disabled:opacity-50"
            >
              <FileCheck2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>ESG &amp; ROI Audit</span>
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              disabled={!plan || exporting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-[#04111D] transition-colors hover:bg-sky-400 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{exporting ? "Exporting…" : "Export 168h CSV"}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Interactive Utility Drought Curtailment Bar + CFO/Human Impact */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/90 pt-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Utility drought curtailment stage">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-300">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              <span>Water-DR Stage:</span>
            </span>
            {DROUGHT_STAGES.map((stage) => {
              const active = Math.abs(droughtStage - stage.tighten) < 0.01;
              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={running}
                  aria-pressed={active}
                  onClick={() => onSelectDroughtStage(stage.tighten)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    active
                      ? stage.tighten > 0
                        ? "bg-flex text-white shadow-sm"
                        : "bg-sky-500 text-[#04111D]"
                      : "bg-[#0A1E33] text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="hidden sm:inline">{stage.label}</span>
                  <span className="sm:hidden">{stage.short}</span>
                </button>
              );
            })}
          </div>

          {biz ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <strong className="num text-white">
                  {(biz.households_daily_water_protected ?? 0).toLocaleString("en-US")}
                </strong>{" "}
                homes protected/day
              </span>
              <span className="text-slate-700" aria-hidden="true">|</span>
              <span>
                5-Yr Net ROI:{" "}
                <strong className="num text-emerald-400">
                  {formatUsdCompact(biz.five_year_net_roi_usd ?? 0)}
                </strong>
              </span>
              <span className="text-slate-700" aria-hidden="true">|</span>
              <span>
                Payback:{" "}
                <strong className="num text-sky-300">
                  {formatNum(biz.tank_payback_years ?? 0, 2)} yr
                </strong>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProvenancePill({
  Icon,
  label,
  tone = "neutral",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-700/70 bg-emerald-950/80 text-emerald-200"
      : tone === "warn"
        ? "border-amber-700/70 bg-amber-950/80 text-amber-200"
        : "border-slate-700 bg-[#0A1E33] text-slate-300";

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 ${cls}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
