"use client";

import { useEffect, useState } from "react";
import { Building2, Calendar, Droplets, Globe, Loader2, Radio, Search, SlidersHorizontal, X, Zap } from "lucide-react";
import { geocodeCity } from "@/lib/api";
import { formatGal } from "@/lib/format";
import { PRESETS, SITES, presetsFor, type CorridorGroup, type SiteId } from "@/lib/sites";
import type { CustomSiteInput, GeocodeResult, PlantModelKind } from "@/lib/types";

export type HorizonMode = "live" | "peak2026" | "custom_dates";
export type LocationKind = "preset" | "custom";

const QUICK_CUSTOM_CITIES: { label: string; custom: CustomSiteInput }[] = [
  {
    label: "Tokyo",
    custom: { name: "Tokyo, Japan", country: "Japan", lat: 35.6895, lon: 139.6917, timezone: "Asia/Tokyo" },
  },
  {
    label: "Mumbai",
    custom: { name: "Mumbai, India", country: "India", lat: 19.076, lon: 72.8777, timezone: "Asia/Kolkata" },
  },
  {
    label: "Singapore",
    custom: { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, timezone: "Asia/Singapore" },
  },
  {
    label: "London",
    custom: { name: "London, UK", country: "United Kingdom", lat: 51.5072, lon: -0.1276, timezone: "Europe/London" },
  },
  {
    label: "Riyadh",
    custom: { name: "Riyadh, Saudi Arabia", country: "Saudi Arabia", lat: 24.7136, lon: 46.6753, timezone: "Asia/Riyadh" },
  },
  {
    label: "Johor Bahru",
    custom: { name: "Johor Bahru, Malaysia", country: "Malaysia", lat: 1.4927, lon: 103.7414, timezone: "Asia/Kuala_Lumpur" },
  },
];

const CORRIDOR_GROUPS: CorridorGroup[] = [
  "North America",
  "Latin America",
  "Europe (EU)",
  "Middle East (MENA)",
  "South Asia",
];

