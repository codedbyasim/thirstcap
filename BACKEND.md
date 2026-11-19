# ThirstCap backend contract

Build this with FastAPI. When it is deployed, the frontend in this repository uses it unchanged: set `NEXT_PUBLIC_API_URL` to the service origin (no trailing slash) and `NEXT_PUBLIC_USE_MOCK=false`, then rebuild. Until that flag flips, the browser runs the sample planner in `src/lib/model.ts` and labels every figure as sample.

Do not change field names. The dashboard reads the JSON below directly. Unknown extra fields are ignored. Missing fields break the page.

The sample planner is a heuristic with a toy cooling curve. Your service is the real pipeline: Open-Meteo actuals and historical forecasts, a cooling-plant model, an Alibaba workload, and a MILP. Set `meta.sample` to `false` only when the MILP (or a documented feasible incumbent from that MILP) produced the plan. If you fall back to a heuristic, set `meta.sample` to `true` and say so in `meta.label`. The UI has a banner for that flag. Never return toy numbers with `sample: false`.

## 1. Service shape

```
backend/
  app/
    main.py                 # FastAPI app, CORS, routers
    config.py               # env, λ weights, CoC, IT size, time limit
    schemas.py              # Pydantic models, same names as section 3
    routers/plan.py         # POST /v1/plan, POST /v1/sensitivity
    routers/health.py       # GET /v1/health
    services/weather.py     # archive + historical forecast
    services/grid.py        # EIA-930 for US sites, labelled sample shape for Pakistan
    services/plant.py       # toy curve + physical plant
    services/workload.py    # Alibaba trace → hourly classes
    services/optimizer.py   # PuLP CBC or OR-Tools
    services/metrics.py     # the definitions in section 6
    data/fixtures/          # recorded Open-Meteo JSON used by unit tests
  tests/
  requirements.txt
  render.yaml
```

Suggested stack, all free: Python 3.12, FastAPI, uvicorn, pydantic v2, httpx, pulp (CBC bundled) or ortools, pandas, pytest.

`requirements.txt` lives in `backend/`, not the repository root, so Vercel keeps building the Next.js app from the root `package.json`.

## 2. CORS, errors, health

Allow the Vercel origin and `http://localhost:3000`. Methods: `GET`, `POST`, `OPTIONS`. Headers: `Content-Type`, `Accept`.

```python
# app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ThirstCap", version="1.0.0")
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)
```

Every error, including validation, uses this body and an HTTP status of 400, 404, 422, or 500. Do not return a stack trace.

```json
{
  "error": {
    "code": "unknown_preset",
    "message": "No weather for site des-moines from 2025-01-01 to 2025-01-07.",
    "details": { "site_id": "des-moines" }
  }
}
```

`GET /v1/health` returns 200:

```json
{ "status": "ok", "service": "thirstcap", "version": "1.0.0", "sample": false }
```

The frontend calls `POST /v1/plan` and `POST /v1/sensitivity` with a 90 second timeout. A 72-hour MILP at hourly resolution and two sites is small. Keep a CBC time limit of 15 seconds and return the best feasible solution. Put any time-limit note in `meta.label`.

## 3. `POST /v1/plan`

Request. Types match `src/lib/types.ts`.

```json
{
  "site_id": "des-moines",
  "start": "2025-07-08",
  "end": "2025-07-14",
  "flexible_share": 0.2,
  "tank_gallons": 40000,
  "cap_ratio": 0.78,
  "flex_event": false,
  "flex_tighten": 0.3,
  "foresight": "perfect"
}
```

| Field | Rule |
| --- | --- |
| `site_id` | `des-moines`, `phoenix`, `lahore`, or `karachi` |
| `start`, `end` | Inclusive calendar dates. The demo weeks are 7 days, 168 hours. Accept any range up to 14 days. |
| `flexible_share` | 0.05 to 0.30 |
| `tank_gallons` | ≥ 0, US gallons |
| `cap_ratio` | 0.40 to 1. Fraction of the **baseline** peak day |
| `flex_event` | When true, multiply the cap by `1 - flex_tighten` |
| `flex_tighten` | 0 to 0.80. The demo sends 0.30 |
| `foresight` | `perfect` uses archive temperatures for decisions and scoring. `historical_forecast` decides on the Open-Meteo historical forecast and scores water on the archive actuals |

