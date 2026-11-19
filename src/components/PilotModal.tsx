"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, Copy, ShieldCheck, X } from "lucide-react";
import { SITES, type SiteId } from "@/lib/sites";
import { BENCHMARKS } from "@/data/benchmarks";
import { formatUsdCompact } from "@/lib/format";

export function PilotModal({
  open,
  initialSiteId = "phoenix",
  onClose,
}: {
  open: boolean;
  initialSiteId?: SiteId;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [siteId, setSiteId] = useState<SiteId>(initialSiteId);
  const [itMw, setItMw] = useState(100);
  const [goal, setGoal] = useState<"permit" | "eu-eed" | "drought" | "capex">("permit");
  const [workEmail, setWorkEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSiteId(initialSiteId);
  }, [initialSiteId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
  const bm = BENCHMARKS[site.id];
  const scale = itMw / 100;
  const estRoi = Math.round(bm.flex30_tse35.roi5y * scale);
  const estSavedGal = Math.round((bm.flex30.base_peak - bm.flex30.opt_peak) * scale);

  const goalLabel =
    goal === "permit"
      ? "Zoning / Municipal Permit Unlock"
      : goal === "eu-eed"
        ? "EU EED (2024/1364) & ISO 30134-9 Audit"
        : goal === "drought"
          ? "Stage 2 Drought Curtailment SLA"
          : "Avoided CAPEX & Tariff Reduction";

  const brief = `THIRSTCAP 14-DAY SHADOW PILOT REQUEST\nBasin: ${site.name}, ${site.country} (WRI Stress: ${site.wriScore}/100)\nRegulatory Driver: ${site.regulation}\nCapacity: ${itMw} MW IT | Primary Objective: ${goalLabel}\nCalibrated 72h MILP Forecast: -${bm.flex30.cut_pct}% peak withdrawal (-${estSavedGal.toLocaleString("en-US")} gal/day) | Permit Shield ${bm.flex30_tse35.shield}/100 | Est. 5-Yr Net ROI ${formatUsdCompact(estRoi)}${workEmail ? `\nContact: ${workEmail}` : ""}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04111D]/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pilot-modal-title"
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#081B2E] text-white shadow-2xl"
            initial={reduced ? undefined : { opacity: 0, y: 14, scale: 0.98 }}
            animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Enterprise Technical Scoping
                </p>
                <h2 id="pilot-modal-title" className="mt-1 font-display text-xl font-bold text-white">
                  Configure a 14-Day Shadow-Mode Basin Pilot
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close pilot modal"
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-300">
                  Target Water-Stress Corridor
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value as SiteId)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#04111D] px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                  >
                    {SITES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.country}) · WRI {s.wriScore}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-300">
                  Campus Nameplate Capacity (MW)
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={10}
                    value={itMw}
                    onChange={(e) => setItMw(Math.max(10, Math.min(500, Number(e.target.value) || 100)))}
                    className="num mt-1.5 w-full rounded-lg border border-slate-700 bg-[#04111D] px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300">Primary Executive Objective</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[
                    { id: "permit", label: "Unlock Zoning Permits" },
                    { id: "eu-eed", label: "EU EED & ISO WUE" },
                    { id: "drought", label: "Drought Curtailment SLA" },
                    { id: "capex", label: "5-Year Tariff & CAPEX ROI" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGoal(item.id as typeof goal)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                        goal === item.id
                          ? "border-sky-400 bg-sky-500/15 text-sky-200"
                          : "border-slate-700/80 bg-[#04111D] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#04111D] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    Calibrated MILP Assessment ({itMw} MW · {site.name})
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                    Permit Shield {bm.flex30_tse35.shield}/100
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center sm:text-left">
                  <div>
                    <p className="text-[11px] text-slate-400">Peak Cut Capacity</p>
                    <p className="num text-base font-bold text-white">-{bm.flex30.cut_pct}%</p>
                    <p className="num text-[11px] text-sky-400">-{estSavedGal.toLocaleString("en-US")} gal/d</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">EU EED Rating</p>
                    <p className="num text-base font-bold text-emerald-400">Grade {bm.flex30_tse35.eed}</p>
                    <p className="text-[11px] text-slate-400">with 35% Reclaimed</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Est. 5-Yr Net ROI</p>
                    <p className="num text-base font-bold text-sky-300">{formatUsdCompact(estRoi)}</p>
                    <p className="num text-[11px] text-slate-400">${site.tariffUsdPerKgal.toFixed(2)}/kgal tariff</p>
                  </div>
                </div>
              </div>

              <label className="block text-xs font-medium text-slate-300">
                Engineering / ESG Lead Email (optional for copyable technical brief)
                <input
                  type="email"
                  placeholder="infrastructure-lead@company.com"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#04111D] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </label>

              {submitted && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  Shadow-mode engineering packet ready. Copy the brief below or open {site.name} directly in the live Control Plane.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#04111D] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Brief Copied" : "Copy Pilot Brief"}
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={`/dashboard?site=${siteId}`}
                    onClick={onClose}
                    className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                  >
                    Simulate {site.name} Live →
                  </a>
                  <button
                    type="button"
                    onClick={() => setSubmitted(true)}
                    className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-[#04111D] hover:bg-sky-400"
                  >
                    Generate Pilot Packet
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
