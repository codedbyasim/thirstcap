"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileCheck2, Layers, ShieldCheck, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ArchitectureDiagram } from "@/components/home/ArchitectureDiagram";
import { GlobalBasinMap } from "@/components/home/GlobalBasinMap";
import { HeroSimulator } from "@/components/home/HeroSimulator";
import { StakeholderTabs } from "@/components/home/StakeholderTabs";
import { formatNum, formatUsdCompact } from "@/lib/format";
import { FLEET_UI, REPO_URL, fleetSite, peakCutLabel } from "@/lib/precomputed";

const STANDARDS_BAR = [
  { label: "Optimization Solver", value: "PuLP CBC 72h Rolling MILP" },
  { label: "Official US Grid Data", value: "EIA-930 MISO · AZPS · PJM" },
  { label: "Water-Stress Mapping", value: "WRI Aqueduct 4.0 Tiers" },
  { label: "AI Cluster Workload", value: "Alibaba PAI 759,033 GPU Jobs" },
  { label: "Regulatory Standard", value: "EU EED (2024/1364) & ISO 30134-9" },
];

const PATHS = [
  {
    name: "Control plane",
    tag: "Live solver",
    title: "Run a basin",
    desc: "Open the dashboard and solve one registry site or any geocoded city. Results come back from the FastAPI CBC service.",
    href: "/dashboard",
    cta: "Open the control plane",
    external: false,
    points: [
      "Live 7-day forecast or the site's 2026 peak window",
      "Tank sweep and 10-city fleet for the default controls are precomputed",
      "Other control sets solve with a 4 second CBC budget per window",
    ],
  },
  {
    name: "Fleet ledger",
    tag: "Precomputed CBC",
    title: "Compare 10 corridors",
    desc: "The 10-city tab renders the committed 2026 summer fleet. Live mode on the free tier is labelled when it reuses that run.",
    href: "/dashboard?tab=fleet",
    cta: "Open the fleet tab",
    external: false,
    points: [
      "One row per registry site, with the window that was actually solved",
      "Capex uses Han et al. 2026 ($10M–$40M per MGD)",
      "WRI scores are the registry values, not a live Aqueduct query",
    ],
  },
  {
    name: "Source",
    tag: "GitHub",
    title: "Read the model",
    desc: "This is a student research simulator. There is no pilot checkout, price, or booking form.",
    href: REPO_URL,
    cta: "View the repository",
    external: true,
    points: [
      "PuLP CBC rolling-horizon MILP in backend/app/services/optimizer.py",
      "Open-Meteo fixtures, EIA-930 profiles, and the Alibaba GPU trace under backend/data",
      "Precompute script: backend/scripts/precompute_sweeps.py",
    ],
  },
];