Sites the UI already knows:

| id | Latitude | Longitude | Time zone | Sample sister | Sister coordinates |
| --- | ---: | ---: | --- | --- | --- |
| des-moines | 41.5868 | -93.6250 | America/Chicago | Duluth sister | 46.7867, -92.1005 |
| phoenix | 33.4484 | -112.0740 | America/Phoenix | Des Moines sister | 41.5868, -93.6250 |
| lahore | 31.5204 | 74.3587 | Asia/Karachi | Islamabad sister | 33.6844, 73.0479 |
| karachi | 24.8607 | 67.0011 | Asia/Karachi | Islamabad sister | 33.6844, 73.0479 |

Sisters are sample pairings, not operating campuses. Say that in `meta.label` if you keep these pairs. `meta.sister_name` must be a human name (`"Duluth sister"`, not an id).

Response:

```json
{
  "meta": {
    "sample": false,
    "label": "MILP on Open-Meteo archive temperatures. Sister pairing is a sample, not an operating campus.",
    "model": "pulp-cbc-v1",
    "weather_source": "open-meteo-archive",
    "site_id": "des-moines",
    "sister_name": "Duluth sister",
    "start": "2025-07-08",
    "end": "2025-07-14",
    "cap_gal": 111294,
    "cap_ratio_effective": 0.78,
    "cap_met": true,
    "cap_shortfall_gal": 0,
    "flex_event": false,
    "assumptions": ["Cycles of concentration default to 4 until calibrated."]
  },
  "baseline": { },
  "optimized": { },
  "levers": { },
  "hours": [ ],
  "days": [ ]
}
```

`weather_source` is `"open-meteo-archive"` when decisions used actuals, and `"backend"` is also accepted by the type. Prefer `"open-meteo-archive"` for perfect foresight. For `historical_forecast`, keep `weather_source` as `"open-meteo-archive"` (the score uses the archive) and mention the forecast in `label`.

### Metrics object

Used for both `baseline` and `optimized`.

```json
{
  "peak_day_gal": 142685,
  "peak_day_date": "2025-07-09",
  "mean_day_gal": 76000,
  "pwue_l_per_kwh": 0.322,
  "peaking_factor": 1.88,
  "extra_mwh": 0,
  "grid_peak_mw": 0,
  "avg_job_delay_min": 0,
  "avg_flexible_shift_min": 0,
  "water_capacity_impact": 0,
  "total_gal": 532000
}
```

Definitions, so the cards match the words on screen:

- `peak_day_gal` — maximum daily **utility withdrawal** in US gallons. Baseline has no tank and no swap, so withdrawal equals plant consumption. Optimized is after the tank.
- `peak_day_date` — `YYYY-MM-DD` of that day.
- `mean_day_gal` — mean daily withdrawal in the window.
- `pwue_l_per_kwh` — peak-day withdrawal in litres, divided by IT energy served **locally** that day in kWh. 1 US gallon = 3.785411784 L, or divide gallons by 0.264172052358 to get litres. This is a window peak-day intensity, not an annual WUE.
- `peaking_factor` — peak day ÷ mean day **inside this window**. Do not label it as the annual 6–10× factor. The UI already explains the difference.
- `extra_mwh` — electricity above the all-evaporative (or naturally dry) baseline, from forced dry cooling. Baseline is 0.
- `grid_peak_mw` — the largest extra electrical MW that lands on a grid-peak hour. Baseline is 0.
- `avg_job_delay_min` — energy-weighted lateness across **all** IT energy. Inflexible work and work moved earlier contribute 0. Multiply MWh-hours of positive delay by 60 and divide by total IT MWh.
- `avg_flexible_shift_min` — energy-weighted absolute shift of the flexible slice only, in minutes. Advances count.
- `water_capacity_impact` — `(baseline_peak - this_peak) / baseline_peak`, clipped at 0. Baseline’s own value is 0. This is the sample score the UI shows. If you implement the paper’s Water Capacity Impact instead, put the paper’s name in `meta.label` and still fill this field with the fraction of peak-day gallons avoided, because the card divides nothing else.
- `total_gal` — sum of daily utility withdrawal.

