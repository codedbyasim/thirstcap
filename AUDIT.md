# Data audit

Every number that used to be typed into the homepage has been traced. Figures on the site now come from a committed CBC run, the site registry, a cited dataset, or a labelled model constant. The sample planner in `src/lib/model.ts` still exists for `NEXT_PUBLIC_USE_MOCK=true` and is not used unless that flag is set.

## Fake or hardcoded items

| Where | What was wrong | Fix |
| --- | --- | --- |
| Hero simulator | Kept the previous plan on screen while a new site loaded, so Phoenix showed Dubai’s WRI 83, DEWA framework, $11.50/kgal, −45.4%, $6.94M, $4.28M–$17.13M, and 1,428 homes. The window stayed on Dubai’s 2026-07-20..26. A missing solve time fell back to `350 ms`. | The plan is cleared when the selection changes and is shown only when `meta.site_id` matches. WRI, framework, and tariff come from that plan, or from the selected registry row while it loads. Shield, EED, chart, ROI, capex, homes, and grid MW stay blank until that plan arrives. Peak mode requests the site preset (`phoenix` is 2026-07-13..19, `dubai` is 2026-07-20..26). Solve time renders only when `meta.solve_time_ms` is a number. |
| `src/data/benchmarks.ts` | Static “benchmark” curves. Several sites shared the same 45.4% / 1,428-home figures, and the hero used them as a fallback. | File deleted. The map cards and directory read the precomputed fleet row for that site. |
| Hero stat strip | `22%–45.4%`, `3.00 MGD`, `0.0 MW`, `10 Basins` were typed in. 22% is the no-drought cap (1 − 0.78) and 45.4% is the stage-2 cap (1 − 0.78 × 0.70). Showing them as one range mixed two scenarios. `0.0 MW` is not a field on the fleet response. | The strip reads `fleet_ui.json`: peak-cut min–max, `total_mgd_avoided`, `total_extra_mwh`, and `total_households_protected`, with the scenario note from that file. |
| CFO card | `+$6.94M / +$4.32M`, `$3.50M–$16.98M`, `$215K–$595K/yr`, `$100,000 (0.15 yr payback)`, `$0 / 0.0 MW`. The ROI pair happened to match an old Dubai/Phoenix solve; the tariff band and payback did not come from a response. | Dubai and Phoenix rows from the same fleet file: 5-year ROI, avoided capex low/high, and extra MWh. Tank steel stays labelled as the model constant $2.50/gal. The payback and the $0 grid claim are gone. |
| Permit card | “Grade A Qualified”, shield `94/100`, potable cut `−64.5%`, `9,986` homes, with one grade lit up. | Grade counts, shield, peak cut, and household total are counted from the fleet rows. −64.5% was a hand combination of the cap and the 35% reclaimed input and is not a response field, so it is gone. |
| Stakeholder tabs | `94/100`, `3.00 MGD`, `9,986` homes, `$4.32M`, “guaranteed”, “up to −58%”, “cryptographic-style”, “drop-in Slurm”. | The three metric tiles are computed from the fleet file. Copy now says the dispatch list is hints, the JSON signal is not certified OpenADR, and the EED letter is computed. |
| Commercial tiers and pilot modal | `$2,500/mo`, “Most Popular”, “Book Pilot”, “Generate Pilot Packet” set a local “submitted” flag and never sent anything. The brief used the benchmark file. | Tiers and the modal are removed. Those buttons are links to the control plane or to https://github.com/codedbyasim/thirstcap. |
| Architecture badges | `0 MWh Extra Power`, `0.15 yr Avg Payback`, `0 MW on Grid Peak`. | Replaced with the model window (−18h to +24h), the $2.50/gal constant, the 110% sister cap (`sister_cap_ratio`), and the constraint that swaps are blocked on grid-peak hours. |
| Nav | Badge always said “10 Basins”. Fixture count fell back to 56. Version fell back to 2.0.0. Solver fell back to “PuLP-CBC” before health returned. | Counts and version render only from `/v1/health`. 759,033 stays, with a note that it is `total_jobs_parsed` in the ingested Alibaba 2020 GPU profile. |
| World map | Hand-drawn continent polygon and projected dots, not latitude/longitude. | `react-leaflet` + CARTO `dark_all`, registry coordinates, WRI colors, sister arc from registry `sister_lat`/`sister_lon`. |
| Tank ROI and 10-city fleet | Spinners waited on 6 and 10 live MILPs. | Default requests return `backend/data/precomputed/*.json`. The UI paints that JSON immediately, then confirms with the API. Errors show a Retry button and the elapsed time. |
| Silent sample mode | Missing `NEXT_PUBLIC_API_URL` served the toy planner with no opt-in. | `usingMock()` is true only when `NEXT_PUBLIC_USE_MOCK=true`. |

## What is still a constant, and why

- **$10M–$40M per MGD.** Han, Li, Wierman, and Ren, “Small Bottle, Big Pipe” (2026). Used inside the API when it turns peak gallons into avoided capex. The homepage cites it and does not invent a second range.
- **$2.50 per gallon.** Tank build-cost constant in `plan.py` (`TANK_COST_USD_PER_GAL`). Labelled as a model input.
- **110% sister cap, −18h/+24h shift window, $85/MWh, CoC 4, 20% flexible share, cap ratio 0.78, drought tighten 0.30, 35% reclaimed.** Scenario inputs in `Settings` and the default plan request. The fleet note states the set that was solved.
- **759,033 jobs.** `backend/data/alibaba/gpu_2020_weekly_profile.json` field `total_jobs_parsed`, from the public Alibaba `cluster-trace-gpu-v2020`.
- **WRI score, stress tier, tariff, regulation text** on the ten corridors. Stored in `SITE_REGISTRY` and mirrored in `src/lib/sites.ts`. They are not a live WRI Aqueduct query.
- **Custom-city WRI and tariff.** `estimate_custom_basin_profile` is a regional estimate. The hero shows it only after `/v1/plan` returns it for that city.
- **45.4% on every default fleet row.** Real result of this scenario, not a pasted constant: stage-2 makes the cap `0.78 × 0.70 = 0.546` of baseline, and `cap_met` is true on all ten sites in `fleet_ui.json`. The no-drought file `fleet_schema.json` is a different run (mostly 22%).

## About the runs

`backend/scripts/precompute_sweeps.py` solved:

- `fleet_ui.json` — dashboard defaults (stage-2 drought and 35% reclaimed) on each site’s 2026 peak window.
- `fleet_schema.json` — API schema defaults (`flex_event` off, reclaimed 0), which is what the test client posts.
- `tanks.json` — six storage sizes for every registry site on that site’s default window, swaps off.

Weather for those files is the committed Open-Meteo archive fixture. Live 7-day fleet and tank requests with the same knobs return that run and set `data_source` to `precomputed_live_fallback`, because ten (or six) CBC solves plus a weather fetch do not fit the free-tier request budget. The note on the response says so.
