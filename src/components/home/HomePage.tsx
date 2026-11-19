"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarCheck2, Check, FileCheck2, Layers, ShieldCheck, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PilotModal } from "@/components/PilotModal";
import { ArchitectureDiagram } from "@/components/home/ArchitectureDiagram";
import { GlobalBasinMap } from "@/components/home/GlobalBasinMap";
import { HeroSimulator } from "@/components/home/HeroSimulator";
import { StakeholderTabs } from "@/components/home/StakeholderTabs";

const STANDARDS_BAR = [
  { label: "Optimization Solver", value: "PuLP CBC 72h Rolling MILP" },
  { label: "Official US Grid Data", value: "EIA-930 MISO · AZPS · PJM" },
  { label: "Water-Stress Mapping", value: "WRI Aqueduct 4.0 Tiers" },
  { label: "AI Cluster Workload", value: "Alibaba PAI 759,033 GPU Jobs" },
  { label: "Regulatory Standard", value: "EU EED (2024/1364) & ISO 30134-9" },
];

const TIERS = [
  {
    name: "Single-Campus Pilot",
    tag: "90-Day Shadow Mode",
    price: "$2,500",
    unit: "/mo · 1 basin",
    desc: "Rapid validation for a high-stress campus facing zoning scrutiny or peak municipal tariffs.",
    featured: false,
    points: [
      "Live 72h weather, wet-bulb & grid feed integration",
      "6-point Thermal Tank Sizing ROI & payback analysis",
      "Permit Shield Baseline Report for municipal submission",
      "Read-only BMS / Slurm / Kubernetes shadow schedules",
    ],
    cta: "Start 14-Day Shadow Pilot",
  },
  {
    name: "Multi-Basin Global Fleet",
    tag: "Most Popular · Hyperscale",
    price: "Custom Fleet",
    unit: "Unlimited basins & regions",
    desc: "Full cross-basin compute routing, automated drought response, and statutory ESG compliance.",
    featured: true,
    points: [
      "All 10 calibrated stress corridors + custom lat/lon sites",
      "Automated cross-region failover respecting 110% sister guardrails",
      "EU EED (2024/1364) A–G & ISO 30134-9 audit trail export",
      "Reclaimed / TSE cooling mix + active Slurm & K8s webhooks",
    ],
    cta: "Book Global Fleet Demo",
  },
  {
    name: "Municipal Utility Partner",
    tag: "Water-DR Aggregation",
    price: "Utility SLA",
    unit: "Multi-operator basin ledger",
    desc: "Built for municipal water works avoiding $10M–$40M/MGD peak plant expansions.",
    featured: false,
    points: [
      "ThirstCap-WaterDR-v1 OpenADR 4-stage curtailment console",
      "Campus-by-campus firm daily MGD compliance verification",
      "Regional drought alert broadcasting (-15%, -30%, -45%)",
      "Residential household capacity protection telemetry",
    ],
    cta: "Connect Utility Engineering",
  },
];

