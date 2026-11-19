"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Menu, X } from "lucide-react";
import { getHealth } from "@/lib/api";
import { REPO_URL } from "@/lib/precomputed";
import type { HealthResponse } from "@/lib/types";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/", label: "Overview", match: (p: string) => p === "/" },
  {
    href: "/#global-basins",
    label: "Global Basins",
    match: () => false,
  },
  {
    href: "/dashboard?tab=peak",
    label: "Control Plane",
    match: (p: string, tab: string | null) =>
      p.startsWith("/dashboard") && (!tab || tab === "peak" || tab === "dispatch"),
  },
  {
    href: "/dashboard?tab=tank",
    label: "Tank ROI",
    match: (p: string, tab: string | null) => p.startsWith("/dashboard") && tab === "tank",
  },
  {
    href: "/dashboard?tab=fleet",
    label: "10-City Fleet",
    match: (p: string, tab: string | null) => p.startsWith("/dashboard") && tab === "fleet",
  },
  {
    href: "/dashboard?tab=compliance",
    label: "ESG & EU EED",
    match: (p: string, tab: string | null) =>
      p.startsWith("/dashboard") && (tab === "compliance" || tab === "protocol"),
  },
];

export function Nav() {
  const path = usePathname();
  const params = useSearchParams();
  const currentTab = params.get("tab");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [engineState, setEngineState] = useState<"checking" | "live" | "sample" | "offline">("checking");
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((h) => {
        if (!active) return;
        setHealth(h);
        setEngineState(h.sample ? "sample" : "live");
      })
      .catch(() => {
        if (!active) return;
        setEngineState("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  const basinCount = health?.datasets?.sites_count;
  const badge =
    engineState === "live"
      ? {
          dot: "bg-emerald-400",
          text: basinCount ? `CBC MILP · ${basinCount} basins` : "CBC MILP",
          cls: "border-emerald-700/70 bg-emerald-950/70 text-emerald-200",
        }
      : engineState === "sample"
        ? { dot: "bg-amber-400", text: "Sample Heuristic", cls: "border-amber-700/70 bg-amber-950/70 text-amber-200" }
        : engineState === "offline"
          ? { dot: "bg-rose-400", text: "Solver Offline", cls: "border-rose-700/70 bg-rose-950/70 text-rose-200" }
          : { dot: "bg-slate-400", text: "Connecting…", cls: "border-slate-700 bg-slate-900 text-slate-300" };

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-slate-800/90 bg-[#04111D]/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="ThirstCap Water-Cap OS" onClick={() => setMobileOpen(false)}>
              <Logo inverted />
            </Link>
            {health?.version ? (
              <span className="num hidden rounded-full border border-sky-800/70 bg-sky-950/70 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 whitespace-nowrap xl:inline-block">
                v{health.version}
              </span>
            ) : null}
          </div>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = item.match(path, currentTab);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
                    active ? "bg-[#102842] text-white ring-1 ring-sky-500/30" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <div className="relative" ref={popRef}>
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                aria-expanded={popoverOpen}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${badge.cls}`}
              >
                <span className={`h-2 w-2 rounded-full ${badge.dot}`} aria-hidden="true" />
                <span>{badge.text}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
              </button>

              {popoverOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-[#081B2E] p-4 text-xs text-slate-200 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-white">Live Engine &amp; Data Stack</p>
                    <span className="num rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      {health?.version ? `v${health.version}` : "…"}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                    <StatusRow label="Optimization Solver" ok={engineState === "live"} value={health?.solver ?? "—"} />
                    <StatusRow
                      label="EIA-930 US grids (MISO/AZPS/PJM)"
                      ok={Boolean(health?.datasets?.eia930_miso && health?.datasets?.eia930_azps && health?.datasets?.eia930_pjm)}
                      value={
                        health?.datasets?.eia930_miso && health.datasets.eia930_azps && health.datasets.eia930_pjm
                          ? "3 annual profiles"
                          : "—"
                      }
                    />
                    <StatusRow
                      label="Alibaba GPU 2020 trace"
                      ok={Boolean(health?.datasets?.alibaba_gpu_2020)}
                      value="759,033 jobs parsed"
                    />
                    <StatusRow
                      label="Global stress corridors"
                      ok={(health?.datasets?.sites_count ?? 0) > 0}
                      value={health?.datasets?.sites_count != null ? `${health.datasets.sites_count} cities` : "—"}
                    />
                    <StatusRow
                      label="Open-Meteo weather fixtures"
                      ok={(health?.datasets?.fixtures_count ?? 0) > 0}
                      value={health?.datasets?.fixtures_count != null ? `${health.datasets.fixtures_count} series` : "—"}
                    />
                  </dl>
                  <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
                    759,033 is total_jobs_parsed in the ingested Alibaba cluster-trace-gpu-v2020 profile, not a live count.
                  </p>
                </div>
              ) : null}
            </div>

            <a
              href={REPO_URL}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0A1E33] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-400/60 hover:text-white whitespace-nowrap"
            >
              Source
            </a>

            <Link
              href="/dashboard"
              className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-[#04111D] transition-colors hover:bg-sky-400 whitespace-nowrap"
            >
              Launch App
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-white lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {mobileOpen ? (
          <nav id="mobile-nav" className="border-t border-slate-800 bg-[#081B2E] px-4 py-3.5 lg:hidden" aria-label="Mobile">
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
                <span className={`h-2 w-2 rounded-full ${badge.dot}`} aria-hidden="true" />
                <span>{badge.text}</span>
              </span>
              <span className="num text-xs text-slate-400">{health?.version ? `v${health.version}` : ""}</span>
            </div>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = item.match(path, currentTab);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                        active ? "bg-[#102842] text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
              <a
                href={REPO_URL}
                className="rounded-lg border border-slate-700 bg-[#04111D] py-2.5 text-center text-xs font-semibold text-white"
              >
                Source
              </a>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-sky-500 py-2.5 text-center text-xs font-bold text-[#04111D]"
              >
                Launch App
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

    </>
  );
}

function StatusRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-slate-300">
        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${ok ? "text-emerald-400" : "text-slate-500"}`} aria-hidden="true" />
        <span>{label}</span>
      </dt>
      <dd className="num font-semibold text-white whitespace-nowrap">{value}</dd>
    </div>
  );
}
