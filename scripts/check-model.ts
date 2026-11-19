import { readFileSync } from "node:fs";
import { runSamplePlan, runSensitivity, toyWue, minPeak, uncontrolledWeek } from "../src/lib/model";
import type { PlanRequest } from "../src/lib/types";

const weather = JSON.parse(readFileSync(new URL("../src/data/weather.json", import.meta.url), "utf8")) as Record<
  string,
  { times: string[]; temps: number[] }
>;

let failures = 0;
function check(cond: boolean, message: string) {
  if (!cond) {
    failures += 1;
    console.error("FAIL", message);
  }
}

const baseReq = (over: Partial<PlanRequest> = {}): PlanRequest => ({
  site_id: "des-moines",
  start: "2025-07-08",
  end: "2025-07-14",
  flexible_share: 0.2,
  tank_gallons: 40_000,
  cap_ratio: 0.78,
  flex_event: false,
  flex_tighten: 0.3,
  foresight: "perfect",
  ...over,
});

function run(primary: string, sister: string, sisterName: string, request: PlanRequest) {
  return runSamplePlan({
    times: weather[primary].times,
    tempC: weather[primary].temps,
    sisterTempC: weather[sister].temps,
    sisterName,
    request,
  });
}

check(toyWue(25) === 0, "wue at 25 is 0");
check(Math.abs(toyWue(40) - 1.8) < 1e-9, "wue at 40 is 1.8");
check(toyWue(46) > 1.8, "wue keeps rising above 40");

const tankCase = minPeak([63664, 100212, 97549, 0, 10674, 28581, 72607], 40000);
check(Math.abs(tankCase.peak - 78880) < 80, `tank peak ${tankCase.peak} near 78880`);
check(minPeak([10, 50, 30], 0).peak === 50, "zero tank leaves the peak");

const dsm = run("des-moines__2025-07-08", "duluth__2025-07-08", "Duluth sister", baseReq());
const phx = run(
  "phoenix__2025-07-07",
  "des-moines__2025-07-07",
  "Des Moines sister",
  baseReq({ site_id: "phoenix", start: "2025-07-07", end: "2025-07-13" }),
);
const lhe = run(
  "lahore__2025-06-08",
  "islamabad__2025-06-08",
  "Islamabad sister",
  baseReq({ site_id: "lahore", start: "2025-06-08", end: "2025-06-14" }),
);

for (const plan of [dsm, phx, lhe]) {
  check(plan.meta.sample === true, "sample flag");
  check(plan.optimized.peak_day_gal <= plan.baseline.peak_day_gal + 1, "peak does not rise");
  check(plan.days.every((d) => d.baseline_gal >= 0 && d.optimized_gal >= 0), "non-negative days");
  check(plan.hours.every((h) => h.load_mw >= 49 && h.load_mw <= 100.01), `load bounds ${plan.meta.site_id}`);
  const util = plan.days.reduce((s, d) => s + d.optimized_gal, 0);
  const hours = plan.hours.reduce((s, h) => s + h.utility_gal, 0);
  check(Math.abs(util - hours) < plan.days.length * 2, `hourly utility sums to daily (${util} vs ${hours})`);
  check(plan.baseline.peak_day_date.length === 10, "peak date stamped");
}

check(dsm.levers.time_shift_mwh > dsm.levers.space_shift_mwh, "Iowa uses time-shift more than space-shift");
check(phx.levers.space_shift_mwh > phx.levers.time_shift_mwh, "Phoenix uses space-shift more than time-shift");
check(dsm.meta.cap_met, "Iowa meets the default cap");
check(dsm.optimized.extra_mwh === 0, "Iowa default cap does not need a swap");

const flex = run(
  "des-moines__2025-07-08",
  "duluth__2025-07-08",
  "Duluth sister",
  baseReq({ flex_event: true }),
);
check(flex.meta.cap_gal < dsm.meta.cap_gal * 0.75, "flex event tightens the cap by about 30%");
check(flex.optimized.peak_day_gal <= dsm.optimized.peak_day_gal + 1, "flex does not raise the Iowa peak");
check(flex.optimized.extra_mwh > 0, "Iowa flex event spends some electricity");

