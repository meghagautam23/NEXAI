"""Data rules (Plan v2, Section 3.1) on a tiny hand-made sheet. Run: pytest tests"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from preprocess import build, clean  # noqa: E402

ROWS = [
    # Invoice, StockCode, Description, Quantity, InvoiceDate, Price
    ("1001", "85049a", "lights", 6, "2011-11-02 10:00", 1.0),       # lower-case code -> 85049A
    ("1001", "22086", "paper chain", 4, "2011-11-02 10:00", 2.0),
    ("1001", "22086", "paper chain", 2, "2011-11-02 10:00", 2.0),   # duplicate line -> merged, q = 6
    ("1001", "POST", "postage", 1, "2011-11-02 10:00", 18.0),        # non-product code
    ("C1002", "22086", "paper chain", -4, "2011-11-02 11:00", 2.0),  # cancellation
    ("1003", "22086", "paper chain", -1, "2011-11-03 09:00", 2.0),   # return
    ("1003", "23084", "night light", 1, "2011-11-03 09:00", 0.0),    # zero price
    ("1005", "23084", "night light", 1, "2011-10-30 09:00", 2.0),    # outside November
    ("1006", "23084", "night light", 3, "2011-11-21 23:59", 2.0),    # last train minute
    ("1004", "85049A", "lights", 1, "2011-11-23 12:00", 1.0),       # test week
    ("1004", "23084", "night light", 1, "2011-11-23 12:00", 2.0),
    ("1007", "99999", "test-only item", 1, "2011-11-22 00:00", 1.0), # first test minute, product unseen in train
]


def sheet():
    df = pd.DataFrame(ROWS, columns=["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price"])
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])
    return df


def run():
    report = {}
    return (*build(clean(sheet(), report), report), report)


def test_cleaning_rules_remove_the_right_rows():
    *_, report = run()
    assert report["cancellation invoices (C...)"] == 1
    assert report["quantity or price <= 0"] == 2
    assert report["non-product codes"] == 1


def test_top_products_come_from_train_weeks_with_code_tie_break():
    products, *_ = run()
    assert [p["code"] for p in products] == ["22086", "23084", "85049A"]  # all 1 train pick -> by code
    assert "99999" not in {p["code"] for p in products}                  # test-only product never chosen
    assert {p["code"]: p["picksMonth"] for p in products} == {"22086": 1, "23084": 2, "85049A": 2}


def test_orders_are_split_and_merged():
    products, orders, _, _ = run()
    assert [o["id"] for o in orders["train"]] == ["1001", "1006"]
    assert [o["id"] for o in orders["test"]] == ["1004"]   # 1007 had no top-100 product -> dropped
    pid = {p["code"]: p["id"] for p in products}
    first = {l["p"]: l["q"] for l in orders["train"][0]["lines"]}
    assert first == {pid["22086"]: 6, pid["85049A"]: 6}


def test_affinity_uses_train_orders_only():
    products, _, affinity, _ = run()
    pid = {p["code"]: p["id"] for p in products}
    assert affinity == [[pid["22086"], pid["85049A"], 1]]  # the 23084 + 85049A pair is test-only


def test_build_is_deterministic():
    assert run()[:3] == run()[:3]