export function ControlPanel({
  locationKind,
  horizonMode,
  onSelectHorizon,
  siteId,
  onSelectSite,
  presetId,
  onSelectPreset,
  customSite,
  onSelectCustomSite,
  customStart,
  customEnd,
  onChangeCustomDates,
  flexibleShare,
  onChangeFlexibleShare,
  tankGallons,
  onChangeTankGallons,
  capRatio,
  onChangeCapRatio,
  reclaimedWaterShare,
  onChangeReclaimedWaterShare,
  waterTariff,
  onChangeWaterTariff,
  itCapacityMw,
  onChangeItCapacityMw,
  coc,
  onChangeCoc,
  plantModel,
  onChangePlantModel,
  electricityPrice,
  onChangeElectricityPrice,
  baselinePeak,
  flexOn,
  running,
  stale,
  onRun,
  onFlex,
  onCloseDrawer,
}: {
  locationKind: LocationKind;
  horizonMode: HorizonMode;
  onSelectHorizon: (m: HorizonMode) => void;
  siteId: SiteId;
  onSelectSite: (s: SiteId) => void;
  presetId: string;
  onSelectPreset: (id: string) => void;
  customSite: CustomSiteInput;
  onSelectCustomSite: (c: CustomSiteInput) => void;
  customStart: string;
  customEnd: string;
  onChangeCustomDates: (start: string, end: string) => void;
  flexibleShare: number;
  onChangeFlexibleShare: (v: number) => void;
  tankGallons: number;
  onChangeTankGallons: (v: number) => void;
  capRatio: number;
  onChangeCapRatio: (v: number) => void;
  reclaimedWaterShare: number;
  onChangeReclaimedWaterShare: (v: number) => void;
  waterTariff: number;
  onChangeWaterTariff: (v: number) => void;
  itCapacityMw: number;
  onChangeItCapacityMw: (v: number) => void;
  coc: number;
  onChangeCoc: (v: number) => void;
  plantModel: PlantModelKind;
  onChangePlantModel: (v: PlantModelKind) => void;
  electricityPrice: number;
  onChangeElectricityPrice: (v: number) => void;
  baselinePeak: number;
  flexOn: boolean;
  running: boolean;
  stale: boolean;
  onRun: () => void;
  onFlex: () => void;
  onCloseDrawer?: () => void;
}) {
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCityResults([]);
      setSearchError(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      geocodeCity(q)
        .then((res) => {
          setCityResults(res);
          setSearchError(res.length === 0 ? "No matching cities found." : null);
        })
        .catch((err: unknown) => {
          setSearchError(err instanceof Error ? err.message : "City lookup failed");
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [cityQuery]);

  const presets = presetsFor(siteId);
  const currentSite = SITES.find((s) => s.id === siteId) ?? SITES[0];

  return (
    <div className="flex flex-col gap-4">
      {onCloseDrawer ? (
        <div className="flex items-center justify-between border-b border-line pb-3">
          <span className="font-display text-base font-bold text-marine">Facility Configuration</span>
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close configuration drawer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-marine hover:bg-subtle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Worldwide City Search (Primary Entry Point) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="city-search" className="text-xs font-semibold text-marine-muted">
            Any City Worldwide (Live &amp; 2026)
          </label>
          <span className="font-mono text-[10px] font-semibold text-emerald-700">200K+ Cities</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-marine-faint" aria-hidden="true" />
          <input
            id="city-search"
            name="city_search"
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Search any city (Tokyo, Mumbai…)"
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-8 text-xs text-marine placeholder:text-marine-faint focus:border-hydro focus:outline-none"
          />
          {searching && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-hydro" />}
        </div>
        {searchError ? <p className="text-xs text-flex">{searchError}</p> : null}
        {cityResults.length > 0 ? (
          <ul className="max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface text-xs shadow-md">
            {cityResults.map((item) => (
              <li key={`${item.name}-${item.lat}-${item.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCustomSite({
                      name: item.country ? `${item.name}, ${item.country}` : item.name,
                      country: item.country,
                      lat: item.lat,
                      lon: item.lon,
                      timezone: item.timezone,
                    });
                    setCityQuery("");
                    setCityResults([]);
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-2 text-left hover:bg-subtle"
                >
                  <span className="font-semibold text-marine">
                    {item.name}
                    {item.admin1 ? `, ${item.admin1}` : ""}
                  </span>
                  <span className="text-hydro">{item.country}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Quick Global Hubs */}
        <div className="flex flex-wrap gap-1">
          {QUICK_CUSTOM_CITIES.map((item) => {
            const active = locationKind === "custom" && customSite.name === item.custom.name;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectCustomSite(item.custom)}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-line bg-surface text-marine-muted hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calibrated 10 Flagship Stress Corridors */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <label htmlFor="basin-select" className="text-xs font-semibold text-marine-muted">
            Or Select Calibrated Corridor
          </label>
          <span className="num rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            {locationKind === "preset" ? `WRI ${currentSite.wriScore}` : "Global Custom"}
          </span>
        </div>
        <select
          id="basin-select"
          value={locationKind === "preset" ? siteId : ""}
          onChange={(e) => {
            if (e.target.value) onSelectSite(e.target.value as SiteId);
          }}
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-semibold text-marine focus:border-hydro focus:outline-none"
        >
          {locationKind === "custom" && <option value="">Custom City: {customSite.name}</option>}
          {CORRIDOR_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {SITES.filter((s) => s.corridorGroup === group).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country}) · WRI {s.wriScore}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Time Horizon Selector (Live 7-Day DEFAULT | 2026 Peak | Custom Dates) */}
      <div className="border-t border-line pt-3">
        <span className="mb-1.5 block text-xs font-semibold text-marine-muted">Operating Window (2026)</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-subtle p-1" role="group" aria-label="Operating window">
          {(
            [
              { id: "live", label: "Live 7d", Icon: Radio },
              { id: "peak2026", label: "2026 Peak", Icon: Calendar },
              { id: "custom_dates", label: "Custom", Icon: Globe },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = horizonMode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectHorizon(id)}
                className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 py-2 text-[11px] font-semibold transition-colors ${
                  active ? "bg-surface text-marine shadow-sm" : "text-marine-muted hover:text-marine"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {horizonMode === "peak2026" && locationKind === "preset" && (
          <div className="mt-2 space-y-1.5">
            {presets.map((item) => {
              const selected = item.id === (PRESETS.find((p) => p.id === presetId)?.id ?? presets[0].id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectPreset(item.id)}
                  className={`block w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    selected ? "border-hydro bg-sky-50/70 text-marine" : "border-line bg-surface text-marine-muted"
                  }`}
                >
                  <span className="num block text-xs font-semibold text-marine">{item.label}</span>
                  <span className="block text-[11px] text-marine-faint">{item.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {horizonMode === "custom_dates" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-marine-muted">
              Start Date
              <input
                type="date"
                value={customStart}
                onChange={(e) => onChangeCustomDates(e.target.value, customEnd)}
                className="num mt-1 w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-marine"
              />
            </label>
            <label className="text-[11px] font-medium text-marine-muted">
              End Date
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onChangeCustomDates(customStart, e.target.value)}
                className="num mt-1 w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-marine"
              />
            </label>
          </div>
        )}
      </div>

      {/* Core Optimization Levers */}
      <div className="space-y-3.5 border-t border-line pt-3.5">
        <SliderField
          id="flexible-share"
          label="Flexible Compute Share"
          hint="Batch & checkpointed jobs (Alibaba trace). Inference stays fixed."
          min={5}
          max={30}
          step={1}
          value={Math.round(flexibleShare * 100)}
          display={`${Math.round(flexibleShare * 100)}%`}
          onChange={(v) => onChangeFlexibleShare(v / 100)}
        />
        <SliderField
          id="tank-volume"
          label="Thermal / Water Tank"
          hint="Pre-filled storage volume available to shave peak-day draws."
          min={0}
          max={160}
          step={5}
          value={Math.round(tankGallons / 1000)}
          display={`${formatGal(tankGallons)} gal`}
          onChange={(v) => onChangeTankGallons(v * 1000)}
        />
        <SliderField
          id="daily-cap"
          label="Firm Utility Daily Cap"
          hint="Target ceiling vs uncontrolled peak. Water-DR tightens up to 45%."
          min={40}
          max={100}
          step={1}
          value={Math.round(capRatio * 100)}
          display={
            baselinePeak > 0
              ? `${Math.round(capRatio * 100)}% (${formatGal(baselinePeak * capRatio)})`
              : `${Math.round(capRatio * 100)}%`
          }
          onChange={(v) => onChangeCapRatio(v / 100)}
        />
        <SliderField
          id="reclaimed-share"
          label="Reclaimed / TSE Water Mix"
          hint="Non-potable cooling supply share boosting EU EED & Permit Shield."
          min={0}
          max={85}
          step={5}
          value={Math.round(reclaimedWaterShare * 100)}
          display={`${Math.round(reclaimedWaterShare * 100)}%`}
          onChange={(v) => onChangeReclaimedWaterShare(v / 100)}
        />
      </div>

      {/* Expandable Plant & Economic Parameters */}
      <details className="rounded-lg border border-line bg-subtle/60 px-3 py-2.5">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-marine">
          <SlidersHorizontal className="h-3.5 w-3.5 text-hydro" aria-hidden="true" />
          <span>Plant Physics &amp; Regional Tariffs</span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <SliderField
            id="water-tariff"
            label="Regional Water Tariff"
            hint="Industrial potable rate ($/1,000 gal) for CFO ROI math."
            min={10}
            max={180}
            step={5}
            value={Math.round(waterTariff * 10)}
            display={`$${waterTariff.toFixed(2)}/kgal`}
            onChange={(v) => onChangeWaterTariff(v / 10)}
          />
          <SliderField
            id="it-capacity"
            label="Plant IT Nameplate"
            hint="Alibaba workload scales to 70% mean load."
            min={20}
            max={300}
            step={10}
            value={Math.round(itCapacityMw)}
            display={`${Math.round(itCapacityMw)} MW`}
            onChange={onChangeItCapacityMw}
          />
          <SliderField
            id="tower-coc"
            label="Tower CoC"
            hint="Cycles of concentration (make-up = evap × CoC/(CoC−1))."
            min={30}
            max={60}
            step={5}
            value={Math.round(coc * 10)}
            display={`${coc.toFixed(1)}×`}
            onChange={(v) => onChangeCoc(v / 10)}
          />
          <SliderField
            id="power-price"
            label="Industrial Power Tariff"
            hint="Used to price +0.15 PUE dry-cooling swaps."
            min={20}
            max={200}
            step={5}
            value={Math.round(electricityPrice)}
            display={`$${Math.round(electricityPrice)}/MWh`}
            onChange={onChangeElectricityPrice}
          />
          <div>
            <span className="mb-1 block text-xs font-medium text-marine-muted">Cooling Curve</span>
            <div className="grid grid-cols-2 gap-1 rounded border border-line bg-surface p-0.5 text-xs">
              {(
                [
                  { id: "physical", label: "Physical Wet-Bulb" },
                  { id: "toy", label: "Toy Curve" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={plantModel === opt.id}
                  onClick={() => onChangePlantModel(opt.id)}
                  className={`rounded px-2 py-1.5 font-medium transition-colors ${
                    plantModel === opt.id ? "bg-marine text-white" : "text-marine-muted hover:text-marine"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Primary Action Buttons (Desktop rail) */}
      <div className="hidden gap-2 pt-1 lg:grid">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hydro disabled:opacity-60"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Solving CBC MILP…</span>
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" aria-hidden="true" />
              <span>{stale ? "Re-solve MILP Plan" : "Run 72h CBC MILP"}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onFlex}
          disabled={running}
          aria-pressed={flexOn}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
            flexOn
              ? "border-flex bg-flex text-white hover:bg-rose-800"
              : "border-flex/40 bg-flex-tint/40 text-flex hover:bg-flex-tint"
          }`}
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          <span>{flexOn ? "Clear Drought Stage" : "Stage 2 Alert (-30%)"}</span>
        </button>
      </div>

      <p className="flex items-center gap-1.5 rounded-lg bg-subtle px-2.5 py-2 text-[11px] text-marine-muted">
        <Droplets className="h-3.5 w-3.5 shrink-0 text-hydro" aria-hidden="true" />
        <span>
          Tariff set to <strong className="num text-marine">${waterTariff.toFixed(2)}/kgal</strong> regional rate.
        </span>
      </p>
    </div>
  );
}

function SliderField({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-marine">
          {label}
        </label>
        <span className="num text-xs font-semibold text-hydro-dark">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        style={{ ["--pct" as string]: `${pct}%` }}
        className="mt-1.5"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="mt-1 text-[11px] leading-4 text-marine-faint">{hint}</p>
    </div>
  );
}
