# Development log

Team: Jayesh Pani, Megha Gautam, Meet Kumar · NEXAI 2026 Hackathon, Track 4, PS 4.2 (Warehouse Digital Twin).

Times are IST and come from the git history of this repository and of Megha's working repository
([meghagautam23/NEXAI](https://github.com/meghagautam23/NEXAI)), whose features were merged here.

## Timeline

### 21 October: planning (no code)

- Chose PS 4.2. Wrote an implementation plan (data, engine, 3D scene, game, optimiser, team split, 7-hour timeline).
- Reviewed the plan and found 14 problems before writing code. The important ones and their fixes:
  - the picker would walk through rack ends → cross-aisle centerlines moved 1.5 m clear of the racks (L = 15 m);
  - the optimiser would be tuned and scored on the same orders → **learn on 1–21 Nov, report on 22–30 Nov**;
  - full rescoring on the main thread would freeze the browser → per-order cache, incremental swap scoring and a
    Web Worker;
  - beating the baseline by hand from the messy layout was nearly impossible → Challenge mode starts from the
    Baseline with 10 swaps, with bought-together hints and a swap preview;
  - the animation and the score could pick different cross aisles → one `leg()` function returns both.
- Wrote plan v2 with these fixes.

### 22 October: building (two branches, then merged)

| Time | Who | What |
|---|---|---|
| 09:46–10:02 | Jayesh | Scaffold, CI/CD (lint, typecheck, tests, build, Vercel deploy with smoke test) |
| 10:23–10:33 | Jayesh | Data preprocessing, simulation engine and tests, AI Suggest worker, 3D scene, game, heatmap |
| 10:26–10:53 | Megha | Data pipeline with Python tests, engine with incremental scoring, 3D scene, game layer, heatmap and leaderboard |
| 10:45–12:25 | Jayesh | Start menu and points, three modules, categories, ABC classes, FL levels and time rules, product photos, aisle camera |
| 11:09–12:36 | Megha | ABC classes, explained AI Suggest with re-slotting cost and payback, batch picking, pitch kit, UI redesign, new-product slotting, peak-day rush |
| 13:34–13:48 | Jayesh | Merged Megha's work into the time-based engine; batch picking and a peak shift with several pickers and congestion; new-product slotting; pitch kit and Python tests |
| 15:32 | Megha | Fixed blank product cards on first, uncached page loads |

## Key decisions

- **Hold-out split everywhere.** The top 100 products, classes, bought-together pairs, the Baseline and the
  optimiser use 1–21 Nov only; every reported result is on 22–30 Nov. Players plan on the past and are scored on
  the hidden week too.
- **No machine-learning model.** Pick frequency is a count; AI Suggest is simulated annealing, a classical search.
  We chose rigour (hold-out, explanations) over adding a model the data (one month) could not support.
- **Bought-together placement is the main lever.** The textbook rule (fast movers nearest the dock) saves only about
  4%: an order-size breakdown showed it helps one-line orders a lot but not the large wholesale orders, which cross
  the floor anyway. Placing products bought together next to each other is what the optimiser exploits.
- **Re-slotting cost in the objective.** Each moved product costs the optimiser a set amount, so it prefers a compact
  set of moves; plans Max saving / Balanced / Fewer moves trade saving against effort, with a payback period.
- **Handling level from data.** FL0–7 comes from mean units per order line, not from guessed weights.
- **A fixed number of optimiser swaps** (not a time budget), so a run searches equally hard on any laptop.
- **Peak surge from real orders.** The busiest real day left one picker idle much of the time, so the peak scenario
  merges the 2 or 3 busiest test-week days at their real times of day.

## Experiments and rejected approaches

- **Changing the warehouse shape** (dock in the corner; 2, 5 or 10 aisles; 1 long aisle): the Baseline's gain stayed
  at 3–8% in every shape. Rejected; the order mix, not the layout, limits it.
- **More products** (top 200 to 500): bigger orders and a smaller Baseline gain. Kept the top 100.
- **Pruning moves after optimising:** undoing weak moves one by one unravelled the whole plan (moves depend on each
  other). Replaced by the move cost inside the objective.
- **Weights estimated from product names** (FL01–FL07 by keyword): replaced by the data-driven FL levels above.
- **Time-budgeted optimiser:** on a busy laptop it ran half as many swaps and found a weaker layout. Replaced by a fixed
  swap count with a time cap.
- **Ghost race** (a second picker replaying the old layout in the same scene): dropped as confusing and not asked for.

## AI assistance

Both developers used **Claude Code (Anthropic, model Claude Opus 5.5)** for planning, the plan review, code, tests,
data experiments, debugging and documentation. Commits it helped with carry a `Co-Authored-By: Claude Opus 5.5`
line. Examples of what it did, and what we checked:

- reviewed the first plan and found the issues listed above;
- wrote the engine, optimiser, scene and tests; every change went through lint, typecheck, the test suites and data
  validation in CI before deploying;
- ran the layout and optimiser experiments above and reported the numbers, including the ones that went against our
  hopes (the small Baseline gain, the failed pruning);
- found the blank product-card bug: each card's copy of the texture was not re-uploaded when its photo loaded late.
