"""Validate public/data/*.json against Plan v2 (Sections 3.1 and 3.3).

Stdlib only, so CI needs no pip install. Exits 1 on any violation.
If none of the three files exist yet (before preprocess.py has run) it warns and exits 0.
"""
import json, re, sys
from collections import Counter
from datetime import datetime
from itertools import combinations
from pathlib import Path

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else "public/data")
FILES = ["products.json", "orders.json", "affinity.json"]
CODE = re.compile(r"^\d{5}[A-Z]{0,2}$")
KEYS = {"id", "code", "name", "picksTrain", "picksMonth", "valueTrain", "abcVelocity", "abcCost", "weightKg", "weightClass"}
WEIGHT_CLASSES = {f"FL0{k}" for k in range(1, 8)}
START, CUT, END = datetime(2011, 11, 1), datetime(2011, 11, 22), datetime(2011, 12, 1)
errors = []


def check(cond, msg):
    if not cond:
        errors.append(msg)
    return cond


present = [f for f in FILES if (DATA / f).exists()]
if not present:
    print(f"::warning::No data files in {DATA}/ yet - run preprocess.py and commit the JSON.")
    sys.exit(0)
for f in FILES:
    check(f in present, f"{f} is missing (all three files must be committed together)")
if errors:
    print("\n".join(errors)); sys.exit(1)

products = json.loads((DATA / "products.json").read_text())
orders = json.loads((DATA / "orders.json").read_text())
affinity = json.loads((DATA / "affinity.json").read_text())

# products.json: 100 entries, id = 0..99, ranked by train picks; keys in KEYS
check(isinstance(products, list) and len(products) == 100, "products.json must hold exactly 100 products")
for i, p in enumerate(products):
    check(set(p) == KEYS, f"product {i}: keys must be {sorted(KEYS)}")
    check(p.get("abcVelocity") == ("A" if i < 20 else "B" if i < 50 else "C"), f"product {i}: abcVelocity must follow rank 20/30/50")
    check(p.get("abcCost") in ("A", "B", "C"), f"product {i}: abcCost must be A, B or C")
    check(isinstance(p.get("valueTrain"), (int, float)) and p["valueTrain"] > 0, f"product {i}: valueTrain must be > 0")
    check(isinstance(p.get("weightKg"), (int, float)) and p["weightKg"] > 0, f"product {i}: weightKg must be > 0")
    check(p.get("weightClass") in WEIGHT_CLASSES, f"product {i}: weightClass must be FL01..FL07")
    check(p.get("id") == i, f"product {i}: id must equal its index (0..99)")
    check(isinstance(p.get("code"), str) and CODE.match(p["code"]), f"product {i}: bad StockCode {p.get('code')!r}")
    check(isinstance(p.get("name"), str), f"product {i}: name must be a string")
    check(isinstance(p.get("picksTrain"), int) and p["picksTrain"] > 0, f"product {i}: picksTrain must be a positive int")
    check(isinstance(p.get("picksMonth"), int) and p["picksMonth"] >= p.get("picksTrain", 0),
          f"product {i}: picksMonth must be an int >= picksTrain")
check(len({p.get("code") for p in products}) == len(products), "product codes must be unique")
picks = [p.get("picksTrain", 0) for p in products]
check(picks == sorted(picks, reverse=True), "products must be ordered by picksTrain, descending")

# orders.json: { train: Order[], test: Order[] }, Order = { id, t, lines: [{ p, q }] }
check(isinstance(orders, dict) and set(orders) == {"train", "test"}, "orders.json must be {train, test}")
seen = set()
for split, lo, hi in (("train", START, CUT), ("test", CUT, END)):
    check(len(orders.get(split, [])) > 0, f"orders.{split} is empty")
    for o in orders.get(split, []):
        oid = o.get("id")
        check(set(o) == {"id", "t", "lines"}, f"{split} order {oid}: keys must be id, t, lines")
        check(isinstance(oid, str) and not oid.startswith("C"), f"{split} order {oid}: cancelled invoice kept")
        check(oid not in seen, f"order {oid} appears twice (train/test overlap?)")
        seen.add(oid)
        try:
            t = datetime.fromisoformat(o["t"])
            check(lo <= t < hi, f"{split} order {oid}: t={o['t']} outside {lo:%d %b} - {hi:%d %b}")
        except (KeyError, TypeError, ValueError):
            errors.append(f"{split} order {oid}: t is not an ISO timestamp")
        lines = o.get("lines", [])
        check(len(lines) > 0, f"{split} order {oid}: empty orders must be dropped")
        ps = [l.get("p") for l in lines]
        check(len(ps) == len(set(ps)), f"{split} order {oid}: duplicate product lines (group by Invoice, StockCode)")
        for l in lines:
            check(isinstance(l.get("p"), int) and 0 <= l["p"] < 100, f"{split} order {oid}: p must be 0..99")
            check(isinstance(l.get("q"), int) and l["q"] > 0, f"{split} order {oid}: q must be a positive int")
    if errors:
        break

# Hold-out rule: top 100 and picksTrain come from the train weeks only
train = orders.get("train", [])
lines_per_p = Counter(l["p"] for o in train for l in o["lines"])
for p in products:
    if not check(lines_per_p[p["id"]] == p["picksTrain"],
                 f"product {p['id']}: picksTrain={p['picksTrain']} but train has {lines_per_p[p['id']]} lines"):
        break
month_lines = lines_per_p + Counter(l["p"] for o in orders.get("test", []) for l in o["lines"])
for p in products:
    if not check(month_lines[p["id"]] == p["picksMonth"],
                 f"product {p['id']}: picksMonth={p['picksMonth']} but the month has {month_lines[p['id']]} lines"):
        break

# affinity.json: [[a, b, n]], top 500 pairs, computed from TRAIN only
check(isinstance(affinity, list) and 0 < len(affinity) <= 500, "affinity.json must hold 1..500 pairs")
pairs = Counter()
for o in train:
    pairs.update(combinations(sorted({l["p"] for l in o["lines"]}), 2))
for row in affinity:
    if not check(isinstance(row, list) and len(row) == 3 and all(isinstance(v, int) for v in row),
                 f"affinity row {row!r} must be [a, b, n] ints"):
        break
    a, b, n = row
    check(0 <= a < b < 100, f"affinity row {row}: need 0 <= a < b < 100")
    if not check(pairs[(a, b)] == n, f"affinity row {row}: train co-occurrence is {pairs[(a, b)]} (affinity must use train only)"):
        break
ns = [r[2] for r in affinity if isinstance(r, list) and len(r) == 3]
check(ns == sorted(ns, reverse=True), "affinity rows must be ordered by count, descending")
check(len({(r[0], r[1]) for r in affinity}) == len(affinity), "affinity pairs must be unique")

if errors:
    print(f"{len(errors)} data problem(s):")
    print("\n".join(f"  - {e}" for e in errors[:50]))
    sys.exit(1)
print(f"Data OK: 100 products, {len(train)} train / {len(orders['test'])} test orders, {len(affinity)} affinity pairs")