const loose = run("des-moines__2025-07-08", "duluth__2025-07-08", "Duluth sister", baseReq({ tank_gallons: 0, cap_ratio: 1 }));
const roomy = run(
  "des-moines__2025-07-08",
  "duluth__2025-07-08",
  "Duluth sister",
  baseReq({ tank_gallons: 120_000, cap_ratio: 1 }),
);
check(roomy.optimized.peak_day_gal <= loose.optimized.peak_day_gal + 1, "a larger tank does not raise the peak");

const low = run("des-moines__2025-07-08", "duluth__2025-07-08", "Duluth sister", baseReq({ flexible_share: 0.1, cap_ratio: 1, tank_gallons: 0 }));
const high = run("des-moines__2025-07-08", "duluth__2025-07-08", "Duluth sister", baseReq({ flexible_share: 0.3, cap_ratio: 1, tank_gallons: 0 }));
check(high.levers.peak_after_schedule_gal <= low.levers.peak_after_schedule_gal + 1, "more flexibility does not raise the scheduled peak");

const uncontrolled = uncontrolledWeek(
  weather["des-moines__2025-07-08"].times,
  weather["des-moines__2025-07-08"].temps,
  weather["duluth__2025-07-08"].temps,
);
check(
  uncontrolled.days.every((d, i) => d.baseline_gal === dsm.days[i].baseline_gal),
  "uncontrolled week matches plan baseline",
);

const sensitivity = runSensitivity({
  times: weather["phoenix__2025-07-07"].times,
  tempC: weather["phoenix__2025-07-07"].temps,
  sisterTempC: weather["des-moines__2025-07-07"].temps,
  sisterName: "Des Moines sister",
  request: baseReq({ site_id: "phoenix", start: "2025-07-07", end: "2025-07-13" }),
});
const cuts = sensitivity.points.map((p) => p.peak_cut_pct);
check(cuts[cuts.length - 1] + 0.2 >= cuts[0], `Phoenix sensitivity should not collapse (${cuts.join(", ")})`);
check(sensitivity.foresight.forecast_peak_cut_pct <= sensitivity.foresight.perfect_peak_cut_pct + 1, "forecast is not better than perfect by more than noise");
check(sensitivity.sample, "sensitivity is labelled sample");
check(lhe.levers.sister_added_gal > 0, "Lahore space-shift reports sister gallons");

console.log("\nDSM", summarize(dsm));
console.log("DSM flex", summarize(flex));
console.log("PHX", summarize(phx));
console.log("LHE", summarize(lhe));
console.log("sensitivity PHX", cuts.map((c) => c.toFixed(1)).join(", "));
console.log("foresight", sensitivity.foresight.perfect_peak_cut_pct.toFixed(1), "vs", sensitivity.foresight.forecast_peak_cut_pct.toFixed(1));

function summarize(plan: ReturnType<typeof runSamplePlan>) {
  const b = plan.baseline;
  const o = plan.optimized;
  return [
    plan.meta.site_id,
    `peak ${b.peak_day_gal} -> ${o.peak_day_gal}`,
    `cut ${(o.water_capacity_impact * 100).toFixed(1)}%`,
    `cap ${plan.meta.cap_gal} met ${plan.meta.cap_met}`,
    `pWUE ${b.pwue_l_per_kwh} -> ${o.pwue_l_per_kwh}`,
    `pf ${b.peaking_factor} -> ${o.peaking_factor}`,
    `extra ${o.extra_mwh} MWh`,
    `grid ${o.grid_peak_mw} MW`,
    `delay ${o.avg_job_delay_min} min`,
    `shift ${o.avg_flexible_shift_min} min`,
    `time ${plan.levers.time_shift_mwh}`,
    `space ${plan.levers.space_shift_mwh}`,
    `sisterGal ${plan.levers.sister_added_gal}`,
    `days ${plan.days.map((d) => Math.round(d.baseline_gal / 1000) + "/" + Math.round(d.optimized_gal / 1000)).join(" ")}`,
  ].join(" | ");
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