export function HomePage() {
  const reduced = useReducedMotion();
  const [pilotOpen, setPilotOpen] = useState(false);

  return (
    <div className="bg-canvas text-marine-ink">
      {/* 1. Executive Commercial Hero */}
      <section className="marine-grid border-b border-slate-800 bg-[#04111D] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:py-16">
          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 12 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              Enterprise Water-Cap OS · WRI Aqueduct &amp; EU EED Ready
            </span>

            <h1 className="heading-balance mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[54px] lg:leading-[1.06]">
              Cap Peak Water Withdrawal. Unlock Permits &amp; Protect Basins.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              72-hour rolling MILP optimization that co-dispatches AI batch compute, cross-basin failover, cooling storage tanks, and grid-safe dry cooling — keeping facilities inside municipal limits before utilities spend{" "}
              <strong className="font-semibold text-white">$10M–$40M per MGD</strong> on peak supply capacity.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-[#04111D] shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400"
              >
                Launch Live Control Plane
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setPilotOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0A1E33] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-sky-400/60"
              >
                <CalendarCheck2 className="h-4 w-4 text-sky-400" aria-hidden="true" />
                Configure 14-Day Pilot
              </button>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-800/90 pt-6 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-slate-400">Peak-Day Shaved</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-emerald-400">22%–45.4%</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">10-Basin Potential</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-white">3.00 MGD</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Grid-Peak Penalty</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-sky-300">0.0 MW</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Global Corridors</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-white">10 Basins</dd>
              </div>
            </dl>
          </motion.div>

          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="lg:col-span-6"
          >
            <HeroSimulator />
          </motion.div>
        </div>
      </section>

      {/* 2. Verified Engineering & Regulatory Credibility Bar */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl divide-y divide-slate-100 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-5">
          {STANDARDS_BAR.map((item) => (
            <div key={item.label} className="px-4 py-4">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-marine-faint">
                {item.label}
              </p>
              <p className="mt-1 font-display text-sm font-bold text-marine-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Global Water-Stress Hotspots Map & 10-City Network */}
      <GlobalBasinMap />

      {/* 4. 4-Lever Physics & Compute Architecture Schematic */}
      <ArchitectureDiagram />

      {/* 5. Stakeholder Solutions Tabs */}
      <StakeholderTabs />

      {/* 6. Dark Marine Financial ROI + Permit Shield Showcase */}
      <section className="marine-grid border-y border-slate-800 bg-[#04111D] py-16 text-white lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-sky-400">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Enterprise Economics &amp; Statutory Compliance
            </p>
            <h2 className="heading-balance mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From Water Scarcity Risk to Boardroom Financial Return
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* CFO 5-Year ROI Card */}
            <div className="rounded-2xl border border-slate-800 bg-[#081B2E] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-sky-400">
                    CFO 5-Year Financial Model
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-white">
                    100 MW Dubai vs. Phoenix Reference Campus
                  </h3>
                </div>
                <span className="num rounded-lg bg-sky-500/15 px-3 py-1 font-mono text-xs font-bold text-sky-300">
                  +$6.94M / +$4.32M NPV
                </span>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Avoided Municipal Supply CAPEX (Han et al. 2026)</dt>
                  <dd className="num font-semibold text-white">$3.50M – $16.98M</dd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Annual Regional Tariff &amp; Surcharge Savings</dt>
                  <dd className="num font-semibold text-emerald-400">$215K – $595K / yr</dd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">40,000 gal Thermal Tank Build Cost ($2.50/gal)</dt>
                  <dd className="num font-semibold text-slate-200">$100,000 (0.15 yr payback)</dd>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Grid-Peak Dry-Cooling Penalty Added</dt>
                  <dd className="num font-semibold text-emerald-400">$0 / peak hour (0.0 MW)</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-relaxed text-slate-400">
                Every tariff rate ($3.60–$11.50/kgal) and electricity rate ($85/MWh default) is customizable live inside the Control Plane to match site-specific municipal utility contracts.
              </p>
            </div>

            {/* Permit Shield & EU EED Compliance Card */}
            <div className="rounded-2xl border border-slate-800 bg-[#081B2E] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Permit Shield &amp; EU EED (2024/1364)
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-white">
                    Audit-Ready WUE &amp; Community Impact Telemetry
                  </h3>
                </div>
                <FileCheck2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />
              </div>

              {/* Visual EU EED Grade Scale */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Des Moines / Querétaro Potable WUE (Stage 2 + 35% TSE)</span>
                  <span className="num font-bold text-emerald-400">Grade A Qualified</span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1.5 text-center font-mono text-xs font-bold">
                  {[
                    { g: "A", active: true, cls: "bg-emerald-500 text-[#04111D] ring-2 ring-emerald-300" },
                    { g: "B", active: false, cls: "bg-emerald-950/60 text-emerald-300 border border-emerald-800" },
                    { g: "C", active: false, cls: "bg-sky-950/60 text-sky-300 border border-sky-900" },
                    { g: "D", active: false, cls: "bg-amber-950/60 text-amber-300 border border-amber-900" },
                    { g: "E", active: false, cls: "bg-orange-950/60 text-orange-300 border border-orange-900" },
                    { g: "F", active: false, cls: "bg-rose-950/60 text-rose-300 border border-rose-900" },
                    { g: "G", active: false, cls: "bg-rose-950 text-rose-400 border border-rose-900" },
                  ].map((item) => (
                    <div key={item.g} className={`rounded-lg py-2 ${item.cls}`}>
                      {item.g}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center sm:text-left">
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Permit Shield</p>
                  <p className="num mt-1 font-display text-xl font-bold text-emerald-400">94 / 100</p>
                  <p className="text-[10.5px] text-slate-400">Permit Ready</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Potable Water Cut</p>
                  <p className="num mt-1 font-display text-xl font-bold text-sky-300">-64.5%</p>
                  <p className="text-[10.5px] text-slate-400">35% TSE Reclaimed</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Daily Homes Spared</p>
                  <p className="num mt-1 font-display text-xl font-bold text-white">9,986</p>
                  <p className="text-[10.5px] text-slate-400">Across 10 basins</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Enterprise Deployment & Commercial Packaging */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-hydro">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Commercial Deployment Paths
          </p>
          <h2 className="heading-balance mt-2 font-display text-3xl font-bold tracking-tight text-marine-ink sm:text-4xl">
            From 14-Day Shadow Audit to Automated Utility Dispatch
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-7 ${
                tier.featured
                  ? "border-2 border-hydro bg-surface shadow-xl ring-4 ring-sky-500/10"
                  : "border-line bg-surface shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-marine-ink">{tier.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-semibold ${
                      tier.featured ? "bg-sky-100 text-hydro-dark" : "bg-subtle text-marine-muted"
                    }`}
                  >
                    {tier.tag}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="num font-display text-3xl font-bold text-marine-ink">{tier.price}</span>
                  <span className="text-xs text-marine-muted">{tier.unit}</span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-marine-muted">{tier.desc}</p>

                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
                  {tier.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-marine-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setPilotOpen(true)}
                className={`mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  tier.featured
                    ? "bg-hydro text-white hover:bg-hydro-dark"
                    : "border border-slate-300 bg-canvas text-marine-ink hover:bg-subtle"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Enterprise CTA Banner */}
        <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-800 bg-[#081B2E] p-7 text-white sm:p-10 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h3 className="heading-balance font-display text-2xl font-bold sm:text-3xl">
              Validate Your Basin&apos;s Peak Water Cap in Minutes
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
              Run real-time 7-day forecasts or 2026 summer heatwave stress tests across all 10 flagship basins — or search literally any city on Earth live.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-[#04111D] hover:bg-sky-400"
            >
              Open Live Control Plane
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setPilotOpen(true)}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:border-sky-400"
            >
              Generate Pilot Brief
            </button>
          </div>
        </div>
      </section>

      {/* 8. Rich Commercial Footer */}
      <footer className="border-t border-slate-800 bg-[#04111D] text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo inverted animated={false} />
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                72-hour rolling CBC MILP optimization platform capping peak-day industrial cooling water withdrawal across water-stressed AI infrastructure hubs.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white">Control Plane</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <Link href="/dashboard?tab=peak" className="hover:text-sky-300">Peak Cap &amp; Financials</Link>
                </li>
                <li>
                  <Link href="/dashboard?tab=dispatch" className="hover:text-sky-300">Slurm / K8s Dispatch Matrix</Link>
                </li>
                <li>
                  <Link href="/dashboard?tab=tank" className="hover:text-sky-300">Thermal Tank Sizing ROI</Link>
                </li>
                <li>
                  <Link href="/dashboard?tab=fleet" className="hover:text-sky-300">10-Basin Fleet Ledger</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white">Hotspot Basins</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <Link href="/dashboard?site=phoenix" className="hover:text-sky-300">Phoenix &amp; N. Virginia (US)</Link>
                </li>
                <li>
                  <Link href="/dashboard?site=queretaro" className="hover:text-sky-300">Querétaro &amp; Santiago (LATAM)</Link>
                </li>
                <li>
                  <Link href="/dashboard?site=zaragoza" className="hover:text-sky-300">Zaragoza, Spain (EU EED)</Link>
                </li>
                <li>
                  <Link href="/dashboard?site=dubai" className="hover:text-sky-300">Dubai, UAE &amp; South Asia</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white">Standards &amp; Governance</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <Link href="/dashboard?tab=compliance" className="hover:text-sky-300">EU EED (2024/1364) A–G Audit</Link>
                </li>
                <li>
                  <Link href="/dashboard?tab=protocol" className="hover:text-sky-300">Water-DR OpenADR Signal</Link>
                </li>
                <li>
                  <button type="button" onClick={() => setPilotOpen(true)} className="hover:text-sky-300">
                    Request Shadow Pilot Brief
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-400">
            <p>
              Built by Team ThirstCap (NUTECH Islamabad) · Xylem Global Student Innovation Challenge 2026 — Problem Statement #1: Water Quantity
            </p>
            <p className="font-mono text-[11px]">PuLP CBC · EIA-930 (MISO/AZPS/PJM) · Open-Meteo · Alibaba PAI</p>
          </div>
        </div>
      </footer>

      <PilotModal open={pilotOpen} onClose={() => setPilotOpen(false)} />
    </div>
  );
}
