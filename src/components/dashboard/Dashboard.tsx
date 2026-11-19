"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Database, FileCheck2, Globe, Loader2, RefreshCw, ShieldCheck, SlidersHorizontal, TableProperties, Wind, Zap } from "lucide-react";
import { ComplianceTab } from "@/components/dashboard/ComplianceTab";
import { ControlPanel, type HorizonMode, type LocationKind } from "@/components/dashboard/ControlPanel";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DispatchTab } from "@/components/dashboard/DispatchTab";
import { FleetTab } from "@/components/dashboard/FleetTab";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { PeakCapTab } from "@/components/dashboard/PeakCapTab";
import { ProtocolTab } from "@/components/dashboard/ProtocolTab";
import { TankSizingTab } from "@/components/dashboard/TankSizingTab";
import { downloadPlanCsv, runPlan, runSensitivityCall, usingMock } from "@/lib/api";
import { PRESETS, SITES, presetsFor, siteById, summerPeak2026Window, type SiteId } from "@/lib/sites";
import type { CustomSiteInput, PlanRequest, PlanResponse, PlantModelKind, SensitivityResponse } from "@/lib/types";

type TabId = "peak" | "dispatch" | "tank" | "fleet" | "compliance" | "protocol";

function parseTab(raw: string | null): TabId {
  if (raw === "dispatch" || raw === "tank" || raw === "fleet" || raw === "compliance" || raw === "protocol") {
    return raw;
  }
  return "peak";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function Dashboard() {
  const params = useSearchParams();
  const qSite = params.get("site");
  const qPreset = params.get("preset");
  const qMode = params.get("mode");
  const qTab = params.get("tab");
  const qCustomName = params.get("custom_name");
  const qLat = params.get("lat");
  const qLon = params.get("lon");
  const qTz = params.get("tz");
  const qCountry = params.get("country");

  const hasCustomQuery = Boolean(qCustomName && qLat && qLon);
  const initSite: SiteId = SITES.some((s) => s.id === qSite) ? (qSite as SiteId) : "dubai";
  const initPreset = PRESETS.some((p) => p.id === qPreset && p.siteId === initSite)
    ? (qPreset as string)
    : presetsFor(initSite)[0].id;
  const initHorizon: HorizonMode =
    qMode === "peak2026" || qMode === "backtest"
      ? "peak2026"
      : qMode === "custom_dates"
        ? "custom_dates"
        : "live";

  const [locationKind, setLocationKind] = useState<LocationKind>(hasCustomQuery ? "custom" : "preset");
  const [horizonMode, setHorizonMode] = useState<HorizonMode>(initHorizon);
  const [siteId, setSiteId] = useState<SiteId>(initSite);
  const [presetId, setPresetId] = useState<string>(initPreset);
  const [customSite, setCustomSite] = useState<CustomSiteInput>(() =>
    hasCustomQuery
      ? {
          name: qCustomName!,
          country: qCountry ?? "",
          lat: Number(qLat),
          lon: Number(qLon),
          timezone: qTz || "auto",
        }
      : {
          name: "Tokyo, Japan",
          country: "Japan",
          lat: 35.6895,
          lon: 139.6917,
          timezone: "Asia/Tokyo",
        },
  );
  const [customStart, setCustomStart] = useState("2026-07-13");
  const [customEnd, setCustomEnd] = useState("2026-07-19");

  const [flexibleShare, setFlexibleShare] = useState(0.2);
  const [tankGallons, setTankGallons] = useState(40_000);
  const [capRatio, setCapRatio] = useState(0.78);
  const [reclaimedWaterShare, setReclaimedWaterShare] = useState(0.35);
  const [waterTariff, setWaterTariff] = useState<number>(() => siteById(initSite).tariffUsdPerKgal);
  const [itCapacityMw, setItCapacityMw] = useState(100);
  const [coc, setCoc] = useState(4.0);
  const [plantModel, setPlantModel] = useState<PlantModelKind>("physical");
  const [electricityPrice, setElectricityPrice] = useState(85);
  const [droughtTighten, setDroughtTighten] = useState(0.3);

  const [activeTab, setActiveTab] = useState<TabId>(() => parseTab(qTab));
  const [horizon, setHorizon] = useState<"72h" | "week">("72h");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sensError, setSensError] = useState<string | null>(null);

  useEffect(() => {
    if (qTab) setActiveTab(parseTab(qTab));
  }, [qTab]);

  const preset = PRESETS.find((p) => p.id === presetId) ?? presetsFor(siteId)[0];
  const site = siteById(siteId);

  const buildRequest = useCallback(
    (
      override?: Partial<PlanRequest> & {
        nextLocation?: LocationKind;
        nextHorizon?: HorizonMode;
        nextSite?: SiteId;
        nextPreset?: string;
        nextCustom?: CustomSiteInput;
        nextStart?: string;
        nextEnd?: string;
        nextTank?: number;
        nextTighten?: number;
        nextTariff?: number;
      },
    ): PlanRequest => {
      const loc = override?.nextLocation ?? locationKind;
      const hm = override?.nextHorizon ?? horizonMode;
      const s = override?.nextSite ?? siteId;
      const pId = override?.nextPreset ?? presetId;
      const cSite = override?.nextCustom ?? customSite;
      const tGal = override?.nextTank ?? tankGallons;
      const tighten = override?.nextTighten ?? droughtTighten;
      const tariff = override?.nextTariff ?? waterTariff;
      const pObj = PRESETS.find((p) => p.id === pId) ?? presetsFor(s)[0];

      const isLive = hm === "live";
      let reqStart = todayIso();
      let reqEnd = plusDaysIso(6);
      if (hm === "peak2026") {
        if (loc === "preset") {
          reqStart = pObj.start;
          reqEnd = pObj.end;
        } else {
          const w = summerPeak2026Window(cSite.lat);
          reqStart = w.start;
          reqEnd = w.end;
        }
      } else if (hm === "custom_dates") {
        reqStart = override?.nextStart ?? customStart;
        reqEnd = override?.nextEnd ?? customEnd;
      }

      return {
        site_id: loc === "custom" ? "custom" : s,
        start: reqStart,
        end: reqEnd,
        flexible_share: flexibleShare,
        tank_gallons: tGal,
        cap_ratio: capRatio,
        flex_event: tighten > 0.001,
        flex_tighten: tighten > 0.001 ? tighten : 0.3,
        foresight: isLive ? "live_forecast" : "perfect",
        live_days: 7,
        plant_model: plantModel,
        it_capacity_mw: itCapacityMw,
        coc,
        electricity_price_usd_per_mwh: electricityPrice,
        reclaimed_water_share: reclaimedWaterShare,
        ...(loc === "preset" ? { water_tariff_usd_per_kgal: tariff } : {}),
        ...(loc === "custom" ? { custom_site: cSite } : {}),
        ...override,
      };
    },
    [
      locationKind,
      horizonMode,
      siteId,
      presetId,
      customSite,
      customStart,
      customEnd,
      flexibleShare,
      tankGallons,
      capRatio,
      droughtTighten,
      waterTariff,
      plantModel,
      itCapacityMw,
      coc,
      electricityPrice,
      reclaimedWaterShare,
    ],
  );

  const executeSolve = useCallback(async (req: PlanRequest, nextTighten: number) => {
    setRunning(true);
    setError(null);
    try {
      const res = await runPlan(req);
      setPlan(res);
      if (res.business_impact?.water_tariff_usd_per_kgal && req.site_id === "custom") {
        setWaterTariff(res.business_impact.water_tariff_usd_per_kgal);
      }
      setDroughtTighten(nextTighten);
      setStale(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Optimizer request failed.");
    } finally {
      setRunning(false);
    }
  }, []);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void executeSolve(buildRequest(), droughtTighten);
  }, [buildRequest, droughtTighten, executeSolve]);

  useEffect(() => {
    let cancel = false;
    const req = buildRequest({ cap_ratio: 1, flex_event: false });
    const timer = window.setTimeout(() => {
      runSensitivityCall(req)
        .then((res) => {
          if (!cancel) {
            setSensitivity(res);
            setSensError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancel) setSensError(err instanceof Error ? err.message : "Sensitivity curve failed.");
        });
    }, usingMock() ? 0 : 400);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [buildRequest]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function markDirty<T>(setter: (val: T) => void) {
    return (val: T) => {
      setter(val);
      setStale(true);
    };
  }

  function handleSelectHorizon(nextHorizon: HorizonMode) {
    setHorizonMode(nextHorizon);
    const req = buildRequest({ nextHorizon, nextTighten: droughtTighten });
    void executeSolve(req, droughtTighten);
  }

  function handleSelectSite(nextSite: SiteId) {
    const nextPreset = presetsFor(nextSite)[0].id;
    const nextTariff = siteById(nextSite).tariffUsdPerKgal;
    setLocationKind("preset");
    setSiteId(nextSite);
    setPresetId(nextPreset);
    setWaterTariff(nextTariff);
    setHorizon("72h");
    const req = buildRequest({
      nextLocation: "preset",
      nextSite,
      nextPreset,
      nextTariff,
      nextTighten: droughtTighten,
    });
    void executeSolve(req, droughtTighten);
  }

  function handleSelectPreset(nextPreset: string) {
    setPresetId(nextPreset);
    const req = buildRequest({ nextPreset, nextTighten: droughtTighten });
    void executeSolve(req, droughtTighten);
  }

  function handleSelectCustomSite(nextCustom: CustomSiteInput) {
    setLocationKind("custom");
    setCustomSite(nextCustom);
    const req = buildRequest({ nextLocation: "custom", nextCustom, nextTighten: droughtTighten });
    void executeSolve(req, droughtTighten);
  }

  function handleChangeCustomDates(start: string, end: string) {
    setCustomStart(start);
    setCustomEnd(end);
    setStale(true);
  }

  function handleSelectDroughtStage(tighten: number) {
    setDrawerOpen(false);
    const req = buildRequest({ nextTighten: tighten });
    void executeSolve(req, tighten);
  }

  function handleApplyRecommendedTank(gallons: number) {
    setTankGallons(gallons);
    setActiveTab("peak");
    const req = buildRequest({ nextTank: gallons });
    void executeSolve(req, droughtTighten);
  }

  function handleInspectCampus(targetSiteId: SiteId, mode?: HorizonMode) {
    const nextPreset = presetsFor(targetSiteId)[0].id;
    const nextTariff = siteById(targetSiteId).tariffUsdPerKgal;
    const targetHorizon = mode ?? horizonMode;
    setLocationKind("preset");
    setHorizonMode(targetHorizon);
    setSiteId(targetSiteId);
    setPresetId(nextPreset);
    setWaterTariff(nextTariff);
    setActiveTab("peak");
    const req = buildRequest({
      nextLocation: "preset",
      nextHorizon: targetHorizon,
      nextSite: targetSiteId,
      nextPreset,
      nextTariff,
      nextTighten: droughtTighten,
    });
    void executeSolve(req, droughtTighten);
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      await downloadPlanCsv(buildRequest());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "CSV export failed.");
    } finally {
      setExporting(false);
    }
  }

  const flexOn = droughtTighten > 0.001;
  const siteLabel = locationKind === "custom" ? customSite.name : `${site.name}, ${site.country}`;
  const windowLabel = plan
    ? horizonMode === "live"
      ? `${plan.meta.start} to ${plan.meta.end} (Live 7-Day Forecast)`
      : `${plan.meta.start} to ${plan.meta.end} (Peak Archive)`
    : horizonMode === "live"
      ? "Live 7-Day Forecast"
      : preset.label;

  const panelProps = {
    locationKind,
    horizonMode,
    onSelectHorizon: handleSelectHorizon,
    siteId,
    onSelectSite: handleSelectSite,
    presetId,
    onSelectPreset: handleSelectPreset,
    customSite,
    onSelectCustomSite: handleSelectCustomSite,
    customStart,
    customEnd,
    onChangeCustomDates: handleChangeCustomDates,
    flexibleShare,
    onChangeFlexibleShare: markDirty(setFlexibleShare),
    tankGallons,
    onChangeTankGallons: markDirty(setTankGallons),
    capRatio,
    onChangeCapRatio: markDirty(setCapRatio),
    reclaimedWaterShare,
    onChangeReclaimedWaterShare: markDirty(setReclaimedWaterShare),
    waterTariff,
    onChangeWaterTariff: markDirty(setWaterTariff),
    itCapacityMw,
    onChangeItCapacityMw: markDirty(setItCapacityMw),
    coc,
    onChangeCoc: markDirty(setCoc),
    plantModel,
    onChangePlantModel: markDirty(setPlantModel),
    electricityPrice,
    onChangeElectricityPrice: markDirty(setElectricityPrice),
    baselinePeak: plan?.baseline.peak_day_gal ?? 0,
    flexOn,
    running,
    stale,
    onRun: () => {
      setDrawerOpen(false);
      void executeSolve(buildRequest(), droughtTighten);
    },
    onFlex: () => {
      const next = flexOn ? 0 : 0.3;
      handleSelectDroughtStage(next);
    },
  };

  const tabs: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "peak", label: "Peak Cap & ROI", Icon: BarChart3 },
    { id: "dispatch", label: "72h Dispatch", Icon: TableProperties },
    { id: "tank", label: "Tank ROI", Icon: Database },
    { id: "fleet", label: "10-City Fleet", Icon: Globe },
    { id: "compliance", label: "ESG & EU EED", Icon: ShieldCheck },
    { id: "protocol", label: "Water-DR", Icon: FileCheck2 },
  ];

  const currentReq = buildRequest();
  const coolAmbientBanner = Boolean(plan && plan.baseline.peak_day_gal < 100 && horizonMode === "live");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:pb-12">
      <div className="lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* Desktop Independently Scrollable Control Rail */}
        <aside
          aria-label="Facility optimization controls"
          className="no-print hidden rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-[5.25rem] lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <ControlPanel {...panelProps} />
        </aside>

        {/* Main Telemetry & Analytics Workspace */}
        <div className="min-w-0 space-y-4">
          <DashboardHero
            plan={plan}
            siteLabel={siteLabel}
            windowLabel={windowLabel}
            droughtStage={droughtTighten}
            reclaimedShare={reclaimedWaterShare}
            running={running}
            exporting={exporting}
            onSelectDroughtStage={handleSelectDroughtStage}
            onExportCsv={handleExportCsv}
            onOpenCertificate={() => setActiveTab("compliance")}
          />

          {error ? (
            <div
              role="alert"
              className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-flex/40 bg-flex-tint/60 px-4 py-3 text-sm text-flex"
            >
              <div>
                <strong className="font-semibold">Optimizer Error:</strong> {error}
              </div>
              <button
                type="button"
                onClick={() => void executeSolve(buildRequest(), droughtTighten)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-flex px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry Solve
              </button>
            </div>
          ) : null}

          {coolAmbientBanner ? (
            <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-marine">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 shrink-0 text-hydro" aria-hidden="true" />
                <span>
                  <strong>Cool Live Forecast (&lt;25°C):</strong>{" "}
                  {siteLabel} runs on free air economizers today (~0 gal water draw needed).
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectHorizon("peak2026")}
                className="rounded-lg bg-hydro px-3.5 py-1.5 font-semibold text-white hover:bg-hydro-dark"
              >
                Stress-Test 2026 Peak Summer →
              </button>
            </div>
          ) : null}

          {stale && plan ? (
            <div
              aria-live="polite"
              className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hydro/30 bg-sky-50 px-4 py-2.5 text-xs text-marine"
            >
              <span>Facility controls changed. Charts reflect the last solved CBC MILP plan.</span>
              <button
                type="button"
                onClick={() => void executeSolve(buildRequest(), droughtTighten)}
                disabled={running}
                className="rounded-lg bg-hydro px-3.5 py-1.5 font-semibold text-white hover:bg-hydro-dark disabled:opacity-60"
              >
                {running ? "Solving…" : "Re-solve Now"}
              </button>
            </div>
          ) : null}

          {plan ? (
            <>
              <KpiGrid plan={plan} />

              {/* 6-Tab Workspace Bar */}
              <div className="no-print overflow-x-auto border-b border-line">
                <div className="flex min-w-max gap-1" role="tablist" aria-label="Control plane views">
                  {tabs.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveTab(id)}
                        className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                          active
                            ? "border-hydro text-hydro-dark"
                            : "border-transparent text-marine-muted hover:text-marine"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === "peak" ? (
                <PeakCapTab plan={plan} siteLabel={siteLabel} windowLabel={windowLabel} />
              ) : null}
              {activeTab === "dispatch" ? (
                <DispatchTab
                  plan={plan}
                  horizon={horizon}
                  onChangeHorizon={setHorizon}
                  tankCapacity={tankGallons}
                />
              ) : null}
              {activeTab === "tank" ? (
                <TankSizingTab
                  request={currentReq}
                  currentTank={tankGallons}
                  onApplyRecommendedTank={handleApplyRecommendedTank}
                />
              ) : null}
              {activeTab === "fleet" ? (
                <FleetTab
                  request={currentReq}
                  onInspectCampus={(sid, m) => handleInspectCampus(sid, m)}
                />
              ) : null}
              {activeTab === "compliance" ? (
                <ComplianceTab plan={plan} request={currentReq} />
              ) : null}
              {activeTab === "protocol" ? (
                <ProtocolTab
                  plan={plan}
                  sensitivity={sensitivity}
                  sensError={sensError}
                  flexibleShare={flexibleShare}
                  onExportCsv={handleExportCsv}
                  exporting={exporting}
                />
              ) : null}
            </>
          ) : (
            <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-hydro" aria-hidden="true" />
              <p className="mt-3 font-display text-base font-bold text-marine">
                Solving Live 7-Day Rolling CBC MILP…
              </p>
              <p className="mt-1 text-xs text-marine-muted">
                Fetching real-time Open-Meteo weather, wet-bulb telemetry, EIA-930 grid demand, and Alibaba GPU workload.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Slide-Over Configuration Drawer */}
      {drawerOpen ? (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Facility configuration">
          <div
            className="fixed inset-0 bg-marine/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="relative z-10 h-full w-full max-w-sm overflow-y-auto border-r border-line bg-surface p-4 shadow-xl"
            style={{ overscrollBehavior: "contain" }}
          >
            <ControlPanel {...panelProps} onCloseDrawer={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* Mobile / Tablet Fixed Bottom Command Bar */}
      <div
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 py-2.5 backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-[auto_1fr_1fr] gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-subtle px-3 text-xs font-semibold text-marine"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Configure</span>
          </button>
          <button
            type="button"
            onClick={() => void executeSolve(buildRequest(), droughtTighten)}
            disabled={running}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-marine px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            <span>{running ? "Solving…" : stale ? "Re-solve" : "Solve MILP"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectDroughtStage(flexOn ? 0 : 0.3)}
            disabled={running}
            aria-pressed={flexOn}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-2.5 text-xs font-semibold disabled:opacity-60 ${
              flexOn ? "border-flex bg-flex text-white" : "border-flex/40 bg-flex-tint/40 text-flex"
            }`}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{flexOn ? "Clear Flex" : "Flex -30%"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
