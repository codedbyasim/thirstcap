"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CloudRain, Cpu, Database, Droplets, Flame, Globe, Layers, Zap } from "lucide-react";

const INPUT_STREAMS = [
  {
    id: "weather",
    icon: CloudRain,
    title: "72h Wet-Bulb Forecast",
    sub: "Open-Meteo T_db + RH% -> Stull T_wb",
  },
  {
    id: "grid",
    icon: Zap,
    title: "Official Grid Stress",
    sub: "EIA-930 MISO · AZPS · PJM Top-15% Guard",
  },
  {
    id: "gpu",
    icon: Cpu,
    title: "Alibaba PAI 759K Trace",
    sub: "Fixed (<15m), Deferrable, Pausable MW",
  },
  {
    id: "utility",
    icon: Flame,
    title: "Utility Water-DR Signal",
    sub: "Stage 0–3 Firm Cap + TSE Reclaimed Share",
  },
];

const LEVERS = [
  {
    num: "01",
    id: "time",
    icon: Cpu,
    title: "Batch Time-Shifting",
    badge: "−18h to +24h window",
    color: "text-sky-600 bg-sky-50 border-sky-200",
    detail:
      "Reschedules deferrable & pausable AI training jobs (-18h to +24h window) out of hot afternoon peaks into cool overnight wet-bulb hours.",
    protocol: "Slurm / Kubernetes Batch Partition Cordon",
  },
  {
    num: "02",
    id: "space",
    icon: Globe,
    title: "Cross-Basin GPU Failover",
    badge: "Model sister cap 110%",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    detail:
      "Routes flexible training bursts from water-stressed hubs (Phoenix -> Des Moines, Zaragoza -> Bilbao, Dubai -> Frankfurt) when destination basins are cooler.",
    protocol: "Global Job Router & Checkpointed State Sync",
  },
  {
    num: "03",
    id: "tank",
    icon: Database,
    title: "Thermal & Make-Up Tank",
    badge: "$2.50/gal model cost",
    color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    detail:
      "Fills on-site storage overnight and discharges cleanly across afternoon heat spikes so the municipal meter never crosses its daily firm withdrawal cap.",
    protocol: "Plant PLC Valve Schedule (gal/h Discharge)",
  },
  {
    num: "04",
    id: "swap",
    icon: Droplets,
    title: "Grid-Safe Dry Swap & TSE",
    badge: "Off during grid peaks",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    detail:
      "The MILP blocks dry-cooler swaps during the top grid-stress hours and can blend a reclaimed share. The EU EED letter is computed from that solve, not guaranteed.",
    protocol: "BACnet / Modbus Chiller & Tower Control",
  },
];

export function ArchitectureDiagram() {
  const reduced = useReducedMotion();
  const [activeLever, setActiveLever] = useState(0);
  const current = LEVERS[activeLever];

  return (
    <section className="border-y border-line bg-surface py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-hydro">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Physics + Compute Co-Optimization
          </p>
          <h2 className="heading-balance mt-2 font-display text-3xl font-bold tracking-tight text-marine-ink sm:text-4xl">
            Four Physical Levers Co-Dispatched Every 24 Hours
          </h2>
          <p className="mt-2.5 text-base leading-relaxed text-marine-muted">
            Unlike passive sustainability dashboards, ThirstCap solves a deterministic PuLP CBC mixed-integer linear program every rolling 72 hours — respecting grid peaks, wet-bulb humidity, and job SLAs simultaneously.
          </p>
        </div>

        {/* Visual Flow Schematic */}
        <div className="mt-10 grid items-center gap-6 rounded-2xl border border-line bg-canvas p-5 lg:grid-cols-12 lg:p-8">
          {/* Left: 4 Telemetry Inputs */}
          <div className="space-y-3 lg:col-span-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-marine-faint">
              Real-Time Ingestion
            </p>
            {INPUT_STREAMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-sm"
                >
                  <div className="rounded-lg bg-sky-50 p-2 text-hydro">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-marine-ink">{item.title}</p>
                    <p className="num mt-0.5 text-xs text-marine-muted">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center: Animated Solver Core */}
          <div className="flex flex-col items-center justify-center lg:col-span-3">
            <div className="hidden items-center gap-2 text-hydro lg:mb-3 lg:flex">
              <span className="h-0.5 w-10 bg-sky-300" />
              <ArrowRight className="h-4 w-4" />
            </div>

            <motion.div
              whileHover={reduced ? undefined : { scale: 1.02 }}
              className="w-full rounded-2xl border border-sky-500/40 bg-[#081B2E] p-5 text-center text-white shadow-xl"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                &lt; 1.8s Exact Solve
              </span>
              <p className="mt-3 font-display text-xl font-bold">PuLP CBC</p>
              <p className="font-mono text-xs text-sky-300">Rolling 72h MILP Core</p>
              <div className="mt-4 space-y-1.5 border-t border-slate-700/80 pt-3 text-left font-mono text-[11px] text-slate-300">
                <p>• Firm Daily Cap Constraint</p>
                <p>• Calibrated 0.19 L/kWh Tower</p>
                <p>• Stull Wet-Bulb CoC Lift</p>
                <p>• Zero Sample Fallback</p>
              </div>
            </motion.div>

            <div className="hidden items-center gap-2 text-emerald-600 lg:mt-3 lg:flex">
              <span className="h-0.5 w-10 bg-emerald-300" />
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Right: 4 Actionable Levers */}
          <div className="space-y-3 lg:col-span-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-marine-faint">
              Co-Optimized Controls (Click to Inspect)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {LEVERS.map((lv, idx) => {
                const Icon = lv.icon;
                const active = idx === activeLever;
                return (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setActiveLever(idx)}
                    aria-pressed={active}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      active
                        ? "border-hydro bg-surface shadow-md ring-1 ring-hydro/25"
                        : "border-line bg-surface/80 hover:border-slate-300 hover:bg-surface"
                    }`}
                  >
                    <span className="num mt-0.5 rounded-md bg-marine px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                      {lv.num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-marine-ink">
                          <Icon className="h-3.5 w-3.5 text-hydro" aria-hidden="true" />
                          {lv.title}
                        </span>
                        <span className={`num rounded-full border px-2 py-0.5 text-[10px] font-semibold ${lv.color}`}>
                          {lv.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-marine-muted">{lv.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#04111D] px-4 py-2.5 font-mono text-xs text-slate-300">
              <span className="text-sky-400">Integration Target ({current.num}):</span> {current.protocol}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
