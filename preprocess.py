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
    lines = df.groupby(["Invoice", "StockCode"], as_index=False).agg(q=("Quantity", "sum"))
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
    products = [{"id": i, "code": c, "name": str(names.get(c, "Unknown")),
                 "picksTrain": int(picks_train[c]), "picksMonth": int(picks_month[c])}
                for i, c in enumerate(top)]

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
