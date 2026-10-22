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
| `products.json` | `[{ id, code, name, picksTrain, picksMonth }]` | 100 products, `id` 0–99 in rank order |
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
0–99 (the dataset has no shelf positions). *Baseline* puts the products with most train-week picks in
the slots nearest the dock, ties broken by slot id and product id.

### Results so far

| Layout | Week | Total distance | Mean / order | Median | p90 | Avg time / order |
|---|---|---:|---:|---:|---:|---:|
| Original | Test (735 orders) | 51,844 m | 70.5 m | 70.0 m | 109.4 m | 144.0 s |
| Baseline | Test (735 orders) | 49,414 m (−4.7%) | 67.2 m | 64.2 m | 113.8 m | 140.7 s |
| Original | Train (1,617 orders) | 113,270 m | 70.0 m | 70.0 m | 109.4 m | 141.8 s |
| Baseline | Train (1,617 orders) | 109,772 m (−3.1%) | 67.9 m | 68.4 m | 111.4 m | 139.6 s |

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
