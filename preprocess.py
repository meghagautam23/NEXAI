"""Online Retail II -> public/data/*.json (Plan v2, Section 3).

Usage:  python preprocess.py [path/to/online_retail_II.xlsx]

Reads the "Year 2010-2011" sheet once and caches it as retail.parquet; later runs read the
cache in seconds. Writes products.json, orders.json and affinity.json, then prints a report
of how many rows each data rule removed (copy it into the README).

No ML here: "most frequently bought" is a count of order lines per product.
"""
import json, sys
from collections import Counter
from itertools import combinations
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "public" / "data"
CACHE = ROOT / "retail.parquet"
SHEET = "Year 2010-2011"

MONTH_START, CUT, MONTH_END = pd.Timestamp("2011-11-01"), pd.Timestamp("2011-11-22"), pd.Timestamp("2011-12-01")
TOP_N, AFFINITY_N = 100, 500
CODE = r"^\d{5}[A-Z]{0,2}$"  # five digits plus up to two letters; drops POST, DOT, M, BANK CHARGES, gift vouchers...

# --- Classifications (README, "Classifications") ---------------------------------------------
# Velocity ABC: by train-week pick rank within the top 100 (slotting convention): 20% A, 30% B, 50% C.
VELOCITY_SPLIT = (0.2, 0.5)
# Cost ABC: by train-week value moved (quantity x price), Pareto cut-offs at 80% and 95% of value.
COST_SPLIT = (0.8, 0.95)
# Weight FL01-FL07: the dataset has NO weights. Unit weight is ESTIMATED from the product description
# by the first matching keyword below (assumed typical giftware weights), then banded.
WEIGHT_BANDS = [(0.1, "FL01"), (0.25, "FL02"), (0.5, "FL03"), (1.0, "FL04"), (2.0, "FL05"), (4.0, "FL06")]
HEAVIEST = "FL07"  # 4 kg and over
DEFAULT_KG = 0.15
WEIGHT_RULES = [  # (keyword in upper-case description, estimated kg per unit); first match wins
    ("DOORMAT", 2.5), ("CAKESTAND", 2.2), ("TEA SET", 1.8), ("CAKE TINS", 1.2), ("BAKING SET", 0.9),
    ("SLATE", 0.8), ("WOODEN FRAME", 0.6), ("JELLY MOULDS", 0.6), ("RECIPE BOX", 0.5),
    ("ALARM CLOCK", 0.45), ("HOT WATER BOTTLE", 0.45), ("KNEELING PAD", 0.35), ("DOMINOES", 0.35),
    ("LARGE WHITE HEART OF WICKER", 0.35), ("HEART OF WICKER LARGE", 0.35), ("T-LIGHT", 0.3),
    ("NIGHT LIGHT", 0.3), ("ZINC", 0.3), ("GIANT", 0.2), ("CRACKERS", 0.15), ("WICKER", 0.15),
    ("SEWING KIT", 0.15), ("ROLL WRAP", 0.15), ("MINI LIGHTS", 0.15), ("NAUGHTS", 0.15),
    ("PICK UP STICKS", 0.15), ("KNITTING", 0.15), ("HAND WARMER", 0.12), ("JUMBO", 0.12),
    ("PAPER CHAIN", 0.1), ("CARD", 0.1), ("SNAP", 0.1), ("STOCKING", 0.1), ("LUNCH BAG", 0.08),
    ("BUNTING", 0.08), ("HARMONICA", 0.08), ("WOODEN", 0.08), ("CHARLOTTE BAG", 0.06),
    ("CAKE CASES", 0.05), ("NAPKINS", 0.05), ("PENCIL", 0.05), ("POPCORN", 0.05), ("RIBBONS", 0.05),
    ("DECORATION", 0.05), ("ORNAMENT", 0.03),
]


def estimate_weight(name: str) -> float:
    up = name.upper()
    return next((kg for key, kg in WEIGHT_RULES if key in up), DEFAULT_KG)


def weight_class(kg: float) -> str:
    return next((band for limit, band in WEIGHT_BANDS if kg < limit), HEAVIEST)


def abc_by_rank(n: int, i: int) -> str:
    a, b = VELOCITY_SPLIT
    return "A" if i < round(a * n) else "B" if i < round(b * n) else "C"


def abc_by_share(values: dict) -> dict:
    """Pareto ABC: classes by cumulative share of the total, largest first (ties by key)."""
    total, run, out = sum(values.values()), 0.0, {}
    for k, v in sorted(values.items(), key=lambda kv: (-kv[1], kv[0])):
        run += v
        out[k] = "A" if run <= COST_SPLIT[0] * total else "B" if run <= COST_SPLIT[1] * total else "C"
    return out


def load(xlsx: Path) -> pd.DataFrame:
    if CACHE.exists():
        return pd.read_parquet(CACHE)
    print(f"Reading {xlsx.name} (takes 1-2 minutes, cached afterwards) ...")
    df = pd.read_excel(xlsx, sheet_name=SHEET)
    # Invoice and StockCode mix ints and strings in the sheet; pyarrow needs one type per column
    for col in ("Invoice", "StockCode", "Description"):
        df[col] = df[col].astype("string")
    df.to_parquet(CACHE)
    return df


