"""Online Retail II -> public/data JSON (Plan v2, Section 3), for Holly & Ivy Gifts.

Run from the project root with online_retail_II.xlsx present: python3 preprocess.py
The first run caches the sheet as retail.parquet. Functions are split out so tests/test_preprocess.py can run the
rules on a tiny hand-made sheet (approach ported from Megha Gautam's branch). Ties are broken by stock code, so
the output is deterministic.
"""
import json
import os
import re
from collections import Counter
from itertools import combinations

import pandas as pd

CUT = pd.Timestamp("2011-11-22")             # train = 1-21 Nov, test = 22-30 Nov
MONTH = (pd.Timestamp("2011-11-01"), pd.Timestamp("2011-12-01"))
TOP = 100

# Holly & Ivy Gifts is a UK gift and Christmas-decor wholesaler; categories come from the descriptions.
CATEGORIES = [  # first match wins (src/core/categories.ts has the same rules; a test keeps them in step)
    ("Cosy & warm",      r"HOT WATER BOTTLE|HAND WARMER"),
    ("Lights & candles", r"T-LIGHT|NIGHT LIGHT|LIGHTS|CANDLE|LANTERN"),
    ("Bags & storage",   r"\bBAG\b|SHOPPER|STORAGE"),
    ("Kitchen & baking", r"CAKE|BAKING|TEA SET|JELLY|RECIPE|POPCORN|PANTRY|MUG"),
    ("Party & paper",    r"PAPER CHAIN|WRAP|NAPKIN|BUNTING|RIBBON|CRACKER"),
    ("Christmas",        r"CHRISTMAS|SLEIGH|JINGLE|STOCKING|TREE|STAR|ANGEL"),
    ("Games & crafts",   r"GAME|CARDS|NAUGHTS|STICKS|KNITTING|DOMINOES|HARMONICA|PENCIL|SEWING|CRAFT"),
    ("Home & garden",    r"HEART|WICKER|FRAME|CLOCK|DOORMAT|CHALKBOARD|ORNAMENT|OWL|KNEELING|DECORATION"),
]
# Forklift/handling level from the mean units per order line: bigger loads need cases, pallets, then a forklift
FL_BANDS = [6, 8, 10, 12, 14, 17, 22]      # <=6 units -> FL0 (by hand) ... >22 units -> FL7 (forklift)


def category(name) -> str:
    n = str(name).upper()
    return next((c for c, rx in CATEGORIES if re.search(rx, n)), "Gifts & gadgets")


def fl(units: float) -> int:
    return next((i for i, b in enumerate(FL_BANDS) if units <= b), 7)


def load(xlsx="online_retail_II.xlsx", cache="retail.parquet") -> pd.DataFrame:
    if os.path.exists(cache):                # needs pyarrow
        return pd.read_parquet(cache)
    # Invoice, StockCode and Description mix numbers and text (e.g. "C536379"), so read them as text
    df = pd.read_excel(xlsx, sheet_name="Year 2010-2011",  # needs openpyxl
                       dtype={"Invoice": str, "StockCode": str, "Description": str})
    df.to_parquet(cache)
    return df


def clean(df: pd.DataFrame, report: dict) -> pd.DataFrame:
    """Section 3.1 rules; counts what each rule removes into `report`."""
    df = df.copy()
    df["Invoice"] = df["Invoice"].astype(str)
    df["StockCode"] = df["StockCode"].astype(str).str.upper().str.strip()
    keep = ~df["Invoice"].str.startswith("C")
    report["cancellation invoices (C...)"] = int((~keep).sum()); df = df[keep]
    keep = (df["Quantity"] > 0) & (df["Price"] > 0)
    report["quantity or price <= 0"] = int((~keep).sum()); df = df[keep]
    keep = df["StockCode"].str.match(r"^\d{5}[A-Z]{0,2}$")
    report["non-product codes"] = int((~keep).sum()); df = df[keep]
    return df


def build(df: pd.DataFrame, report: dict):
    """Clean rows -> (products, orders, affinity) for November 2011."""
    m = df[(df["InvoiceDate"] >= MONTH[0]) & (df["InvoiceDate"] < MONTH[1])]
    lines = m.groupby(["Invoice", "StockCode"], as_index=False).agg(
        q=("Quantity", "sum"), t=("InvoiceDate", "min"), name=("Description", "first"))
    train_lines = lines[lines["t"] < CUT]
    counts = train_lines.groupby("StockCode").size()
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))     # picks desc, then stock code
    top = [c for c, _ in ranked[:TOP]]   # top 100 chosen on TRAIN only
    picks = dict(ranked)

    lines = lines[lines["StockCode"].isin(top)]
    pid = {c: i for i, c in enumerate(top)}
    names = lines.groupby("StockCode")["name"].first()

    # Attributes from the learn weeks only: price, sales value, ABC class (by value rank), FL
    train_rows = m[(m["InvoiceDate"] < CUT) & (m["StockCode"].isin(top))]
    price = train_rows.groupby("StockCode")["Price"].median()
    value = (train_rows["Price"] * train_rows["Quantity"]).groupby(train_rows["StockCode"]).sum()
    units = train_lines[train_lines["StockCode"].isin(top)].groupby("StockCode")["q"].mean()
    by_value = sorted(top, key=lambda c: (-value[c], c))
    abc = {c: "A" if i < 0.2 * len(top) else "B" if i < 0.5 * len(top) else "C" for i, c in enumerate(by_value)}

    products = [{"id": pid[c], "code": c,
                 "name": str(names.get(c, "Unknown")).strip().title(),
                 "picksTrain": int(picks[c]),
                 "category": category(names.get(c, "")),
                 "price": round(float(price[c]), 2),
                 "valueTrain": round(float(value[c]), 2),
                 "abc": abc[c],
                 "fl": fl(float(units[c]))} for c in top]

    orders = []
    for inv, g in lines.sort_values(["t", "Invoice", "StockCode"]).groupby("Invoice", sort=False):
        orders.append({"id": inv, "t": g["t"].min().isoformat(),
                       "lines": [{"p": pid[c], "q": int(q)} for c, q in zip(g["StockCode"], g["q"])]})
    train = [o for o in orders if o["t"] < CUT.isoformat()]
    test = [o for o in orders if o["t"] >= CUT.isoformat()]

    pairs = Counter()                          # affinity from TRAIN only
    for o in train:
        pairs.update(combinations(sorted({l["p"] for l in o["lines"]}), 2))
    affinity = [[a, b, n] for (a, b), n in sorted(pairs.items(), key=lambda kv: (-kv[1], kv[0]))[:500]]
    report["orders"] = (len(train), len(test))
    return products, {"train": train, "test": test}, affinity


def main():
    report = {}
    products, orders, affinity = build(clean(load(), report), report)
    os.makedirs("public/data", exist_ok=True)
    json.dump(products, open("public/data/products.json", "w"))
    json.dump(orders, open("public/data/orders.json", "w"))
    json.dump(affinity, open("public/data/affinity.json", "w"))
    print(len(orders["train"]), "train orders,", len(orders["test"]), "test orders")
    print("removed:", {k: v for k, v in report.items() if k != "orders"})
    print("categories:", Counter(p["category"] for p in products).most_common())
    print("ABC:", sorted(Counter(p["abc"] for p in products).items()))
    print("FL:", sorted(Counter(p["fl"] for p in products).items()))


if __name__ == "__main__":
    main()
