# Warehouse Digital Twin: 3D Picking Floor Game

A browser game that turns warehouse slotting into a puzzle. A 3D twin of a picking floor replays real
customer orders from November 2011. The player rearranges which product sits on which shelf, and the
twin replays exactly the same orders to measure how much walking was saved: **measured, not claimed**.

NEXAI 2026 Hackathon, Track 4, PS 4.2 · Online Retail II (UCI, CC BY 4.0) · React Three Fiber · no backend.

## Results

All numbers are walking distance over **all 735 orders of the test week (22–30 Nov 2011)**, which no
layout or optimizer saw while being built: the Baseline ranks products and AI Suggest learns on
1–21 Nov only. Every layout obeys the placement rules (heavy items in the front bays).

| Layout | Single-order picking | 4-order carts, first come | 4-order carts, proximity |
|---|---:|---:|---:|
| Original (assumed "as received") | 51,884 m | 24,292 m (−53.2%) | 20,642 m (−60.2%) |
| Baseline (fast movers nearest the dock) | 49,597 m (−4.4%) | 24,015 m (−53.7%) | 20,025 m (−61.4%) |
| **AI Suggest** (Balanced, seed 1) | **43,233 m (−16.7%)** | 22,870 m (−55.9%) | **18,272 m (−64.8%)** |

Percentages are against Original with single-order picking. Average time per order (walking at 1 m/s
plus 10 s per line) goes from 2:24 (Original, single) to 1:38 (AI layout, proximity carts).

- **The textbook rule barely helps here.** Fast movers nearest the dock saves 4.4%: this retailer serves
  wholesalers, and big orders send the picker across the whole floor anyway (it saves about a fifth on
  one-line orders but nothing on orders of 16+ lines).
- **Bought-together placement does.** AI Suggest puts products that are ordered together next to each
  other: **−12.8% vs Baseline** on the unseen week, re-slotting 67 of 100 products, paid back in about
  51 picking days (at £15/hour and 10 minutes per move, both editable).
- **Batching is the biggest lever, and slotting still adds to it.** Four-order proximity carts cut walking
  by about 60%; with the AI layout the carts walk another 8.8% less than with the Baseline.
- **Distribution, not just the mean.** Per order, AI vs Baseline: mean 58.8 m vs 67.5 m, median
  54.6 m vs 68.4 m, p90 104.2 m vs 113.8 m.

## Contents

