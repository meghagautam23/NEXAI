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
