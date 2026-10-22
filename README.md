# Warehouse Digital Twin: 3D Picking Floor Game

A browser game that turns warehouse slotting into a puzzle. A 3D twin of a picking floor replays real
customer orders from November 2011. The player rearranges which product sits on which shelf, and the
twin replays exactly the same orders to measure how much walking was saved.

NEXAI 2026 Hackathon, Track 4, PS 4.2.

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

### Results so far

Both layouts obey the placement rules below (heavy items in the front bays).

| Layout | Week | Total distance | Mean / order | Median | p90 | Avg time / order |
|---|---|---:|---:|---:|---:|---:|
| Original | Test (735 orders) | 51,884 m | 70.6 m | 70.0 m | 111.4 m | 144.0 s |
| Baseline | Test (735 orders) | 49,597 m (−4.4%) | 67.5 m | 68.4 m | 113.8 m | 140.9 s |
| Original | Train (1,617 orders) | 113,524 m | 70.2 m | 70.0 m | 111.4 m | 141.9 s |
| Baseline | Train (1,617 orders) | 109,424 m (−3.6%) | 67.7 m | 67.6 m | 111.4 m | 139.4 s |

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
| **Challenge** (default) | Baseline | 10, undo refunds one | Hidden until you **Submit**; then win if you beat the Baseline |
| **Sandbox** | Original | Unlimited; **Load Baseline** available | Shown live |

The scoreboard lists Original, Baseline and Yours on all 735 test-week orders: total distance, mean,
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

- **Search:** simulated annealing over product swaps for 5 seconds (about 45,000 swaps), starting from the
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

Typical results over seeds (test week vs Baseline): *Max saving* −12% moving ~92 products; *Balanced*
−11% to −14% moving ~63; *Fewer moves* −6% to −9% moving ~30–43. One browser run (Balanced): **−11.6%**,
5,748 m less over 8 picking days, 62 moves, about 12 minutes of walking saved a day, 10.3 hours of
re-slotting, paid back in 52 picking days. Tested in `src/engine/optimizer.test.ts`.