[Run locally](#run-locally) · [Data](#data) · [Warehouse layout](#warehouse-layout) ·
[Simulation engine](#simulation-engine) · [3D scene](#3d-scene) · [Game](#game) ·
[Classifications](#classifications) · [AI Suggest](#ai-suggest) · [Batch picking](#batch-picking) ·
[Testing and CI](#testing-and-ci) · [Assumptions and limitations](#assumptions-and-limitations) ·
[Pitch and demo script](docs/PITCH.md)

## Run locally

Needs Node 24 (`nvm use`) and Python 3.10+.

```bash
npm ci
npm run dev          # the game
npm test             # simulation engine tests
```

Rebuild the data (only needed if the pipeline changes; the JSON is committed):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm run data:fetch   # downloads Online Retail II from UCI (~46 MB, git-ignored)
npm run data         # preprocess.py, then scripts/validate_data.py
npm run test:data    # data rules on a small hand-made sheet
```

The first `npm run data` reads the Excel file (about 15 s) and caches it as `retail.parquet`; later runs
take about 2 s. Output is deterministic: rerunning gives byte-identical files.

## Data

**Source:** Online Retail II, UCI Machine Learning Repository, CC BY 4.0
(<https://archive.ics.uci.edu/dataset/502/online+retail+ii>), sheet "Year 2010-2011". Real order lines
from a UK online gift retailer: invoice, product code, quantity, timestamp, price.

### Rules

| Rule | Rows removed |
|---|---:|
| Rows in the sheet | 541,910 |
| Cancellation invoices (number starts with "C") | 9,288 |
| Quantity ≤ 0 or price ≤ 0 (returns, adjustments) | 2,517 |
| Non-product codes (POST, DOT, M, BANK CHARGES, AMAZONFEE, gift vouchers...): only codes of five digits plus up to two letters are kept | 2,380 |
| **Rows after cleaning** | **527,725** |

- Stock codes are upper-cased and trimmed, so `85049a` and `85049A` are the same product.
- An invoice that was later cancelled still counts as picks: the goods were picked before the return.
  Only the "C" cancellation records themselves are removed.
- **Month:** November 2011 (83,091 rows → 80,378 order lines after merging repeated lines of the same
  product on one invoice).
- **Train / test split:** train = 1–21 November, test = 22–30 November, by invoice time. The optimizer and
  all statistics it uses are computed on train only; headline results are reported on test.
- **Top 100 products** by pick frequency in the **train weeks only**. Pick frequency is the number of
  order lines (the picker visits a shelf once per line, whatever the quantity). Ties are broken by stock
  code. No ML is involved: it is a count.
- Lines for other products are dropped, then orders left empty. The top 100 cover 21.1% of November's
  order lines.
- Large wholesale orders are kept. Order size is skewed (median 5 lines, p90 15, max 76), so results
  report median and p90 distance alongside the mean.

### Output (`public/data/`)

| File | Shape | Contents |
|---|---|---|
| `products.json` | `[{ id, code, name, picksTrain, picksMonth, valueTrain, abcVelocity, abcCost, weightKg, weightClass }]` | 100 products, `id` 0–99 in rank order; classifications below |
| `orders.json` | `{ train: Order[], test: Order[] }`, `Order = { id, t, lines: [{ p, q }] }` | 1,617 train and 735 test orders |
| `affinity.json` | `[[a, b, n]]` | Top 500 product pairs by how many train orders contain both |

`scripts/validate_data.py` checks every rule above and runs in CI and against each deployment.

## Warehouse layout

| Parameter | Value |
|---|---|
| Aisles | 5 vertical aisles, 3 m wide, centerlines 5 m apart (x = 0, 5, 10, 15, 20) |
| Racks | Both sides of every aisle, 1 m deep |
| Slots | 10 bays per side × 2 sides × 5 aisles = 100 slots |
| Rack span | y = 1.5 m to 13.5 m (bay length 1.2 m) |
| Pick point | y = 2.1 + 1.2 × bay, on the aisle centerline; left and right slots of a bay share it |
| Cross aisles | Front centerline y = 0, back centerline y = 15 |
| Dock | (10, 0), on the front cross aisle in line with the middle aisle |
| Walking speed | 1.0 m/s |
| Pick time | 10 s per order line |
| Picking policy | One trip per order: dock → slots → dock, nearest slot next |

Walking follows aisle and cross-aisle centerlines only, never through racks (`src/engine/geometry.ts`).

## Simulation engine

`src/engine/` holds pure TypeScript with no 3D code, tested with Vitest.

| File | Contents |
|---|---|
| `geometry.ts` | Slot coordinates, `leg()` (distance and waypoints of one move), the 101 × 101 distance table `D` |
| `sim.ts` | `routeOrder()` (route for animation), `routeLength()` (fast distance), `scoreLayout()`, `makeEngine()` |
| `layouts.ts` | `originalLayout()`, `baselineLayout()`, `samePickPoint()` |
| `data.ts` | JSON types, `loadData()` for the browser, `partnersOf()` for bought-together hints |

A layout is `assign: number[]`, mapping product id → slot id. `makeEngine(orders, assign)` caches each
order's distance; `swapDelta(p1, p2)` rescores only the orders containing either product and returns the
change plus `commit()`, without touching the layout until committed (about 7,800 swaps per second on the
train orders). `stats()` returns total, mean, median and p90 distance per order, and average time per
order (walking at 1 m/s plus 10 s per line).

**Layouts.** *Original* is an assumed "as received" layout: products in stock-code order fill slots
0–99 (the dataset has no shelf positions), then any heavy item outside the front bays trades places
with a light item there. *Baseline* puts the products with most train-week picks in the slots nearest
the dock, within the placement rules: heavy items first take the nearest front slot of their ABC zone,
then every other product takes the nearest free slot of its zone. Ties are broken by slot id and
product id.

## 3D scene

React Three Fiber (`src/scene/`), with a small HUD (`src/ui/Hud.tsx`) and shared state in zustand (`src/store.ts`).

- **Racks:** the 100 bays are one `InstancedMesh` (one draw call). Shade shows how often the product in a
  bay was picked in the train weeks (darker blue = more); orange bays are still to pick in the current
  order, green ones are picked.
- **Picker:** a capsule with a head, walking at 1 m/s of simulated time and pausing 10 s at each pick.
  Its path comes from `src/engine/replay.ts`, which builds the walk only from `leg()` waypoints, so the
  animated distance equals the scored distance (tested). The current order's route is drawn as a dashed line.
- **Replay:** 25 evenly spaced sample orders from the test week, at 1×, 10× or 50×. The HUD labels the
  replay sample and the score (all test-week orders) separately.
- **Symbols:** every bay shows its product's family on top (`src/engine/categories.ts`: 17 families from
  the descriptions, e.g. 👜 bags ×20, 🎄 Christmas decorations ×13, 🧁 baking ×10, ♨️ hot water bottles ×8),
  so you can see at a glance which kinds of products sit together. They move with their products when
  you swap, and can be hidden with **Symbols** in the top bar.
- **Performance:** no shadows, pixel ratio capped at 1.5, labels painted onto textures (no font download).

## Game

Click a rack bay to select it (purple), then click another to swap their products. While a bay is
selected:

- purple arcs link it to the three products most often bought together with it (train weeks);
- hovering another bay previews the change in walking distance over the train weeks;
- the bay across the aisle is greyed out: it shares the pick point, so swapping with it changes nothing
  ("No change: same pick point", no swap used).

A click that ends a camera drag never counts as a selection. **Esc** deselects, **Ctrl/⌘+Z** undoes a swap.

**Planning on the past, scored on the future.** Swap previews and the "Past 3 weeks vs Baseline" figure
use the train weeks (1–21 Nov). The score is the test week (22–30 Nov), the same hold-out the optimizer
uses.

| Mode | Starts from | Swaps | Test-week score |
|---|---|---|---|
| **Challenge** (default) | Baseline | 10, undo refunds one | Hidden until you **Submit**; then 1–3 stars: ★ beat the Baseline, ★★ by 1%, ★★★ by 2.5% or beat AI Suggest's layout |
| **Sandbox** | Original | Unlimited; **Load Baseline** available | Shown live |

The scoreboard lists Original, Baseline, Yours and AI Suggest on all 735 test-week orders: total distance, mean,
median and p90 distance per order, average time per order and change vs Original. Game rules are tested
in `src/store.test.ts`.

### Heatmap and leaderboard

- **Visit heatmap** (Racks → Visit heatmap): racks are coloured by how many times the picker has
  picked from them in the current replay, grey (never) through yellow to red (busiest). It resets when the
  replay restarts or the layout changes, so you can watch traffic build up order by order, and compare
  how concentrated it is under different layouts.
- **Leaderboard:** after submitting a Challenge, enter a name and save. Entries are ranked by test-week
  walking distance and keep the layout, so **Load** reopens it in Sandbox. They are stored in
  `localStorage`, so they belong to **this browser only** (no server); if storage is blocked the game
  still works and keeps the result for the visit. Logic and storage failures are tested in
  `src/leaderboard.test.ts`.

## Classifications

Industry inventories classify items several ways. The problem statement asks us to arrange by **pick
frequency**, so that classification drives the layout; the others are shown, and weight adds one
placement rule. All three are computed in `preprocess.py` and stored in `products.json`.

| Classification | How it is computed | Used for |
|---|---|---|
| **ABC by frequency** (`abcVelocity`) | Train-week pick rank within the top 100: top 20% **A**, next 30% **B**, last 50% **C** (slotting convention; Pareto 80/95% cut-offs would make 72 of 100 items A, because pick counts are fairly even) | **Slotting.** The 20 slots nearest the dock are zone A, the next 30 zone B, the last 50 zone C. Baseline fills each zone with its class. In Challenge, *Keep ABC zones* makes it a rule. |
| **ABC by cost** (`abcCost`) | Train-week value moved (quantity × price), Pareto: classes cover the first 80%, next 15%, last 5% of value. A 54, B 28, C 18 | **Display only.** In industry this sets cycle-count frequency and security, not walking distance. It disagrees with frequency: 9 class-A fast movers are class C by cost (cheap items picked often), so arranging by cost would push them away from the dock. |
| **Weight FL01–FL07** (`weightClass`, `weightKg`) | **Estimated.** The dataset has no weights: `weightKg` is a typical unit weight from the first matching keyword in the description (`WEIGHT_RULES`, e.g. doormat 2.5 kg, 3-tier cakestand 2.2 kg, hot water bottle 0.45 kg; 0.15 kg if nothing matches), banded as FL01 < 0.1 kg, FL02 < 0.25, FL03 < 0.5, FL04 < 1, FL05 < 2, FL06 < 4, FL07 ≥ 4 kg. Replace with real weights when available. | **One placement rule.** |

**Placement rules** (`src/engine/rules.ts`), enforced for the built-in layouts, every swap and the
optimizer:

1. **Heavy items front only.** Items of class FL05 and above (≥ 1 kg estimated; 5 products) may only be
   in the front 3 bays of an aisle, nearest the front cross aisle, so heavy loads are carried the
   shortest way. Racks have one level here, so the usual "heavy items low" rule does not apply.
   The threshold is FL05 because only 2 of these giftware items reach FL06.
2. **ABC zones** (optional, Challenge only). Each product stays in its velocity zone. Heavy items are
   exempt: safety comes first.

A refused swap shows the reason and does not use a swap. Rack colours can show each classification,
with the ABC zones or the heavy zone marked on the floor.

## AI Suggest

`src/engine/optimizer.ts`, run in a Web Worker (`optimizer.worker.ts`) so the scene never freezes.

- **Search:** simulated annealing over 45,000 product swaps (a few seconds; a 15-second cap guards slow machines), starting from the
  Baseline. 70% of proposals move a product next to one of its top-5 bought-together partners; the rest
  are random. Temperature falls from 25 m to 0.3 m. Every proposal is checked against the placement
  rules (heavy items front; ABC zones if on).
- **Hold-out:** it scores layouts on the **train weeks only** (1–21 Nov). The result is then scored on the
  **test week** (22–30 Nov), which it never saw. That is the number on the scoreboard.
- **Re-slotting aware:** each product moved costs a set number of train-week metres in the objective, so
  the search prefers a compact set of moves. Plans: *Max saving* (0 m per move), *Balanced* (100 m,
  default), *Fewer moves* (200 m). Afterwards, any move that can be undone without lengthening the walk is
  undone.
- **Explained moves:** for every moved product, the walking that undoing that move alone would add, and the
  bought-together partner it was moved towards ("Now 1.2 m from Hot Water Bottle I Am So Poorly (was
  16.6 m): bought together in 53 orders").
- **Business case:** test-week saving ÷ 8 picking days, at 1 m/s, gives hours per day; × picking days per
  year × picker cost gives £ per year; moved products × minutes per move gives the re-slotting effort and
  payback period. The assumptions (default £15/hour, 10 minutes per move, 250 days a year) are editable in
  the card. It covers walking time in the 100-product zone modelled here, not the whole catalogue.

Reference runs (45,000 swaps, seeds 1–3, test week vs Baseline): *Max saving* −11.2% to −12.8% moving
93 products; *Balanced* −12.3% to −13.2% moving 59–67; *Fewer moves* −7.6% to −9.5% moving 36–48.
Limiting moves does not cost much on the unseen week: it also stops the search overfitting the train
weeks. A browser run uses a random seed, so its numbers vary slightly. Tested in
`src/engine/optimizer.test.ts`.

## Peak-day rush

**⏱ Peak rush** in the top bar (`src/engine/rush.ts`). One shift against a courier cut-off, with real
orders arriving at their real invoice times.

- **Volume:** the busiest day of the test week (Tue 22 Nov, 119 orders, the busiest of the month), or a
  Christmas-peak surge: the orders of the 2 or 3 busiest test-week days merged into one shift at their real
  times of day (225 or 329 real orders).
- **Shift:** pickers start at 08:00. Each free picker takes the oldest waiting order, or a cart of waiting
  orders (the oldest, then those adding the least walking), walks, picks at 10 s a line and packs at 90 s an
  order. An order ships **on time** if it is packed by the cut-off (15:00, 16:00 or 17:00); orders arriving
  after the cut-off ship tomorrow and are not counted.
- **Score:** share of orders shipped on time, with stars (★ 80%, ★★ 90%, ★★★ 97%), compared for every
  layout, plus the last order packed and the average wait. Staff cost per shift is shown for the chosen
  number of pickers.
- **Watch it:** the whole shift replays in 3D in about two minutes at 300×: each picker in its own colour,
  orange racks for the running trips, and a shift clock with arrived, waiting, shipped, on-time, missed
  and next-day counters.

Peak ×3 (329 orders), cut-off 17:00:

| Pickers, cart | Original | Baseline | AI Suggest |
|---|---:|---:|---:|
| 1, single orders | 47% | 47% | 50% |
| 2, single orders | 82% | 83% | 86% |
| 2, carts of 4 | 93% | 93% | 94% |

A second picker doubles throughput; carts and a better layout then close most of the remaining gap
without a third. Tested in `src/engine/rush.test.ts`.

## New products (cold start)

**+ New item** in the top bar. A new product has no pick history, so neither the Baseline nor AI Suggest
can place it. `src/engine/newItem.ts` does what slotting teams do for a new SKU:

1. **Look-alikes.** Product names carry collection and type words ("Jumbo Bag … Retrospot", "Hot Water
   Bottle …"), and customers buy within collections. The three most similar products (shared words, plus
   the same family) predict its picks per three weeks, its velocity class, and which orders it joins.
   Weight class is estimated from the name with the same rules as the pipeline, or set by hand.
2. **Make room.** The floor is full, so the slowest mover goes to reserve storage.
3. **Test every slot.** Starting from the current layout, the new item is tried in every allowed slot
   (heavy items front only) with the real simulator on the train weeks; a slot other than the freed one
   moves its product into the freed slot. The best three are recommended with the walking saved per day
   and the nearest look-alike.
4. **Place it.** This loads a what-if copy of the warehouse in Sandbox: the retired product's lines are
   removed, the new item joins the orders its look-alikes are in (train and test weeks), velocity classes
   and bought-together pairs are recomputed. Scoreboard, AI Suggest and batch picking all include it.
   **Back to real data** restores the real warehouse; what-if results are not saved to the leaderboard.

Example: *Jumbo Bag Woodland Animals* looks like Jumbo Bag Alphabet, Apples and 50'S Christmas, so expect
about 113 picks in three weeks (class B). Hand Warmer Red Retrospot (80 picks) goes to reserve. The best
slot sits 2.4 m from Jumbo Bag Apples and walks about 48 m a day less than simply using the freed slot.
Tested in `src/engine/newItem.test.ts`.

## Batch picking

`src/engine/batching.ts`, shown in the **Batch picking** panel. One trip serves several orders on a
cart: the picker visits every slot of the batch once (nearest-neighbour route as usual) and sorts the
orders at the dock.

- **Cart:** 2–5 orders and at most 40 lines (editable). An order bigger than the cart goes on its own.
  Batches never span picking days (each day is one wave).
- **First come:** orders join the cart in arrival order.
- **Proximity** (seed batching): the earliest waiting order seeds a cart; then the waiting order that
  adds the least walking joins, until the cart is full. It depends on the layout, so it rewards good
  slotting.

Test week, Baseline layout (single-order picking: 49,597 m, 735 trips):

| Cart | First come | Proximity |
|---|---:|---:|
| 2 orders | 35,681 m (−28.1%) | 31,208 m (−37.1%) |
| 3 orders | 28,199 m (−43.1%) | 23,908 m (−51.8%) |
| **4 orders** | 24,015 m (−51.6%) | **20,025 m (−59.6%), 213 trips** |
| 5 orders | 21,598 m (−56.5%) | 18,272 m (−63.2%) |

Average time per order falls from 2:20 to 1:40 with 4-order proximity carts. Batching saves far more
walking than slotting alone, and the two add up: the panel compares every layout (Original, Baseline,
Yours, AI Suggest) under each policy. Sorting time at the dock is not included. Tick **Replay batches in
3D** to watch the picker walk 10 sample carts. Tested in `src/engine/batching.test.ts`.

## Testing and CI

- **61 TypeScript tests** (Vitest): geometry never cuts through racks; the animation walks exactly the
  scored distance; incremental swap scoring equals a full rescore; layouts obey the rules; game rules
  (swaps, limits, undo, submit, zones); leaderboard storage failures; optimizer rules, determinism and
  hold-out; move explanations; business-case maths; batching limits and savings.
- **6 Python tests** (pytest) on a hand-made sheet: every cleaning rule, the split, the train-only top 100
  and affinity, the classification cut-offs and weight bands.
- `scripts/validate_data.py` checks the committed JSON against every data rule.
- **CI** (`.github/workflows/ci-cd.yml`): data checks, lint, typecheck, tests and build on every push and
  pull request. The Vercel deploy job needs `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
  repository secrets; without them it is skipped with a notice and the run still passes.

## Assumptions and limitations

- **Layout.** The dataset has no shelf positions: the warehouse (100 slots, 5 aisles) and the *Original*
  layout (stock-code order) are our assumptions.
- **Scope.** The top 100 products cover 21% of November's order lines; results describe this 100-product
  pick zone, about 92 orders a day, not the whole catalogue. The £ figures scale with the zone.
- **Weights are estimated** from product descriptions (`WEIGHT_RULES` in `preprocess.py`); replace them
  with real weights or your FL definitions when available.
- **Routing** is nearest-neighbour along aisle centerlines, the same for every layout. Racks have one
  level. Walking is 1 m/s and picking 10 s per line for every layout, so only walking differs.
- **Batch picking** excludes sorting time at the dock.
- **Business case** counts walking time only; cost per hour, minutes per move and days per year are
  assumptions shown and editable in the AI Suggest card.
- **Leaderboard** is stored in the browser (`localStorage`), so it belongs to one browser.