`cap_gal = baseline.peak_day_gal * cap_ratio * (1 - flex_tighten if flex_event else 1)`.

`cap_met` is true when `optimized.peak_day_gal` is within 0.5% of `cap_gal` or under it. Otherwise set `cap_shortfall_gal` to the positive difference. Do not hide an infeasible cap. The UI prints the shortfall.

### Levers object

```json
{
  "time_shift_mwh": 564,
  "space_shift_mwh": 290,
  "sister_name": "Duluth sister",
  "sister_added_gal": 0,
  "sister_baseline_peak_gal": 90000,
  "sister_peak_with_shift_gal": 90000,
  "swap_mwh": 0,
  "swap_hours": 0,
  "tank_net_draw_gal": 40000,
  "peak_baseline_gal": 142685,
  "peak_after_schedule_gal": 114370,
  "peak_after_tank_gal": 92927,
  "peak_final_gal": 92927
}
```

- `time_shift_mwh` — flexible IT energy that changed hour but stayed on the primary site.
- `space_shift_mwh` — flexible IT energy served at the sister.
- `sister_added_gal` — evaporation at the sister **caused by the shifted megawatts**, not the sister’s own base load. Water is not conserved across climates. A cool hour can add almost no gallons.
- `sister_baseline_peak_gal` and `sister_peak_with_shift_gal` — the sister’s own peak day without the shift, and with the shifted load added on top of the sister’s base load. The UI shows both so a local cap cannot hide a new peak.
- `swap_mwh` — IT energy switched to forced dry cooling. `swap_hours` — hours with swap fraction above 0.05.
- `tank_net_draw_gal` — tank volume at the start of the window minus volume at the end. The tank starts full. That water was withdrawn before the window.
- The four peaks are a waterfall: uncontrolled peak, peak of plant consumption after scheduling only, peak after the tank with swaps off, and the final utility peak. Final should be less than or equal to the earlier peaks when the solver is doing its job.

### Hour object

One entry per hour, local time, earliest first. A 7-day window has 168.

```json
{
  "time": "2025-07-08T15:00",
  "temp_c": 32.4,
  "sister_temp_c": 28.1,
  "baseline_load_mw": 70,
  "load_mw": 56.2,
  "time_shift_in_mw": 0,
  "time_shift_out_mw": 13.8,
  "space_shift_out_mw": 0,
  "sister_added_mw": 0,
  "baseline_water_gal": 8120.4,
  "consumption_gal": 6400.0,
  "utility_gal": 6400.0,
  "cooling_mode": "evaporative",
  "swap_fraction": 0,
  "grid_stress": 0.82,
  "grid_peak": false
}
```

`time` is local civil time `YYYY-MM-DDTHH:MM` with no offset, matching Open-Meteo’s timezone parameter. `cooling_mode` is `dry`, `evaporative`, or `swap`. Use `swap` when forced-dry fraction is at least 0.5, `dry` when the ambient hour is at or below the evaporative threshold, otherwise `evaporative`.

`consumption_gal` is what the plant uses. `utility_gal` is what the utility sees after the tank. The daily sum of `utility_gal` must match `days[].optimized_gal` within a gallon. The daily sum of `baseline_water_gal` must match `days[].baseline_gal`.

`load_mw` is local IT. It must stay inside 0…100. `baseline_load_mw` is the uncontrolled local IT (70 in the toy; your trace’s hourly value once the workload model is on).

### Day object

```json
{
  "date": "2025-07-09",
  "temp_max_c": 33.7,
  "baseline_gal": 142685,
  "scheduled_gal": 114370,
  "optimized_gal": 92927,
  "cap_gal": 111294
}
```

