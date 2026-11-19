"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, Droplets, FileSpreadsheet } from "lucide-react";

const STAKEHOLDERS = [
  {
    id: "operators",
    tab: "Hyperscalers & Colocation",
    icon: Building2,
    headline: "Unlock Stalled Zoning & Aquifer Permits Across High-Growth AI Corridors",
    summary:
      "Municipalities from Loudoun County and Phoenix to Querétaro and Aragón increasingly block new capacity unless operators guarantee hard peak-day water caps. ThirstCap delivers audit-verified Permit Shield telemetry alongside drop-in Slurm and Kubernetes dispatch schedules.",
    metricLabel: "Permit Shield Readiness",
    metricValue: "94 / 100",
    metricSub: "Guaranteed daily cap compliance + 0 MW grid-peak overlap",
    bullets: [
      "Pre-validated daily peak caps accepted in municipal water-hookup applications",
      "Direct Slurm / Kubernetes batch deferral & cross-basin checkpoint failover hooks",
      "Reclaimed & TSE greywater blend scheduler cuts potable draw by up to -58%",
    ],
    ctaHref: "/dashboard?site=phoenix",
    ctaLabel: "Inspect Operator Control Plane",
  },
  {
    id: "utilities",
    tab: "Municipal Water Utilities",
    icon: Droplets,
    headline: "Defer $10M–$40M/MGD in Peak Plant & Pipe Expansion With Enforceable Water-DR",
    summary:
      "Water utilities size treatment plants, boosters, and trunk mains for the hottest seven afternoons of the year. By automating a 4-stage curtailment SLA with large AI campuses, utilities protect residential taps during heatwaves without stalling industrial tax revenue.",
    metricLabel: "Combined 10-Basin 2026 Potential",
    metricValue: "3.00 MGD Saved",
    metricSub: "Protects 9,986 households/day across 10 calibrated 100 MW campuses",
    bullets: [
      "OpenADR-inspired ThirstCap-WaterDR-v1 JSON signal across Stages 0 through 3 (-45%)",
      "Zero silent gaming: sister-site guardrail prevents hiding water inside adjacent basins",
      "One-click cryptographic-style compliance log verifying daily firm meter ceilings",
    ],
    ctaHref: "/dashboard?tab=protocol",
    ctaLabel: "Inspect Utility Water-DR Protocol",
  },
  {
    id: "esg",
    tab: "CFOs & EU EED ESG Teams",
    icon: FileSpreadsheet,
    headline: "Quantify 5-Year Water Tariff NPV & Automate EU EED (2024/1364) Audits",
    summary:
      "European data centers ≥500 kW face statutory annual WUE and sustainability A–G disclosures, while desert hubs face steep scarcity surcharges. ThirstCap models exact tank CAPEX payback, regional water tariff savings, and ISO/IEC 30134-9 metrics in one boardroom report.",
    metricLabel: "100 MW Phoenix 2026 5-Yr Net ROI",
    metricValue: "$4.32M NPV",
    metricSub: "40k gal thermal buffer tank pays back in < 1 year on local tariffs",
    bullets: [
      "Automated EU EED A–G potable WUE rating engine traceable to hourly telemetry",
      "6-point storage tank sizing sweep balancing CAPEX build cost vs avoided surcharges",
      "Boardroom Print Report + 168-hour CSV audit trail exportable in one click",
    ],
    ctaHref: "/dashboard?tab=compliance",
    ctaLabel: "Open ESG & CFO ROI Audit",
  },
];

export function StakeholderTabs() {
  const reduced = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const current = STAKEHOLDERS[activeIdx];
  const ActiveIcon = current.icon;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-hydro">
            Built For Every Water Stakeholder
          </p>
          <h2 className="heading-balance mt-2 font-display text-3xl font-bold tracking-tight text-marine-ink sm:text-4xl">
            Commercial Value Across Operators, Utilities &amp; Finance
          </h2>
        </div>

        {/* Animated Segmented Buyer Tabs */}
        <div
          role="tablist"
          aria-label="Stakeholder perspectives"
          className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-sm"
        >
          {STAKEHOLDERS.map((item, idx) => {
            const selected = idx === activeIdx;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveIdx(idx)}
                className={`relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  selected ? "text-white" : "text-marine-muted hover:text-marine-ink"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId={reduced ? undefined : "stakeholder-pill"}
                    className="absolute inset-0 rounded-lg bg-[#081B2E]"
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />
                <span className="relative z-10">{item.tab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Buyer Detail Panel */}
      <motion.div
        key={current.id}
        initial={reduced ? undefined : { opacity: 0, y: 10 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-8 grid items-stretch gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm lg:grid-cols-12 lg:p-8"
      >
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-hydro">
              <ActiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {current.tab}
            </div>
            <h3 className="heading-balance mt-3 font-display text-2xl font-bold text-marine-ink">
              {current.headline}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-marine-muted sm:text-base">
              {current.summary}
            </p>
            <ul className="mt-5 space-y-2.5">
              {current.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-marine-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <Link
              href={current.ctaHref}
              className="inline-flex items-center gap-2 rounded-xl bg-hydro px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hydro-dark"
            >
              {current.ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#04111D] p-6 text-white lg:col-span-5">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              Verified Benchmark Outcome
            </p>
            <p className="mt-2 font-mono text-xs text-slate-400">{current.metricLabel}</p>
            <p className="num mt-2 font-display text-4xl font-bold tracking-tight text-emerald-400 sm:text-5xl">
              {current.metricValue}
            </p>
            <p className="mt-2 text-sm text-slate-300">{current.metricSub}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 font-mono text-xs">
            <div className="rounded-lg bg-[#0A1E33] p-3">
              <p className="text-[10px] uppercase text-slate-400">Solver Basis</p>
              <p className="mt-1 font-semibold text-white">PuLP CBC MILP</p>
            </div>
            <div className="rounded-lg bg-[#0A1E33] p-3">
              <p className="text-[10px] uppercase text-slate-400">CAPEX Benchmark</p>
              <p className="mt-1 font-semibold text-sky-300">$10M–$40M/MGD</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