def clean(df: pd.DataFrame, report: dict) -> pd.DataFrame:
    """Section 3.1 data rules. Records rows removed by each rule in `report`."""
    def drop(mask, rule):
        report[rule] = int((~mask).sum())
        return df[mask]

    df = df.copy()
    report["rows in sheet"] = len(df)
    df["Invoice"] = df["Invoice"].astype("string").str.strip()
    df["StockCode"] = df["StockCode"].astype("string").str.upper().str.strip()  # 85049a == 85049A
    df = drop(~df["Invoice"].str.startswith("C"), "cancellation invoices (C...)")
    df = drop((df["Quantity"] > 0) & (df["Price"] > 0), "quantity or price <= 0")
    df = drop(df["StockCode"].str.match(CODE).fillna(False).astype(bool), "non-product codes")
    report["rows after cleaning"] = len(df)
    return df


def build(df: pd.DataFrame, report: dict):
    """Cleaned rows -> (products, orders, affinity). Deterministic: every sort has a tie-break."""
    df = df[(df["InvoiceDate"] >= MONTH_START) & (df["InvoiceDate"] < MONTH_END)]
    report["rows in November 2011"] = len(df)

    # One line per (invoice, product): the picker visits a slot once per order line
    df = df.assign(value=df["Quantity"] * df["Price"])
    lines = df.groupby(["Invoice", "StockCode"], as_index=False).agg(q=("Quantity", "sum"), value=("value", "sum"))
    inv_t = df.groupby("Invoice")["InvoiceDate"].min()
    lines["t"] = lines["Invoice"].map(inv_t)
    lines["train"] = lines["t"] < CUT
    report["order lines (invoice x product)"] = len(lines)

    # Pick frequency = number of order lines. Top 100 chosen on TRAIN weeks only.
    picks_train = lines[lines["train"]].groupby("StockCode").size()
    picks_month = lines.groupby("StockCode").size()
    ranked = sorted(picks_train.items(), key=lambda kv: (-kv[1], kv[0]))
    top = [code for code, _ in ranked[:TOP_N]]
    pid = {code: i for i, code in enumerate(top)}

    names = (df.dropna(subset=["Description"]).groupby("StockCode")["Description"].first()
               .str.strip().str.title())
    value_train = lines[lines["train"]].groupby("StockCode")["value"].sum()
    cost = abc_by_share({c: float(value_train[c]) for c in top})
    products = []
    for i, c in enumerate(top):
        name = str(names.get(c, "Unknown"))
        kg = estimate_weight(name)
        products.append({"id": i, "code": c, "name": name,
                         "picksTrain": int(picks_train[c]), "picksMonth": int(picks_month[c]),
                         "valueTrain": round(float(value_train[c]), 2),
                         "abcVelocity": abc_by_rank(len(top), i), "abcCost": cost[c],
                         "weightKg": kg, "weightClass": weight_class(kg)})

    kept = lines[lines["StockCode"].isin(pid)]
    report["order lines kept (top 100 only)"] = len(kept)
    report["share of November lines covered by top 100"] = f"{len(kept) / len(lines):.1%}"

    orders = {"train": [], "test": []}
    for (t, inv), g in kept.sort_values(["t", "Invoice"]).groupby(["t", "Invoice"], sort=False):
        ol = sorted(({"p": pid[c], "q": int(q)} for c, q in zip(g["StockCode"], g["q"])), key=lambda l: l["p"])
        orders["train" if t < CUT else "test"].append({"id": str(inv), "t": t.isoformat(), "lines": ol})

    # Affinity: how often two products share a TRAIN order
    pairs = Counter()
    for o in orders["train"]:
        pairs.update(combinations(sorted(l["p"] for l in o["lines"]), 2))
    affinity = [[a, b, n] for (a, b), n in sorted(pairs.items(), key=lambda kv: (-kv[1], kv[0]))[:AFFINITY_N]]
    return products, orders, affinity


def summary(orders) -> str:
    out = []
    for split, os_ in orders.items():
        n = pd.Series([len(o["lines"]) for o in os_])
        out.append(f"  {split:5s}: {len(os_):5d} orders, lines/order mean {n.mean():.1f}, "
                   f"median {n.median():.0f}, p90 {n.quantile(0.9):.0f}, max {n.max()}")
    return "\n".join(out)


def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "online_retail_II.xlsx"
    if not CACHE.exists() and not xlsx.exists():
        sys.exit(f"{xlsx} not found - run: python scripts/fetch_data.py")
    report = {}
    products, orders, affinity = build(clean(load(xlsx), report), report)

    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (("products", products), ("orders", orders), ("affinity", affinity)):
        path = OUT / f"{name}.json"
        path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
        report[f"{name}.json"] = f"{path.stat().st_size / 1024:.0f} KB"

    print("Data report")
    for k, v in report.items():
        print(f"  {k:45s} {v:>10,}" if isinstance(v, int) else f"  {k:45s} {v:>10}")
    print(summary(orders))
    print(f"  affinity pairs: {len(affinity)} (top pair seen together {affinity[0][2]} times)")


if __name__ == "__main__":
    main()