`scheduled_gal` is daily plant consumption after time-shift and space-shift, before the tank and before swaps. `optimized_gal` is daily utility withdrawal. `cap_gal` is the same number on every day.

## 4. `POST /v1/sensitivity`

Same request body as `/v1/plan`. Ignore `cap_ratio`, `flex_event`, and `foresight` for the curve. The question is how much **flexible work** is worth, not how much electricity can buy.

- Turn forced dry cooling off.
- Sweep `flexible_share` through 0.05, 0.10, 0.15, 0.20, 0.25, 0.30.
- Use the requested tank.
- Objective is still the peak day, plus delay. No cap, or a cap equal to the baseline peak so it does not bind.

Then, at the requested `flexible_share`, run that same swaps-off plan twice: once with perfect temperatures, once deciding on the historical forecast and scoring on actuals.

```json
{
  "sample": false,
  "label": "Swaps off. Forecast series is the Open-Meteo historical forecast, scored on archive actuals.",
  "swaps_included": false,
  "points": [
    { "flexible_share": 0.05, "peak_cut_pct": 20.1, "extra_mwh": 0, "peak_day_gal": 114000 }
  ],
  "foresight": {
    "flexible_share": 0.2,
    "perfect_peak_cut_pct": 34.9,
    "forecast_peak_cut_pct": 31.2,
    "perfect_peak_day_gal": 92927,
    "forecast_peak_day_gal": 98200,
    "note": "Decisions for the forecast case used the historical forecast issued ahead of each hour. Water was scored on the archive."
  }
}
```

`swaps_included` must be the boolean `false`. `peak_cut_pct` is `water_capacity_impact * 100`.

If this endpoint is slow, cache by `(site, start, end, tank, share)`. The UI calls it when the site, week, tank, or flexible share changes.

## 5. Data pipeline

### Weather

Archive actuals (decisions when `foresight=perfect`, and the score in every mode):

```
https://archive-api.open-meteo.com/v1/archive
  ?latitude={lat}&longitude={lon}
  &start_date={start}&end_date={end}
  &hourly=temperature_2m,relative_humidity_2m,dew_point_2m
  &timezone={site timezone}
```

Historical forecast (decisions when `foresight=historical_forecast`):

```
https://historical-forecast-api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &start_date={start}&end_date={end}
  &hourly=temperature_2m,relative_humidity_2m,dew_point_2m
  &timezone={site timezone}
```

Fetch the sister with the same dates and the sister’s coordinates. Cache responses on disk during a run only. Tests must use fixtures in `backend/data/fixtures/` so CI does not call the network. Record one fixture from the Des Moines week of 8–14 July 2025 and check it has 168 hours and a maximum near 33.7°C.

Wet bulb, Stull’s approximation, with T in °C and RH in percent:

```
Tw = T*atan(0.151977*(RH+8.313659)**0.5) + atan(T+RH) - atan(RH-1.676331)
     + 0.00391838*(RH**1.5)*atan(0.023101*RH) - 4.686035
```

### Grid

For Des Moines use EIA-930 hourly demand for MISO. For Phoenix use AZPS (or the balancing authority that contains the city if AZPS is renamed in the file you pull). Take the week, mark the top 15% of hours by demand as `grid_peak: true`, and scale the rest into `grid_stress` between 0 and 1.

EIA does not cover Lahore or Karachi. For those sites build an afternoon shape that peaks at 18:00 local and rises with temperature, and write `Sample grid shape, not a measured Pakistan dispatch` into `meta.assumptions`. Do not invent an official NTDC series.

The sample planner’s shape, if you need a placeholder before EIA is wired, is `0.75 * max(0, sin((hour-6)/24 * π)) + 0.25 * normalized temperature`, with hour in local time. Replace it for the two US sites before you set `sample: false`.

### Workload

