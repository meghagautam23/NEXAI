"""Download Online Retail II from the UCI repository (Plan v2, Section 2).

Writes online_retail_II.xlsx to the repo root (git-ignored). Skips the download if it is
already there. Stdlib only.

Dataset: Online Retail II, UCI Machine Learning Repository, CC BY 4.0.
https://archive.ics.uci.edu/dataset/502/online+retail+ii
"""
import io, sys, urllib.request, zipfile
from pathlib import Path

URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
OUT = Path(__file__).resolve().parent.parent / "online_retail_II.xlsx"

if OUT.exists():
    print(f"{OUT.name} already present ({OUT.stat().st_size / 1e6:.1f} MB), skipping download")
    sys.exit(0)

print(f"Downloading {URL} ...")
with urllib.request.urlopen(URL, timeout=300) as r:
    blob = r.read()
print(f"Downloaded {len(blob) / 1e6:.1f} MB")

with zipfile.ZipFile(io.BytesIO(blob)) as z:
    name = next(n for n in z.namelist() if n.lower().endswith(".xlsx"))
    OUT.write_bytes(z.read(name))
print(f"Wrote {OUT.name} ({OUT.stat().st_size / 1e6:.1f} MB)")
