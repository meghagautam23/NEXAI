# Pitch: slides outline, 2-minute demo script, Q&A

All numbers come from the README's [Results](../README.md#results): test week 22–30 Nov 2011, 735 orders,
which no layout or optimizer saw while being built.

## Slides outline (10 slides, ~4 minutes if presented without the live demo)

| # | Slide | On the slide | Say |
|---|---|---|---|
| 1 | **Title** | "Warehouse Digital Twin: slotting as a game, measured on real orders". Screenshot of the 3D floor. Team names. | "We built a digital twin that replays real orders, so every layout change is measured, not claimed." |
| 2 | **The problem** | Pickers spend more time walking than picking. Where a product sits decides the walk. | "Slotting is a decision warehouses make once and live with for months. We make it testable." |
| 3 | **Real data, honest split** | Online Retail II, November 2011. Cleaning table (541,910 rows → 527,725). Train 1–21 Nov / test 22–30 Nov. Top 100 products by pick frequency. | "Everything is tuned on three weeks and scored on the fourth, which it never saw." |
| 4 | **The twin** | 3D screenshot with route line; walking only along aisles; 100 slots, dock, 1 m/s, 10 s per pick. | "The animated walk and the score come from one function, and a test proves they match." |
| 5 | **Surprise: the textbook rule barely helps** | Original 51,309 m → Baseline 49,038 m (−4.4%). Order-size breakdown: a fifth saved on 1-line orders, nothing on 16+ lines. | "This retailer serves wholesalers. Big orders cross the whole floor whatever you do with fast movers." |
| 6 | **AI Suggest: put together what is bought together** | −9% to −13% vs Baseline on the unseen week. One explained move ("Now 1.2 m from Hot Water Bottle I Am So Poorly, was 16.6 m: bought together in 53 orders"). 45,000 swaps in a few seconds, in the browser. | "It explains every move, and it never sees the week it is scored on." |
| 7 | **It pays for itself** | ~60 products to move, ~10 h of re-slotting, payback ~2 months of picking days (Fewer moves: ~35 products, ~6 h). Plans: Max saving / Balanced / Fewer moves. | "Real warehouses don't move everything. Our optimizer charges for every move, so it picks the moves that pay." |
| 8 | **Batching: the biggest lever** | Table: single vs 4-order carts. Proximity carts −60%; AI layout + proximity carts −63.2% vs Original. | "Batching cuts trips; slotting cuts each trip. They add up: with our layout the carts walk another 7% less." |
| 9 | **Industry rules built in** | ABC by frequency (drives zones), ABC by cost (display: 9 fast movers are cost class C), FL0–FL7 handling level from real units per order line (bulk FL6–7 items front bays only). | "We arrange by frequency as the brief asks, and respect safety rules a real WMS would enforce." |
| 10 | **Rigour and next steps** | 82 + 7 automated tests; deterministic data pipeline; limitations (assumed layout, handling level from units per line, 100-product zone). Next: real case sizes and shelf levels, multi-picker congestion, live WMS feed. | "Everything here is reproducible from the repository in one command." |

## 2-minute live demo script

**Live numbers vary a little** (each run uses a new random seed); slides use the reproducible seed-1 figures.

**Before you start:** the site is open and loaded (data loaded, picker walking), Challenge mode,
Racks = Popularity, speed 10×, AI Suggest not yet run, no panels open. Browser zoom 100%, full screen.

| Time | Do | Say |
|---|---|---|
| 0:00 | Point at the picker walking. | "This is a picking floor replaying real orders from a UK gift wholesaler. The picker only walks the aisles. Orange shelves are this order's picks." |
| 0:15 | Point at the scoreboard: Original vs Baseline. | "Every number is the same 735 orders from a week the layouts never saw. The textbook rule, fast movers next to the dock, saves only 4.4%: wholesale orders cross the whole floor anyway." |
| 0:35 | Click a dark-blue rack near the dock. Purple arcs appear. Hover a rack next to one arc's end; read the tooltip. Click to swap. | "Select a product and the arcs show what's bought with it. Hovering previews the saving on past orders. Swap." |
| 0:55 | Try to move a bulk item (dark brown in the Handling level view) to the back, or just say it. | "Bulk items bought by the case stay next to the cross aisle: the game refuses those swaps and says why." |
| 1:05 | Click **AI Suggest**, then **Run**. While it runs (a few seconds): | "AI Suggest searches 45,000 swaps in the browser, learning only from the first three weeks." |
| 1:12 | Read the headline and the first move (live runs land around −11% to −14%). | "About 12% less walking on the unseen week. And it explains itself: this bottle now sits next to the one it's bought with in 53 orders." |
| 1:25 | Scroll to the business case and read the three numbers. | "About 60 products to move, around 10 hours of work, paid back in under two months of picking days." |
| 1:35 | Click **Batch picking**. | "Carts of four orders cut walking by 60%, and with our layout the carts walk another 7% less." |
| 1:50 | Close. | "Same orders before and after, so every saving here is measured, not claimed." |

**If something fails:** the README results table has every number; keep a screenshot of the AI card
and the batch panel on a slide as a backup.

## Q&A prep

| Question | Answer |
|---|---|
| Is there machine learning? | No trained model is needed: frequency is a count and AI Suggest is simulated annealing, a classical search. Its rigour comes from the hold-out: it learns on 1–21 Nov and is scored on 22–30 Nov. |
| Isn't the optimizer overfitting? | Train gain −12% to −15%, unseen-week gain −9% to −13%. Most of it holds on orders it never saw, which is exactly what the hold-out is there to show. |
| Why is the Baseline gain so small? | Order size. It saves about a fifth on one-line orders and nothing on orders of 16+ lines; this retailer's orders average 7 lines, many wholesale. |
| Where does the Original layout come from? | The dataset has no shelf positions, so Original is an assumed "as received" layout in stock-code order. That's stated in the README. |
| The £ savings look small. | They cover one 100-product zone, about 92 orders a day, walking time only. The same method across a full catalogue and several pickers scales the hours. Assumptions are editable on screen. |
| Is the handling level real? | It comes from the data: average units per order line, banded FL0 (by hand) to FL7 (pallet). The dataset has no weights or case sizes; those would refine it. |
| Why frequency and not cost ABC? | Cost doesn't change walking. 9 of our fast movers are cost class C: arranging by cost would push cheap, popular items away from the dock. |
| What about sorting time in batch picking? | Not included; stated on the panel. Even a generous sort time leaves batching far ahead. |
| Routing? | Nearest-neighbour along aisle centerlines, the same for every layout, so comparisons are fair. Better routing (S-shape, largest gap) would be a next step. |
| How would this work in a real warehouse? | Feed the order history from the WMS, add real shelf positions, case sizes and shelf levels, run AI Suggest with the Balanced plan, and apply the move list in a quiet shift. |
