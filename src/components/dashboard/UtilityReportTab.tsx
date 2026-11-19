"use client";

import { useState } from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import { formatGal, formatMgd, formatNum, formatUsd } from "@/lib/format";
import type { PlanResponse } from "@/lib/types";

export function UtilityReportTab({
  plan,
  onExportCsv,
  exporting,
}: {
  plan: PlanResponse;
  onExportCsv: () => void;
  exporting: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { meta, baseline, optimized, levers, business_impact: biz } = plan;

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-xs text-marine-muted">
          Generate an engineering compliance packet for municipal water utility interconnection review or SCADA/BMS ingest.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-md bg-marine px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-hydro disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{exporting ? "Exporting…" : "Download Hourly CSV"}</span>
          </button>
          <button
            type="button"
            onClick={copyJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-marine transition-colors hover:border-hydro"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{copied ? "Copied JSON" : "Copy API JSON"}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-marine transition-colors hover:border-hydro"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Utility Firm Cap Certificate */}
      <article className="print-only-full rounded-lg border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-marine pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-marine">
              ThirstCap Firm Peak-Day Water Cap Certificate
            </h2>
            <p className="mt-1 text-xs text-marine-muted">
              Rolling 72-Hour Joint Compute, Cooling &amp; Storage Dispatch Commitment
            </p>
          </div>
          <div className="text-right text-xs">
            <span
              className={`inline-block rounded px-2.5 py-1 font-bold ${
                meta.cap_met ? "bg-emerald-100 text-emerald-900" : "bg-flex-tint text-flex"
              }`}
            >
              {meta.cap_met ? "CAP COMPLIANT" : `SHORTFALL ${formatGal(meta.cap_shortfall_gal)} GAL`}
            </span>
            <p className="num mt-1 text-marine-faint">Solver: {meta.model}</p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-3">
          <CertField label="Facility Location" value={`${meta.site_name ?? meta.site_id} (${meta.region ?? meta.timezone})`} />
          <CertField label="Schedule Window" value={`${meta.start} to ${meta.end} (${plan.hours.length}h)`} mono />
          <CertField
            label="Facility Capacity / CoC"
            value={`${meta.it_capacity_mw ?? 100} MW IT | CoC ${meta.coc ?? 4.0}× (${meta.plant_model ?? "physical"})`}
            mono
          />
          <CertField
            label="Firm Daily Utility Cap"
            value={`${formatGal(meta.cap_gal)} gal/day (${formatMgd(meta.cap_gal)})`}
            mono
          />
          <CertField
            label="Verified MILP Peak Day"
            value={`${formatGal(optimized.peak_day_gal)} gal on ${optimized.peak_day_date}`}
            mono
          />
          <CertField
            label="Uncontrolled Peak Day"
            value={`${formatGal(baseline.peak_day_gal)} gal on ${baseline.peak_day_date}`}
            mono
          />
          <CertField
            label="Peak Supply Kept Off Utility"
            value={`${formatNum(optimized.water_capacity_impact * 100, 1)}% (${formatMgd(baseline.peak_day_gal - optimized.peak_day_gal)})`}
            mono
          />
          <CertField
            label="Avoided Municipal CAPEX"
            value={biz ? `${formatUsd(biz.avoided_capex_low_usd)} – ${formatUsd(biz.avoided_capex_high_usd)}` : "—"}
            mono
          />
          <CertField
            label="Grid Peak Impact / Extra MWh"
            value={`${formatNum(optimized.grid_peak_mw, 2)} MW peak | +${formatNum(optimized.extra_mwh, 1)} MWh`}
            mono
          />
        </dl>

        <div className="mt-6 rounded-md border border-line bg-subtle/50 p-4 text-xs">
          <h3 className="font-semibold text-marine">Verified Data &amp; Optimization Provenance</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p className="text-marine-muted">
              <strong className="text-marine">Weather:</strong> {meta.data_provenance?.weather ?? "Open-Meteo"}
            </p>
            <p className="text-marine-muted">
              <strong className="text-marine">Grid Signal:</strong> {meta.data_provenance?.grid ?? "Grid Stress"}
            </p>
            <p className="text-marine-muted">
              <strong className="text-marine">Workload Trace:</strong> {meta.data_provenance?.workload ?? "Alibaba GPU 2020"}
            </p>
            <p className="text-marine-muted">
              <strong className="text-marine">Sister Guardrail ({levers.sister_name}):</strong>{" "}
              {formatGal(levers.sister_baseline_peak_gal)} {"->"} {formatGal(levers.sister_peak_with_shift_gal)} gal
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function CertField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-line p-3">
      <dt className="text-[11px] font-medium text-marine-faint">{label}</dt>
      <dd className={`mt-1 font-semibold text-marine ${mono ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