export function HomePage() {
  const reduced = useReducedMotion();
  const dubai = fleetSite("dubai");
  const phoenix = fleetSite("phoenix");
  const grades = FLEET_UI.sites.reduce<Record<string, number>>((acc, site) => {
    const grade = site.eu_eed_rating ?? "?";
    acc[grade] = (acc[grade] ?? 0) + 1;
    return acc;
  }, {});
  const shieldScores = FLEET_UI.sites.map((site) => site.permit_shield_score ?? 0);
  const shieldLabel =
    shieldScores.length > 0 && shieldScores.every((score) => score === shieldScores[0])
      ? `${shieldScores[0]}/100 on all ${FLEET_UI.sites.length}`
      : `${Math.min(...shieldScores)}–${Math.max(...shieldScores)}/100`;
  const allCapsHeld = FLEET_UI.sites.every((site) => site.cap_met);

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
              <a
                href={REPO_URL}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0A1E33] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-sky-400/60"
              >
                View source &amp; data
              </a>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-800/90 pt-6 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-slate-400">Peak-day cut</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-emerald-400">{peakCutLabel()}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">10-basin peak avoided</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-white">
                  {formatNum(FLEET_UI.total_mgd_avoided, 3)} MGD
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Extra dry-cooling energy</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-sky-300">
                  {formatNum(FLEET_UI.total_extra_mwh, 1)} MWh
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Homes protected</dt>
                <dd className="num mt-0.5 font-display text-2xl font-bold text-white">
                  {FLEET_UI.total_households_protected.toLocaleString("en-US")}
                </dd>
              </div>
            </dl>
            <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-slate-400">
              {FLEET_UI.note}
            </p>
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
                    100 MW Dubai and Phoenix, same default solve
                  </h3>
                </div>
                <span className="num rounded-lg bg-sky-500/15 px-3 py-1 font-mono text-xs font-bold text-sky-300">
                  {dubai ? formatUsdCompact(dubai.five_year_net_roi_usd ?? 0) : "—"} /{" "}
                  {phoenix ? formatUsdCompact(phoenix.five_year_net_roi_usd ?? 0) : "—"}
                </span>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Dubai avoided supply CAPEX (Han et al. 2026)</dt>
                  <dd className="num font-semibold text-white">
                    {dubai
                      ? `${formatUsdCompact(dubai.avoided_capex_low_usd)}–${formatUsdCompact(dubai.avoided_capex_high_usd)}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Phoenix avoided supply CAPEX</dt>
                  <dd className="num font-semibold text-white">
                    {phoenix
                      ? `${formatUsdCompact(phoenix.avoided_capex_low_usd)}–${formatUsdCompact(phoenix.avoided_capex_high_usd)}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">5-year net ROI, Dubai / Phoenix</dt>
                  <dd className="num font-semibold text-emerald-400">
                    {dubai ? formatUsdCompact(dubai.five_year_net_roi_usd ?? 0) : "—"} /{" "}
                    {phoenix ? formatUsdCompact(phoenix.five_year_net_roi_usd ?? 0) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2.5">
                  <dt className="text-slate-300">Extra dry-cooling energy, Dubai / Phoenix</dt>
                  <dd className="num font-semibold text-slate-200">
                    {dubai ? `${formatNum(dubai.extra_mwh, 1)} MWh` : "—"} /{" "}
                    {phoenix ? `${formatNum(phoenix.extra_mwh, 1)} MWh` : "—"}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-relaxed text-slate-400">
                Windows {dubai?.window ?? "—"} (Dubai) and {phoenix?.window ?? "—"} (Phoenix). The model prices tank steel at $2.50 per gallon. Electricity in this solve is the $85/MWh default. These are scenario inputs, not utility invoices.
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
                  <span>EU EED grades in this fleet solve</span>
                  <span className="num font-bold text-emerald-400">
                    {Object.entries(grades)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([grade, count]) => `${count}× ${grade}`)
                      .join(" · ")}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1.5 text-center font-mono text-xs font-bold">
                  {["A", "B", "C", "D", "E", "F", "G"].map((grade) => {
                    const count = grades[grade] ?? 0;
                    const active = count > 0;
                    return (
                      <div
                        key={grade}
                        className={`rounded-lg py-2 ${
                          active
                            ? "bg-emerald-500 text-[#04111D]"
                            : "border border-slate-800 bg-[#04111D] text-slate-500"
                        }`}
                      >
                        {grade}
                        <span className="mt-0.5 block text-[10px] font-semibold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center sm:text-left">
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Permit Shield</p>
                  <p className="num mt-1 font-display text-xl font-bold text-emerald-400">{shieldLabel}</p>
                  <p className="text-[10.5px] text-slate-400">From the fleet rows</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Peak-day cut</p>
                  <p className="num mt-1 font-display text-xl font-bold text-sky-300">{peakCutLabel()}</p>
                  <p className="text-[10.5px] text-slate-400">
                    {allCapsHeld ? "Cap held on every site" : "See fleet rows for cap status"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#04111D] p-3">
                  <p className="text-[11px] text-slate-400">Daily homes spared</p>
                  <p className="num mt-1 font-display text-xl font-bold text-white">
                    {FLEET_UI.total_households_protected.toLocaleString("en-US")}
                  </p>
                  <p className="text-[10.5px] text-slate-400">Sum of 10 campuses</p>
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
            What you can actually run
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PATHS.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-7"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-marine-ink">{tier.title}</h3>
                  <span className="rounded-full bg-subtle px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-marine-muted">
                    {tier.tag}
                  </span>
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

              {tier.external ? (
                <a
                  href={tier.href}
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-canvas px-4 py-3 text-sm font-semibold text-marine-ink transition-colors hover:bg-subtle"
                >
                  {tier.cta}
                </a>
              ) : (
                <Link
                  href={tier.href}
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-hydro px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-hydro-dark"
                >
                  {tier.cta}
                </Link>
              )}
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
            <a
              href={REPO_URL}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:border-sky-400"
            >
              Read the source
            </a>
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
                  <a href={REPO_URL} className="hover:text-sky-300">
                    Source, fixtures, and precompute script
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div id="about-the-data" className="mt-10 rounded-xl border border-slate-800 bg-[#081B2E] p-4 text-xs leading-relaxed text-slate-300">
            <p className="font-semibold text-white">About the data</p>
            <p className="mt-1.5">
              Nothing on this site is facility telemetry. Weather is Open-Meteo (committed archive fixtures for the 2026 peak windows, or a live forecast when a control-plane request asks for one). US grid shape is EIA-930 for MISO, AZPS, and PJM; other regions use a diurnal thermal profile. The workload mix is the public Alibaba 2020 GPU cluster trace, 759,033 jobs parsed into fixed, deferrable, and pausable classes. Avoided supply capex uses Han, Li, Wierman, and Ren, “Small Bottle, Big Pipe” (2026), $10–$40 million per MGD. WRI scores and tariffs on the ten corridors are the values stored in the site registry. A searched city gets a regional estimate from the API, and the plan labels that estimate.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-400">
            <p>
              Solo entry by Muhammad Asim Hanif (@codedbyasim), NUTECH Islamabad · Xylem Global Student Innovation Challenge 2026, University Track — Problem Statement #1: Water Quantity
            </p>
            <p className="font-mono text-[11px]">PuLP CBC · EIA-930 (MISO/AZPS/PJM) · Open-Meteo · Alibaba PAI</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