Source: the public Alibaba GPU cluster trace, [github.com/alibaba/clusterdata](https://github.com/alibaba/clusterdata), 2020 GPU trace.

Build hourly arrivals in three classes:

- **fixed** — jobs under 15 minutes. They must run in the arrival hour. They may still be placed on the sister in that same hour if you allow it; the sample planner does not move them at all.
- **deferrable** — 15 minutes to 2 hours. The energy may move inside a window of 18 hours earlier to 24 hours later, in one block.
- **pausable** — longer than 2 hours. The energy may be split across hours in that same window.

These duration cuts are assumptions. Write them into `meta.assumptions`.

Scale the trace so the mean IT load over the horizon is 70 MW and no hour of uncontrolled load exceeds 100 MW. Then apply `flexible_share`: the fixed fraction is `1 - flexible_share`, and deferrable plus pausable are scaled to `flexible_share`, keeping their relative mix and their arrival shape. That is how the slider stays meaningful after the trace is connected. Inference was about 60% of U.S. AI server energy in 2023 (LBNL 2024), so do not let the default share exceed 30%.

Until the trace download is in, a flat 70 MW with `flexible_share` movable is an acceptable **sample** backend (`meta.sample: true`). It is what the frontend already does.

### Cooling plant

Two functions, both tested.

**Toy curve.** This is the contract test against the frontend, not the result you publish.

- 100 MW nameplate, 70 MW uncontrolled average when the trace is off.
- Water use effectiveness in L per IT kWh: `0` at or below 25°C, `1.8` at 40°C, linear in between and **continuing the same slope above 40°C**.
- Gallons per hour = `wue * load_mw * 1000 * 0.264172052358`.
- Forced dry cooling above 25°C leaves a residual `0.02 L/kWh` on the switched fraction and adds `0.15 * switched_MW` of electricity that hour. That 0.15 is the brief’s reference PUE penalty for turning evaporation off.
- Below 25°C the hour is already dry. Do not charge the penalty and do not invent residual water.

A unit test should reproduce the frontend’s Des Moines baseline peak for 8–14 July 2025 on the bundled temperatures: **142,685 gallons** on the peak day, within 1%. The bundled series is `src/data/weather.json` key `des-moines__2025-07-08`.

**Physical curve.** This is what `sample: false` should use, after you show the calibration.

- Latent heat 2,450 kJ/kg. Litres evaporated per kWh of heat rejected = `3600 / 2450` ≈ 1.469. The brief’s round figure is about 1.5 L per kWh fully rejected by evaporation. Use `3600/2450` and mention the rounding.
- Nearly all IT electricity becomes heat, and the cooling system’s own electricity becomes heat too. Heat rejected in an hour ≈ `IT_kWh * pue_mode`.
- Make-up = evaporation × `CoC / (CoC - 1)`. Default `CoC = 4` (an assumption: real towers run about 3–6). Make-up is the withdrawal.
- Modes, for hours warmer than 25°C dry-bulb:
  - evaporative assist while wet-bulb can approach the cold-water target (start with “wet-bulb at least 5°C under 25°C”),
  - otherwise a chiller, whose condenser may still evaporate,
  - **forced dry** (the swap lever) sets evaporation to the residual and adds 0.15 PUE on the switched IT.
- Naturally cold hours (`T_db ≤ 25`) are dry and free. No penalty.

Calibrate one multiplier on make-up, or on the evaporative fraction, against the anchors in the brief, all from the same paper: an Iowa campus near **0.19 L/kWh** annual, evaporative sites near **1.13–1.55 L/kWh**, Arizona monthly peaks **above 9 L/kWh**. The toy curve will not reach 9 L/kWh. If the physical model cannot reach the Arizona anchor, say so in `assumptions` and do not silently multiply until the chart looks right. Publish the multiplier.

Karachi is humid. Dry-bulb-only water is a lower bound. Wet-bulb has to be in the physical model before a Karachi number is treated as a result.

### Optimizer

Hourly MILP, rolling horizon of 72 hours, commit the first 24 hours, step forward through the week, stitch the committed hours into the 168-hour response. Re-solving every hour is the design. Committing 24 hours is an acceptable speed compromise if `meta.assumptions` says so.

Indices: hour `t` in the 72-hour window, day `d`, class `c` in `{fixed, deferrable, pausable}`, site `s` in `{primary, sister}`, mode `m` in `{evap, dry_forced}` on warm hours.

Decision variables:

- `p[c,s,t] ≥ 0` — IT megawatts of class `c` served at site `s` in hour `t`.
- `y[m,s,t] ∈ [0,1]` — mode share, summing to 1 over modes.
- `level[s,t]`, `fill[s,t]`, `draw[s,t] ≥ 0` — tank gallons.
- `P_peak ≥ 0` — peak daily primary withdrawal.
- `G_peak ≥ 0` — extra MW on the worst grid-peak hour.

Objective, weights in `config.py`, all of them assumptions:

```
minimize
    P_peak / P_baseline
  + λ1 * extra_MWh / IT_MWh_horizon
  + λ2 * G_peak / 100
  + λ3 * delay_hours / 24
```

Starting weights: `λ1 = 0.15`, `λ2 = 0.25`, `λ3 = 0.05`. Water remains the first term. Electricity and delay are penalties so the solver does not buy an empty peak. Expose them. Do not hide a trade-off by setting a penalty to zero.

Constraints:

1. Primary utility withdrawal on day `d` ≤ `P_peak`.
2. Primary utility withdrawal on day `d` ≤ `cap_gal`.
3. Sister daily withdrawal ≤ `sister_cap_ratio * sister_baseline_peak`, default `sister_cap_ratio = 1.10`, so the sister does not inherit an uncapped spike. If this makes the primary cap infeasible, return the best feasible plan and `cap_met: false` rather than dropping the sister constraint silently.
4. Fixed energy is served in its arrival hour. Deferrable and pausable energy is served inside the arrival window (−18 h to +24 h) and nowhere else. Pausable energy may split. Deferrable energy is served in a single hour (or relax that to a split if the trace blocks are smaller than 1 MW, and document it).
5. Sum of classes at a site-hour ≤ 100 MW.
6. Tank balance: `level[t] = level[t-1] + fill[t] - draw[t]`, `0 ≤ level ≤ tank_gallons`, `level` at the first hour starts full, `draw ≤` previous level, fill cannot exceed free capacity. Utility withdrawal = plant consumption − draw + fill, and withdrawal ≥ 0.
7. On warm hours, forced-dry share drives residual water and `extra_mw = 0.15 * IT_mw * y_dry_forced`. On grid-peak hours, `extra_mw ≤ G_peak`.
8. Delay is the positive part of (serve hour − arrival hour) times megawatts.

CBC is enough. `PuLP` with `PULP_CBC_CMD(timeLimit=15, msg=False)`. OR-Tools CBC is a drop-in if you prefer it. Do not take a paid solver.

### Flex event

There is no second URL. `flex_event: true` on `POST /v1/plan` multiplies the cap by `1 - flex_tighten` and solves again from scratch. The UI sends the same sliders with that boolean flipped. `meta.flex_event` echoes the request. `meta.cap_ratio_effective` is the ratio after the tighten.

### What the sample heuristic does, so you can beat it on purpose

`src/lib/model.ts` is the stand-in, not a specification of the optimum. It moves the flexible slice of each hour toward the coolest local or sister hour in the window, prefers the sister only when it is at least 0.05 L/kWh cooler than the best local hour, then dispatches the tank to minimise the daily peak (tank starts full), then forces dry cooling on the hottest non-peak hours until the cap holds. Your MILP should respect the same windows, the same toy curve in the contract test, and the same metric definitions. It should do better, or it should explain the penalty that stopped it.

## 6. Tests to write before you trust a chart

1. Toy plant on the bundled Des Moines temperatures matches 142,685 gallons on the peak day within 1%, and water is zero on 11 July 2025 (the day that stayed at or below 24.1°C).
2. Tank dispatch: daily consumption `[63664, 100212, 97549, 0, 10674, 28581, 72607]` with a 40,000 gallon tank that starts full has a minimum achievable peak near **78,880 gallons** (within 1%). A zero-gallon tank leaves the peak untouched.
3. `cap_gal` under a flex event is 30% lower than the same request with `flex_event: false`.
4. Optimized peak ≤ baseline peak, loads stay inside 0…100 MW, utility gallons are non-negative, and the hourly utility sums to the daily optimized total.
5. With the toy curve and swaps disabled, raising `flexible_share` from 0.10 to 0.30 does not raise the Des Moines scheduled peak on 8–14 July 2025.
6. API: `POST /v1/plan` for that week returns 200, `meta.sample` is false only when the MILP ran, and the error shape is used for an unknown `site_id` (404 or 422).
7. Historical-forecast fixture is parsed without the network. One optional integration test, marked and skipped by default, hits Open-Meteo.

Run `pytest` from `backend/`.

## 7. Deploy on Render

Save as `backend/render.yaml` and point the Blueprint at this repo, or create a Web Service by hand with the same settings.

```yaml
services:
  - type: web
    name: thirstcap-api
    runtime: python
    plan: free
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /v1/health
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.8
      - key: CORS_ORIGINS
        sync: false
      - key: WEB_CONCURRENCY
        value: "1"
```

- Bind to `0.0.0.0` and `$PORT`. Render’s proxy will not see a server bound to `127.0.0.1`.
- Set `CORS_ORIGINS` in the dashboard to the Vercel origin, for example `https://thirstcap.vercel.app`. No trailing slash. Several origins are comma-separated.
- The free instance sleeps after 15 minutes of quiet. The first request after sleep can take most of a minute. The frontend waits 90 seconds. Put that in the UI only if you want; the error path already surfaces a timeout.
- The filesystem is ephemeral. Cache weather in memory or refetch it. Do not store plans on local disk and expect them to survive a restart.
- One service for this API. The Next.js app stays on Vercel. Do not deploy both from the same Render service.

After the first successful deploy, open `https://<service>.onrender.com/v1/health`. Then, from the frontend directory:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://<service>.onrender.com
NEXT_PUBLIC_USE_MOCK=false
npm run dev
```

Run the Iowa week. The banner must switch from “Sample planner” to “Live optimizer”, and `meta.sample` in the network response must be false. If the solve fails, the page shows your `error.message` and does **not** silently fall back to the sample numbers.

## 8. Prompts to paste into Antigravity

Paste them in order. Each prompt assumes the previous one landed. Do not ask it to change frontend field names.

### Prompt 1 — scaffold

```
Create a Python 3.12 FastAPI app in backend/ of this repo, layout exactly as BACKEND.md section 1. Include requirements.txt (fastapi, uvicorn, pydantic, httpx, pulp, pandas, pytest, python-dotenv) inside backend/, not the repo root. app/main.py mounts CORS from the CORS_ORIGINS env var (default http://localhost:3000), allows GET, POST, OPTIONS, and headers Content-Type and Accept. GET /v1/health returns status ok, service thirstcap, version 1.0.0, sample false. Errors use {"error": {"code", "message", "details"}}. Add a pytest that hits /v1/health with TestClient. Do not implement the optimizer yet.
```

### Prompt 2 — weather and grid

```
Implement backend/app/services/weather.py and grid.py following BACKEND.md section 5. Fetch Open-Meteo archive and historical-forecast hourly temperature, relative humidity, and dew point for a site and its sister, in the site timezone, for an inclusive date range. Compute wet bulb with Stull’s formula as written in BACKEND.md. Record a fixture of the Des Moines archive for 2025-07-08 to 2025-07-14 (168 hours, max near 33.7°C) under backend/data/fixtures/ and test the parser against that file with the network disabled. Grid: EIA-930 hourly demand for MISO and AZPS, top 15% of hours flagged grid_peak. For Lahore and Karachi, use the documented afternoon sample shape and add the assumption string from BACKEND.md. No optimizer yet.
```

### Prompt 3 — cooling plant

```
Implement backend/app/services/plant.py with two functions, toy and physical, using the formulas, constants, and calibration anchors in BACKEND.md section 5 "Cooling plant". Toy WUE is 0 at or below 25°C, 1.8 L/kWh at 40°C, linear through and above 40°C. Gallons use 0.264172052358 L-to-gal. Forced dry cooling above 25°C costs +0.15 PUE on the switched megawatts and leaves 0.02 L/kWh residual. Below 25°C there is no penalty and no residual. Physical model: latent heat 2450 kJ/kg so litres per kWh of heat is 3600/2450, make-up = evaporation * CoC/(CoC-1) with CoC default 4, heat rejected ≈ IT_kWh * PUE_mode. Write the unit tests in BACKEND.md section 6 items 1 and 2, including the 142,685 gallon Des Moines peak on the bundled temperatures within 1%, and the tank peak near 78,880 gallons. Do not claim the physical model is calibrated until a multiplier is printed against the Iowa 0.19, evaporative 1.13–1.55, and Arizona >9 L/kWh anchors.
```

### Prompt 4 — workload

```
Implement backend/app/services/workload.py as specified in BACKEND.md. Download or read the Alibaba 2020 GPU cluster trace and aggregate to hourly fixed (<15 min), deferrable (15 min to 2 h), and pausable (>2 h) arrivals. Those cuts are assumptions and must be returned to the caller so they can go into meta.assumptions. Scale to a 70 MW mean and a 100 MW cap, then rescale so the flexible classes equal the requested flexible_share between 0.05 and 0.30 while fixed is the rest. If the trace file is absent, return a flat 70 MW profile and a flag that the result is a sample. Test the scaler: flexible energy / total energy equals the requested share within 0.1%, and no hour exceeds 100 MW.
```

### Prompt 5 — MILP and /v1/plan

```
Implement the rolling-horizon MILP in backend/app/services/optimizer.py exactly as BACKEND.md section 5 "Optimizer", using PuLP with CBC, time limit 15 seconds. Horizon 72 hours, commit 24 hours, stitch a week. Objective and constraints are the numbered list in that section, including the sister cap at 1.10 times the sister baseline peak and the tank that starts full. Weights λ1=0.15, λ2=0.25, λ3=0.05 live in config.py. POST /v1/plan must accept and return the JSON in BACKEND.md section 3 with those exact field names. cap_gal formula, cap_met rule, metric definitions, and lever waterfall are normative. flex_event multiplies the cap by (1 - flex_tighten) and resolves. If the cap cannot be met, return the best feasible plan with cap_met false and cap_shortfall_gal set. Set meta.sample false only when CBC produced the plan. Map a solver failure to the error object with code solver_error and HTTP 500. Add the API tests in section 6 items 3 through 6.
```

### Prompt 6 — sensitivity and Render

```
Implement POST /v1/sensitivity as specified in BACKEND.md section 4: swaps off, flexible shares 5% through 30% in 5% steps, requested tank, no binding cap, plus a perfect-foresight run and a historical-forecast run scored on archive actuals. swaps_included is the JSON boolean false. Cache by site, dates, and tank. Then add backend/render.yaml from BACKEND.md section 7, with rootDir backend, uvicorn bound to 0.0.0.0 and $PORT, health check /v1/health, and CORS_ORIGINS unset in the file (sync false) so the secret-free dashboard value is not overwritten. Run pytest and fix failures. Do not edit the Next.js app.
```

## 9. Frontend files that are the other half of this contract

- `src/lib/types.ts` — request and response types.
- `src/lib/api.ts` — `usingMock()`, `runPlan`, `runSensitivityCall`. Mock is on unless `NEXT_PUBLIC_API_URL` is set and `NEXT_PUBLIC_USE_MOCK` is not `"true"`.
- `src/lib/model.ts` — the sample planner you are replacing. Read it before changing a metric.
- `src/lib/sites.ts` — coordinates, weeks, and sister names.
- `src/data/weather.json` — the archive hours the contract test uses.
