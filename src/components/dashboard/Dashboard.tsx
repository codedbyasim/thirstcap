"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import weatherJson from "@/data/weather.json";
import { DailyWaterChart } from "@/components/charts/DailyWaterChart";
import { HourlyChart } from "@/components/charts/HourlyChart";
import { SensitivityChart } from "@/components/charts/SensitivityChart";
import { runPlan, runSensitivityCall, usingMock } from "@/lib/api";
import { formatDelta, formatGal, formatMgd, formatNum, hourLabel, shortDate, weekday } from "@/lib/format";
import { uncontrolledWeek } from "@/lib/model";
import { PRESETS, SITES, presetsFor, siteById, type Preset, type SiteId } from "@/lib/sites";
import type { HourPoint, PlanRequest, PlanResponse, SensitivityResponse } from "@/lib/types";

type Bundle = Record<string, { times: string[]; temps: number[] }>;
const weather = weatherJson as Bundle;
const MOCK = usingMock();

export function Dashboard() {
  const params = useSearchParams();
  const requestedSite = params.get("site");
  const requestedPreset = params.get("preset");
  const startSite: SiteId = SITES.some((s) => s.id === requestedSite) ? (requestedSite as SiteId) : "des-moines";
  const startPreset = PRESETS.some((p) => p.id === requestedPreset && p.siteId === startSite)
    ? (requestedPreset as string)
    : presetsFor(startSite)[0].id;

  const [siteId, setSiteId] = useState<SiteId>(startSite);
  const [presetId, setPresetId] = useState(startPreset);
  const [flexibleShare, setFlexibleShare] = useState(0.2);
  const [tankGallons, setTankGallons] = useState(40_000);
  const [capRatio, setCapRatio] = useState(0.78);
  const [flexOn, setFlexOn] = useState(false);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<"72h" | "week">("72h");
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [sensError, setSensError] = useState<string | null>(null);

  const site = siteById(siteId);
  const preset = PRESETS.find((p) => p.id === presetId) ?? presetsFor(siteId)[0];
  const bundle = weather[preset.primaryKey];
  const sisterBundle = weather[preset.sisterKey];

  const baseline = useMemo(
    () => uncontrolledWeek(bundle.times, bundle.temps, sisterBundle.temps),
    [bundle, sisterBundle],
  );
  const baselinePeak = Math.max(...baseline.days.map((d) => d.baseline_gal));
  const capPreview = baselinePeak * capRatio * (flexOn ? 0.7 : 1);

  useEffect(() => {
    let cancel = false;
    const handle = window.setTimeout(() => {
      runSensitivityCall(makeRequest(siteId, preset, flexibleShare, tankGallons, 1, false))
        .then((result) => {
          if (!cancel) {
            setSensitivity(result);
            setSensError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancel) setSensError(err instanceof Error ? err.message : "Sensitivity failed");
        });
    }, MOCK ? 0 : 350);
    return () => {
      cancel = true;
      window.clearTimeout(handle);
    };
  }, [siteId, preset, flexibleShare, tankGallons]);

  function markStale<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      if (plan) setStale(true);
    };
  }

  function selectSite(next: SiteId) {
    setSiteId(next);
    setPresetId(presetsFor(next)[0].id);
    setPlan(null);
    setFlexOn(false);
    setStale(false);
    setError(null);
    setHorizon("72h");
  }

  async function execute(flexEvent: boolean) {
    setRunning(true);
    setError(null);
    const started = performance.now();
    try {
      const result = await runPlan(makeRequest(siteId, preset, flexibleShare, tankGallons, capRatio, flexEvent));
      if (MOCK) {
        const wait = 680 - (performance.now() - started);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      }
      setPlan(result);
      setFlexOn(flexEvent);
      setStale(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The planner did not return a plan.");
    } finally {
      setRunning(false);
    }
  }

  const showPlan = plan != null && plan.meta.site_id === siteId && plan.meta.start === preset.start;
  const active = showPlan ? plan : null;
  const sample = active?.meta.sample ?? MOCK;

  const dailyRows = baseline.days.map((day, index) => ({
    label: weekday(day.date),
    date: shortDate(active ? active.days[index].date : day.date),
    temp: active ? active.days[index].temp_max_c : day.temp_max_c,
    baseline: active ? active.days[index].baseline_gal : day.baseline_gal,
    optimized: active ? active.days[index].optimized_gal : null,
  }));

  const hourSource: Array<{
    time: string;
    temp: number;
    load: number;
    space: number;
    mode: string;
    water: number;
    note: string;
  }> = active
    ? active.hours.map((hour) => ({
        time: hour.time,
        temp: hour.temp_c,
        load: hour.load_mw,
        space: hour.space_shift_out_mw,
        mode: hour.cooling_mode,
        water: hour.utility_gal,
        note: hourNote(hour),
      }))
    : baseline.hours.map((hour) => ({
        time: hour.time,
        temp: hour.temp_c,
        load: 70,
        space: 0,
        mode: hour.temp_c <= 25 ? "dry" : "evaporative",
        water: hour.water_gal,
        note: `${hour.time.slice(0, 16).replace("T", " ")} · ${hour.temp_c.toFixed(1)}°C · baseline`,
      }));

  const slice = horizon === "72h" ? hourSource.slice(0, 72) : hourSource;
  const hourlyRows = slice.map((hour, index) => ({
    label: index % 24 === 0 ? shortDate(hour.time.slice(0, 10)) : hourLabel(hour.time),
    time: hour.time,
    temp: hour.temp,
    load: hour.load,
    space: hour.space,
    mode: hour.mode,
  }));

  const cap = active ? active.meta.cap_gal : capPreview;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-lagoon">Interactive demo</p>
          <h1 className="mt-1 font-serif text-3xl text-ink sm:text-4xl">72-hour water plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Pick a real 2025 heat week, set the cap, and run the sample planner. The button is the moment in the
            video: jobs leave the hot hours, and the daily line is scored against the cap.
          </p>
        </div>
        <StatusPill sample={sample} connected={!MOCK} />
      </div>

      {sample ? (
        <p className="mt-4 rounded-2xl border border-heat/30 bg-heat-mist px-4 py-3 text-sm leading-6 text-heat-deep">
          <strong className="font-semibold">Sample data.</strong> Temperatures are the Open-Meteo archive. Water,
          delays, and megawatt-hours come from the brief&apos;s toy cooling curve and a stand-in planner, not the MILP
          and not a real facility. Do not put these numbers in the video or on the project page.
        </p>
      ) : (
        <p className="mt-4 rounded-2xl border border-lagoon/30 bg-lagoon-mist px-4 py-3 text-sm text-lagoon-deep">
          Connected to the optimizer at the configured API. Figures below are that service&apos;s response.
        </p>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card lg:sticky lg:top-20">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Site</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SITES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSite(item.id)}
                  aria-pressed={item.id === siteId}
                  className={`rounded-2xl border px-3 py-2 text-left ${
                    item.id === siteId ? "border-lagoon bg-lagoon-mist" : "border-sand-line bg-white hover:border-ink/20"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block text-xs text-ink-faint">{item.country}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Heat week</legend>
            <div className="mt-2 space-y-2">
              {presetsFor(siteId).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === preset.id}
                  onClick={() => {
                    setPresetId(item.id);
                    setPlan(null);
                    setFlexOn(false);
                    setStale(false);
                  }}
                  className={`block w-full rounded-2xl border px-3 py-2 text-left ${
                    item.id === preset.id ? "border-lagoon bg-white" : "border-transparent bg-sand hover:bg-white"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-ink-soft">{item.title}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 space-y-4">
            <Slider
              label="Flexible share"
              hint="Share of IT energy that may move. Inference stays put."
              min={5}
              max={30}
              step={1}
              value={Math.round(flexibleShare * 100)}
              display={`${Math.round(flexibleShare * 100)}%`}
              onChange={markStale((value: number) => setFlexibleShare(value / 100))}
            />
            <Slider
              label="Tank"
              hint="Usable storage. A few hours of withdrawal, not a multi-day heatwave."
              min={0}
              max={160}
              step={5}
              value={Math.round(tankGallons / 1000)}
              display={`${formatGal(tankGallons)} gal`}
              onChange={markStale((value: number) => setTankGallons(value * 1000))}
            />
            <Slider
              label="Daily cap"
              hint="Fraction of the uncontrolled peak day. The flex event takes 30% off this."
              min={50}
              max={100}
              step={1}
              value={Math.round(capRatio * 100)}
              display={`${Math.round(capRatio * 100)}% · ${formatGal(baselinePeak * capRatio)} gal`}
              onChange={markStale((value: number) => setCapRatio(value / 100))}
            />
          </div>

          <div className="mt-5 hidden gap-2 lg:grid">
            <RunButtons
              running={running}
              stale={stale && !!active}
              flexOn={flexOn}
              onRun={() => execute(flexOn)}
              onFlex={() => execute(!flexOn)}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-faint">
            {site.climate} Sister in this sample: {site.sisterName}. {preset.blurb}
          </p>
        </aside>

        <div className="mt-6 space-y-5 lg:mt-0">
          <ol className="grid gap-2 text-xs text-ink-soft sm:grid-cols-3">
            {[
              "Baseline is the uncontrolled plant on this week’s real temperatures.",
              "Run ThirstCap to move flexible work, then the tank, then dry cooling if the cap still breaks.",
              "The flex event is the utility signal. It tightens the cap 30% and solves again.",
            ].map((step, index) => (
              <li key={step} className="rounded-2xl bg-white/70 px-3 py-2">
                <span className="font-semibold text-lagoon">{index + 1}. </span>
                {step}
              </li>
            ))}
          </ol>

          {error ? (
            <p role="alert" className="rounded-2xl border border-heat bg-heat-mist px-4 py-3 text-sm text-heat-deep">
              {error}
            </p>
          ) : null}
          {stale && active ? (
            <p className="rounded-2xl bg-white px-4 py-2 text-sm text-ink-soft">
              Sliders moved. The charts still show the previous sample plan until you run again.
            </p>
          ) : null}

          <section aria-labelledby="metrics-heading" className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="metrics-heading" className="font-serif text-2xl">
                {active ? "Before → after" : "Baseline, before the plan"}
              </h2>
              <p className="text-xs text-ink-faint">
                Cap {formatGal(cap)} gal/day · {formatMgd(cap)}
                {active?.meta.flex_event ? " · flex event on" : ""}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                label="Peak-day water"
                before={`${formatGal(active ? active.baseline.peak_day_gal : baselinePeak)} gal`}
                after={active ? `${formatGal(active.optimized.peak_day_gal)} gal` : null}
                delta={active ? formatDelta(active.optimized.peak_day_gal, active.baseline.peak_day_gal) : null}
                hint={
                  active
                    ? `${shortDate(active.baseline.peak_day_date)} → ${shortDate(active.optimized.peak_day_date)}`
                    : "Hottest withdrawal day in this window"
                }
              />
              <Metric
                label="Peak-day WUE"
                before={`${formatNum(active ? active.baseline.pwue_l_per_kwh : previewPwue(baselinePeak), 2)} L/kWh`}
                after={active ? `${formatNum(active.optimized.pwue_l_per_kwh, 2)} L/kWh` : null}
                delta={active ? formatDelta(active.optimized.pwue_l_per_kwh, active.baseline.pwue_l_per_kwh) : null}
                hint="Peak-day litres ÷ IT kWh served locally that day"
              />
              <Metric
                label="Window peaking factor"
                before={formatNum(active ? active.baseline.peaking_factor : previewFactor(baseline.days.map((d) => d.baseline_gal)), 2)}
                after={active ? formatNum(active.optimized.peaking_factor, 2) : null}
                delta={active ? formatDelta(active.optimized.peaking_factor, active.baseline.peaking_factor) : null}
                hint="Peak day ÷ mean day in this week. Annual factors are larger because winter days use almost no water."
              />
              <Metric
                label="Extra electricity"
                before="0 MWh"
                after={active ? `${formatNum(active.optimized.extra_mwh, 1)} MWh` : null}
                delta={null}
                hint="Only the +0.15 PUE on hours switched to dry cooling"
              />
              <Metric
                label="Added on grid peak"
                before="0 MW"
                after={active ? `${formatNum(active.optimized.grid_peak_mw, 2)} MW` : null}
                delta={null}
                hint="Sample afternoon peak, not EIA-930. Swaps avoid those hours until the cap forces them."
              />
              <Metric
                label="Average job delay"
                before="0 min"
                after={active ? `${formatNum(active.optimized.avg_job_delay_min, 0)} min` : null}
                delta={null}
                hint={
                  active
                    ? `Fleet average. Flexible work moved ${formatNum(active.optimized.avg_flexible_shift_min / 60, 1)} h on average, including jobs brought forward.`
                    : "Lateness across all IT energy. Work moved earlier counts as zero."
                }
              />
            </div>
            {active ? (
              <div className="mt-4 rounded-2xl bg-lagoon-deep px-4 py-4 text-sand sm:px-5">
                <p className="text-xs uppercase tracking-[0.16em] text-lagoon-mist">Sample water capacity impact</p>
                <p className="mt-1 font-serif text-4xl num">
                  {formatNum(active.optimized.water_capacity_impact * 100, 0)}
                  <span className="text-2xl">%</span>
                </p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-lagoon-mist">
                  of this site&apos;s baseline peak day,{" "}
                  {formatGal(active.baseline.peak_day_gal - active.optimized.peak_day_gal)} gal/day (
                  {formatMgd(active.baseline.peak_day_gal - active.optimized.peak_day_gal)}). Sample definition: peak
                  gallons avoided ÷ baseline peak. The paper&apos;s score replaces it when the calibrated model is
                  connected.
                </p>
                {!active.meta.cap_met ? (
                  <p className="mt-2 text-sm text-heat-mist">
                    Cap missed by {formatGal(active.meta.cap_shortfall_gal)} gal. The levers in this sample cannot buy
                    the rest without breaking a limit. That is a result, not a hidden error.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-lagoon-mist">Cap held for every day in the window.</p>
                )}
              </div>
            ) : null}
          </section>

          <section aria-labelledby="daily-heading" className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="daily-heading" className="font-serif text-2xl">
                  Daily withdrawal
                </h2>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">
                  {site.name}, {preset.label}. Orange is the uncontrolled plant. Teal appears after you run the plan.
                  The dashed line is the cap a utility could write into a connection agreement.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <DailyWaterChart rows={dailyRows} cap={cap} showOptimized={!!active} />
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-lagoon">Daily numbers</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <caption className="sr-only">Daily water for {site.name}</caption>
                  <thead className="text-ink-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Date</th>
                      <th className="py-1 pr-3 font-medium">Max °C</th>
                      <th className="py-1 pr-3 font-medium">Baseline gal</th>
                      <th className="py-1 pr-3 font-medium">Plan gal</th>
                      <th className="py-1 font-medium">Cap gal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(active ? active.days : baseline.days).map((day, index) => (
                      <tr key={day.date} className="border-t border-sand-line">
                        <td className="py-1.5 pr-3">{day.date}</td>
                        <td className="py-1.5 pr-3 num">{day.temp_max_c.toFixed(1)}</td>
                        <td className="py-1.5 pr-3 num">{formatGal(day.baseline_gal)}</td>
                        <td className="py-1.5 pr-3 num">{active ? formatGal(active.days[index].optimized_gal) : "—"}</td>
                        <td className="py-1.5 num">{formatGal(active ? active.meta.cap_gal : cap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section aria-labelledby="plan-heading" className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="plan-heading" className="font-serif text-2xl">
                  {horizon === "72h" ? "First 72 hours" : "Full week"}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">
                  Each cell is an hour. Colour is the cooling mode. A hollow mark means flexible load left that hour.
                </p>
              </div>
              <div className="flex rounded-full bg-sand p-1 text-sm" role="group" aria-label="Plan length">
                {(["72h", "week"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={horizon === option}
                    onClick={() => setHorizon(option)}
                    className={`rounded-full px-3 py-1 ${horizon === option ? "bg-white shadow-sm" : ""}`}
                  >
                    {option === "72h" ? "72 hours" : "7 days"}
                  </button>
                ))}
              </div>
            </div>
            <PlanStrip hours={slice} />
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-soft">
              <LegendSwatch color="#d7efe9" label="Dry, at or below 25°C" />
              <LegendSwatch color="#f3c3a6" label="Evaporative assist" />
              <LegendSwatch color="#e3b15a" label="Water↔power swap" />
              <LegendSwatch color="transparent" label="Ring: load left the hour" ring />
            </div>
            <div className="mt-4">
              <HourlyChart rows={hourlyRows} />
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-faint">
              The teal area is local IT load. It starts flat at 70 MW. After a run, afternoons dip and cooler hours
              fill up to the 100 MW cap. The rust line is megawatts sent to the {site.sisterName.toLowerCase()} in that
              hour. Gold is dry-bulb temperature.
            </p>
          </section>

          <section aria-labelledby="lever-heading" className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card sm:p-5">
            <h2 id="lever-heading" className="font-serif text-2xl">
              Four levers, one peak
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
              The objective is the worst day, not the total litres. Scheduling runs first. The tank moves withdrawal
              onto a cooler day. Dry cooling is bought only when the cap is still broken, and grid-peak hours are
              touched last.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Lever
                index="01"
                title="Time-shift"
                body="Batch work and checkpointed training can move up to 18 hours earlier or 24 hours later. Interactive inference cannot."
                stat={active ? `${formatNum(active.levers.time_shift_mwh, 0)} MWh moved across hours` : "Waiting for a run"}
              />
              <Lever
                index="02"
                title="Space-shift"
                body={`Send flexible load to the ${site.sisterName} only when that hour is actually cooler. The water is not shipped. A cooler climate evaporates less.`}
                stat={
                  active
                    ? `${formatNum(active.levers.space_shift_mwh, 0)} MWh sent · ${formatGal(active.levers.sister_added_gal)} gal added at the sister`
                    : site.sisterNote
                }
              />
              <Lever
                index="03"
                title="Water↔power swap"
                body="Force dry cooling at +0.15 PUE. The sample grid peak is protected unless the cap cannot be met any other way."
                stat={
                  active
                    ? `${formatNum(active.levers.swap_mwh, 0)} MWh switched · ${formatNum(active.optimized.extra_mwh, 1)} extra MWh · ${formatNum(active.optimized.grid_peak_mw, 2)} MW on the sample peak`
                    : "Held in reserve until the cap breaks"
                }
              />
              <Lever
                index="04"
                title="Tank fill and draw"
                body="The tank starts this window full, filled on a cooler day before it. It can shave one peak. It cannot carry a week of heat."
                stat={
                  active
                    ? `${formatGal(tankGallons)} gal tank · ${formatGal(active.levers.tank_net_draw_gal)} gal net draw from the prefill`
                    : `${formatGal(tankGallons)} gal in the current setting`
                }
              />
            </div>
            {active ? (
              <ol className="mt-4 grid gap-2 sm:grid-cols-4">
                {[
                  ["Baseline", active.levers.peak_baseline_gal],
                  ["After schedule", active.levers.peak_after_schedule_gal],
                  ["After tank", active.levers.peak_after_tank_gal],
                  ["Final", active.levers.peak_final_gal],
                ].map(([label, value]) => (
                  <li key={String(label)} className="rounded-2xl bg-sand px-3 py-2">
                    <p className="text-xs text-ink-faint">{label}</p>
                    <p className="num text-sm font-semibold">{formatGal(Number(value))} gal</p>
                    <div className="mt-2 h-1.5 rounded-full bg-sand-line">
                      <div
                        className="h-1.5 rounded-full bg-lagoon"
                        style={{ width: `${Math.max(4, (Number(value) / active.levers.peak_baseline_gal) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
            {active && active.levers.sister_added_gal > 1000 ? (
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                {active.levers.sister_name} baseline peak {formatGal(active.levers.sister_baseline_peak_gal)} gal, and{" "}
                {formatGal(active.levers.sister_peak_with_shift_gal)} gal with the shifted load. A cap has to exist at
                both sites. Moving the spike is not the same as removing it.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="sensitivity-heading" className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card sm:p-5">
            <h2 id="sensitivity-heading" className="font-serif text-2xl">
              What flexibility is worth
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
              Peak cut against flexible share, with the current tank and with dry-cooling swaps turned off. The curve
              flattens when nights stay hot. Beside it, the same plan under perfect temperatures and under a synthetic
              cool bias of a few degrees. That bias is not the Open-Meteo historical-forecast archive. The backend
              contract returns the real backtest.
            </p>
            {sensError ? <p className="mt-3 text-sm text-heat-deep">{sensError}</p> : null}
            {sensitivity ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <SensitivityChart points={sensitivity.points} />
                <div className="rounded-2xl bg-sand p-4 text-sm">
                  <p className="text-xs uppercase tracking-[0.14em] text-ink-faint">Foresight at {Math.round(flexibleShare * 100)}% flex</p>
                  <p className="mt-2">
                    Perfect{" "}
                    <span className="num font-semibold">{formatNum(sensitivity.foresight.perfect_peak_cut_pct, 1)}%</span>
                  </p>
                  <p>
                    Noisy forecast{" "}
                    <span className="num font-semibold">{formatNum(sensitivity.foresight.forecast_peak_cut_pct, 1)}%</span>
                  </p>
                  <p className="mt-2 text-xs leading-5 text-ink-faint">
                    {Math.abs(sensitivity.foresight.perfect_peak_cut_pct - sensitivity.foresight.forecast_peak_cut_pct) < 1
                      ? "On this week the hot hours and the cool hours are far enough apart that a small temperature error barely reorders the plan."
                      : "The noisy forecast leaves more load on hours that were actually hot, so the scored peak is higher."}{" "}
                    {sensitivity.foresight.note}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-faint">Computing the sample curve…</p>
            )}
            {sensitivity ? <p className="mt-2 text-xs leading-5 text-ink-faint">{sensitivity.label}</p> : null}
          </section>

          {site.pakistan ? (
            <section aria-labelledby="pk-heading" className="rounded-3xl border border-sand-line bg-white p-4 sm:p-5">
              <h2 id="pk-heading" className="font-serif text-2xl">
                Pakistan scenario
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {site.why} This is not an announced campus. In May 2025 the Finance Ministry allocated 2,000 MW for
                Bitcoin mining and AI data centers (
                <a className="text-lagoon underline" href="https://www.reuters.com/sustainability/boards-policy-regulation/pakistan-allocates-2000-megawatts-electricity-bitcoin-mining-ai-data-centres-2025-05-25/">
                  Reuters
                </a>
                ). The sample plant is 100 MW of IT on {site.name} weather, with an {site.sisterName.toLowerCase()} as
                the escape valve. {site.sisterNote}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Karachi&apos;s toy curve is a dry-bulb lower bound. Humid air makes evaporative assist less effective,
                and the calibrated plant model in the backend is where wet-bulb belongs. Lahore&apos;s lesson is the
                same one Phoenix teaches: hot nights limit time-shifting, so the sister site and the swap have to be
                in the plan, and the sister&apos;s own peak has to be on screen.
              </p>
            </section>
          ) : null}

          <section aria-labelledby="honest-heading" className="rounded-3xl bg-ink px-4 py-5 text-sand sm:px-5">
            <h2 id="honest-heading" className="font-serif text-2xl">
              Real and simulated
            </h2>
            <div className="mt-3 grid gap-4 text-sm leading-6 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-lagoon-mist">Real in this demo</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sand/90">
                  <li>Hourly dry-bulb temperatures from the Open-Meteo archive for the week on screen.</li>
                  <li>The toy curve as written in the team brief: 25°C threshold, 1.8 L/kWh at 40°C, +0.15 PUE.</li>
                  <li>The cap, the 30% flex event, and the four levers as a product a utility could read.</li>
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-heat-mist">Simulated, and labelled as such</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sand/90">
                  <li>The data center. There is no operator telemetry. IT load is a flat 70 MW inside 100 MW.</li>
                  <li>Flexible share, tank size, sister pairing, and the utility signal are assumptions you can move.</li>
                  <li>Grid stress is an afternoon shape, not EIA-930. The planner is a heuristic, not PuLP.</li>
                  <li>Nothing here is a saving at a facility that exists.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-line bg-sand/95 p-3 backdrop-blur lg:hidden">
        <RunButtons
          running={running}
          stale={stale && !!active}
          flexOn={flexOn}
          onRun={() => execute(flexOn)}
          onFlex={() => execute(!flexOn)}
        />
      </div>
    </div>
  );
}

function makeRequest(
  siteId: string,
  preset: Preset,
  flexibleShare: number,
  tankGallons: number,
  capRatio: number,
  flexEvent: boolean,
): PlanRequest {
  return {
    site_id: siteId,
    start: preset.start,
    end: preset.end,
    flexible_share: flexibleShare,
    tank_gallons: tankGallons,
    cap_ratio: capRatio,
    flex_event: flexEvent,
    flex_tighten: 0.3,
    foresight: "perfect",
  };
}

function previewPwue(peakGal: number): number {
  const itKwh = 70 * 24 * 1000;
  return peakGal / 0.264172052358 / itKwh;
}

function previewFactor(days: number[]): number {
  const peak = Math.max(...days);
  const mean = days.reduce((a, b) => a + b, 0) / days.length;
  return mean > 0 ? peak / mean : 0;
}

function hourNote(hour: HourPoint): string {
  const when = hour.time.slice(0, 16).replace("T", " ");
  return `${when}, ${hour.temp_c.toFixed(1)}°C, ${hour.cooling_mode}, local ${hour.load_mw.toFixed(1)} MW, utility ${Math.round(hour.utility_gal)} gal`;
}

function StatusPill({ sample, connected }: { sample: boolean; connected: boolean }) {
  if (sample) {
    return (
      <p className="rounded-full border border-heat/40 bg-heat-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-heat-deep">
        Sample planner
      </p>
    );
  }
  return (
    <p className="rounded-full border border-lagoon/40 bg-lagoon-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-lagoon-deep">
      {connected ? "Live optimizer" : "Optimizer"}
    </p>
  );
}

function RunButtons({
  running,
  stale,
  flexOn,
  onRun,
  onFlex,
}: {
  running: boolean;
  stale: boolean;
  flexOn: boolean;
  onRun: () => void;
  onFlex: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="rounded-full bg-lagoon px-3 py-2.5 text-sm font-semibold text-white hover:bg-lagoon-deep disabled:opacity-60"
      >
        {running ? "Solving…" : stale ? "Re-run ThirstCap" : "Run ThirstCap"}
      </button>
      <button
        type="button"
        onClick={onFlex}
        disabled={running}
        aria-pressed={flexOn}
        className={`rounded-full px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${
          flexOn ? "bg-heat text-white" : "border border-heat/50 bg-white text-heat-deep"
        }`}
      >
        {flexOn ? "Clear flex event" : "Utility flex event"}
      </button>
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="num text-xs text-ink-soft">{display}</span>
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
        className="mt-2"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className="mt-1 text-xs leading-5 text-ink-faint">{hint}</p>
    </div>
  );
}

function Metric({
  label,
  before,
  after,
  delta,
  hint,
}: {
  label: string;
  before: string;
  after: string | null;
  delta: string | null;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-sand-line bg-white px-3 py-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</h3>
      <p className="mt-2 text-sm text-ink-soft">
        <span className="num">{before}</span>
        {after ? (
          <>
            <span aria-hidden="true"> → </span>
            <span className="num font-semibold text-ink">{after}</span>
          </>
        ) : null}
      </p>
      {delta ? <p className="num mt-1 text-xs font-semibold text-lagoon">{delta}</p> : null}
      <p className="mt-1 text-xs leading-5 text-ink-faint">{hint}</p>
    </article>
  );
}

function Lever({ index, title, body, stat }: { index: string; title: string; body: string; stat: string }) {
  return (
    <article className="rounded-2xl bg-sand px-3 py-3">
      <p className="text-xs font-semibold text-lagoon">{index}</p>
      <h3 className="mt-1 font-serif text-xl">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{body}</p>
      <p className="mt-2 text-sm font-medium text-ink">{stat}</p>
    </article>
  );
}

function PlanStrip({ hours }: { hours: { time: string; temp: number; mode: string; load: number; note: string }[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className="grid min-w-[44rem] gap-1"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
        role="list"
        aria-label="Hourly cooling mode"
      >
        {hours.map((hour) => {
          const left = hour.load < 69.5;
          const bg = hour.mode === "swap" ? "#e3b15a" : hour.mode === "dry" ? "#d7efe9" : heatCell(hour.temp);
          return (
            <button
              key={hour.time}
              type="button"
              role="listitem"
              title={hour.note}
              aria-label={hour.note}
              className="h-8 rounded-sm"
              style={{
                background: bg,
                boxShadow: left ? "inset 0 0 0 1.5px #9a3412" : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function heatCell(temp: number): string {
  const t = Math.max(0, Math.min(1, (temp - 25) / 18));
  const r = Math.round(243 + (212 - 243) * t);
  const g = Math.round(214 + (120 - 214) * t);
  const b = Math.round(196 + (90 - 196) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function LegendSwatch({ color, label, ring = false }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: color, boxShadow: ring ? "inset 0 0 0 1.5px #9a3412" : undefined }}
      />
      {label}
    </span>
  );
}
