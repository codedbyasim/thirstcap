"use client";

import { useState } from "react";
import { Check, Copy, Radio } from "lucide-react";
import { SensitivityTab } from "@/components/dashboard/SensitivityTab";
import { UtilityReportTab } from "@/components/dashboard/UtilityReportTab";
import type { PlanResponse, SensitivityResponse } from "@/lib/types";

export function ProtocolTab({
  plan,
  sensitivity,
  sensError,
  flexibleShare,
  onExportCsv,
  exporting,
}: {
  plan: PlanResponse;
  sensitivity: SensitivityResponse | null;
  sensError: string | null;
  flexibleShare: number;
  onExportCsv: () => void;
  exporting: boolean;
}) {
  const [copiedSignal, setCopiedSignal] = useState(false);

  async function copySignal() {
    if (!plan.utility_signal) return;
    await navigator.clipboard.writeText(JSON.stringify(plan.utility_signal, null, 2));
    setCopiedSignal(true);
    window.setTimeout(() => setCopiedSignal(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Live Utility Water-DR Signal Contract */}
      {plan.utility_signal ? (
        <section className="no-print rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-hydro" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-marine">
                OpenADR-Style Water Demand-Response Signal ({plan.utility_signal.signal_id})
              </h2>
            </div>
            <button
              type="button"
              onClick={copySignal}
              className="inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs font-semibold text-marine hover:border-hydro"
            >
              {copiedSignal ? (
                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedSignal ? "Copied Signal" : "Copy Water-DR Signal JSON"}</span>
            </button>
          </div>
          <p className="mt-1 text-xs text-marine-muted">
            Structured utility curtailment payload used by municipal dispatchers and facility schedulers to enforce the{" "}
            <strong className="text-marine">{plan.utility_signal.drought_stage}</strong> cap.
          </p>
          <pre className="num mt-3 overflow-x-auto rounded-md border border-line bg-[#081726] p-3.5 text-xs text-sky-200">
            {JSON.stringify(plan.utility_signal, null, 2)}
          </pre>
        </section>
      ) : null}

      <UtilityReportTab plan={plan} onExportCsv={onExportCsv} exporting={exporting} />

      <div className="no-print">
        <SensitivityTab
          plan={plan}
          sensitivity={sensitivity}
          sensError={sensError}
          flexibleShare={flexibleShare}
        />
      </div>
    </div>
  );
}
