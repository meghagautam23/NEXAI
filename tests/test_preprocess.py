"""Data rules (Plan v2, Section 3.1) on a tiny hand-made sheet. Run: python3 -m pytest -q tests
Ported from Megha Gautam's branch and extended for category, ABC class and FL."""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from preprocess import build, category, clean, fl  # noqa: E402

ROWS = [
    # Invoice, StockCode, Description, Quantity, InvoiceDate, Price
    ("1001", "85049a", "lights", 6, "2011-11-02 10:00", 1.0),        # lower-case code -> 85049A
    ("1001", "22086", "paper chain", 4, "2011-11-02 10:00", 2.0),
    ("1001", "22086", "paper chain", 2, "2011-11-02 10:00", 2.0),    # duplicate line -> merged, q = 6
    ("1001", "POST", "postage", 1, "2011-11-02 10:00", 18.0),         # non-product code
    ("C1002", "22086", "paper chain", -4, "2011-11-02 11:00", 2.0),   # cancellation
    ("1003", "22086", "paper chain", -1, "2011-11-03 09:00", 2.0),    # return
    ("1003", "23084", "night light", 1, "2011-11-03 09:00", 0.0),     # zero price
    ("1005", "23084", "night light", 1, "2011-10-30 09:00", 2.0),     # outside November
    ("1006", "23084", "night light", 30, "2011-11-21 23:59", 2.0),    # last train minute
    ("1004", "85049A", "lights", 1, "2011-11-23 12:00", 1.0),        # test week
    ("1004", "23084", "night light", 1, "2011-11-23 12:00", 2.0),
    ("1007", "99999", "test-only item", 1, "2011-11-22 00:00", 1.0),  # first test minute, unseen in train
]


def run():
    df = pd.DataFrame(ROWS, columns=["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price"])
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])
    report = {}
    return (*build(clean(df, report), report), report)


def test_cleaning_rules_remove_the_right_rows():
    *_, report = run()
    assert report["cancellation invoices (C...)"] == 1
    assert report["quantity or price <= 0"] == 2
    assert report["non-product codes"] == 1


def test_top_products_come_from_train_weeks_with_code_tie_break():
    products, *_ = run()
    assert [p["code"] for p in products] == ["22086", "23084", "85049A"]   # 1 train pick each -> by code
    assert "99999" not in {p["code"] for p in products}                    # test-only product never chosen


def test_orders_are_split_and_merged():
    products, orders, _, _ = run()
    assert [o["id"] for o in orders["train"]] == ["1001", "1006"]
    assert [o["id"] for o in orders["test"]] == ["1004"]   # 1007 had no top product -> dropped
    pid = {p["code"]: p["id"] for p in products}
    assert {l["p"]: l["q"] for l in orders["train"][0]["lines"]} == {pid["22086"]: 6, pid["85049A"]: 6}


def test_affinity_uses_train_weeks_only():
    products, _, affinity, _ = run()
    pid = {p["code"]: p["id"] for p in products}
    assert affinity == [[min(pid["22086"], pid["85049A"]), max(pid["22086"], pid["85049A"]), 1]]   # 1004 is test


def test_attributes_from_train_weeks():
    products, *_ = run()
    by = {p["code"]: p for p in products}
    assert by["23084"]["fl"] == 7                  # 30 units per line -> forklift
    assert by["22086"]["fl"] == 0                  # 6 units -> by hand
    assert by["23084"]["price"] == 2.0 and by["23084"]["valueTrain"] == 60.0
    assert [by[c]["abc"] for c in ("23084", "22086", "85049A")] == ["A", "B", "C"]   # value 60 > 12 > 6


def test_category_and_fl_rules():
    assert category("JUMBO BAG RED RETROSPOT") == "Bags & storage"
    assert category("HOT WATER BOTTLE KEEP CALM") == "Cosy & warm"
    assert category("SOMETHING ELSE") == "Gifts & gadgets"
    assert [fl(u) for u in (1, 6, 6.5, 22, 23)] == [0, 0, 1, 6, 7]
