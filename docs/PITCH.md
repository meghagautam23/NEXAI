# Pitch: slides outline, 2-minute demo script, Q&A

Adapted from Megha Gautam's pitch kit for the merged project. All numbers come from the README's
[Results](../README.md#results): the test week 22–30 Nov 2011, 735 orders, which no layout or optimiser saw while
being built. AI figures are the reproducible seed-1 run of the Balanced plan; live runs vary slightly.

## Slides outline (10 slides, about 4 minutes without the live demo)

| # | Slide | On the slide | Say |
|---|---|---|---|
| 1 | **Title** | "Pick & Pack: a warehouse digital twin, measured on real orders". Photo-card 3D floor. Team names. | "We built a digital twin of a gift wholesaler's picking floor. Every layout change is replayed on real orders, so it's measured, not claimed." |
| 2 | **The problem** | Pickers spend more time walking than picking. Where a product sits decides the walk, and bulky items cost extra handling. | "Slotting is decided once and lived with for months. We make it testable." |
| 3 | **Real data, honest split** | Online Retail II, November 2011: 541,910 rows → 527,725 clean. Learn on 1–21 Nov, score on 22–30 Nov. Top 100 products, cost class A/B/C, handling level FL0–7 from real order quantities. | "Everything is tuned on three weeks and scored on the fourth, which it never saw. Even the player's score is hidden until they submit." |
| 4 | **The twin** | Module 2 screenshot: photo cards on every rack, picker on the aisles, pick list with seconds per item. Time rules table. | "The animated walk and the score come from one function, and a test proves they match. Each pick takes 6 s plus 4 s per FL level; forklift items lose time the deeper they sit in an aisle." |
| 5 | **Surprise: the textbook rule barely helps** | Original 187,608 s → Baseline 184,924 s (−1.4% time, −4.7% walking). | "Fast movers by the dock helps walking a little, but wholesale orders cross the whole floor, and it ignores forklift access." |
| 6 | **AI Suggest: explained, and honest** | −6.3% time, −8.0% walking vs Baseline on the unseen week, 57 moves. One explained move ("Now 1.2 m from Alarm Clock Bakelike Red, was 25.2 m: bought together in 80 orders"). | "45,000 swaps in about five seconds in the browser. It explains every move and never sees the week it's scored on." |
| 7 | **It pays for itself** | Business card: ~25 min a day, ~£1.5k a year for this 100-product zone; re-slotting effort and payback in picking days. Plans: Max saving / Balanced / Fewer moves. | "Real warehouses don't move everything. The optimiser charges for every move, so it picks the moves that pay." |
| 8 | **Batching: the biggest lever** | 4-order proximity carts: −60% walking (−64% on the AI layout). | "Batching cuts trips; slotting cuts each trip. They add up." |
| 9 | **Peak day: people, carts and congestion** | Peak ×3 (329 orders, 17:00 cut-off): 3 pickers 84% on time on Baseline, 87% on the AI layout, 90–91% with carts; congestion costs 19–34 minutes a shift and carts halve it. | "More pickers ship more, but they start bumping into each other in the aisles. The twin shows you that before you staff it." |
| 10 | **New products and next steps** | A new SKU with no history: look-alikes predict its picks; every shelf is tested; best shelf saves ~1 min a day. 70+ automated tests. Next: real weights and shelf levels, live WMS feed. | "From history to tomorrow's product, all reproducible from the repository." |

## 2-minute live demo script

**Before you start:** the site is open on the home screen, browser zoom 100%, full screen. AI Suggest not yet run.

| Time | Do | Say |
|---|---|---|
| 0:00 | Home: point at the three modules. | "Three modules, one per requirement: the data, the twin, and the game." |
| 0:10 | Open **Warehouse replay**, press **Play replay**, then **Aisle 3**. | "Real orders from a UK gift wholesaler. The picker only walks the aisles; every rack shows what's on it. The pick list shows the seconds each item takes: forklift items cost more." |
| 0:30 | Switch to **Peak shift**, **Run the shift** (Peak ×3, 3 pickers). | "Our busiest three days in one shift, 17:00 courier cut-off. Three pickers ship 84% on time, and lose about 20 minutes to congestion in the aisles." |
| 0:50 | Open **Slotting challenge → Challenge**. Select a rack near the dock; dashed lines appear; hover another and swap. | "Select a product and the lines show what's bought with it. The preview uses past orders only; the real score stays hidden until you submit." |
| 1:10 | Click **AI Suggest → Run AI Suggest**. While it runs: | "It searches 45,000 swaps in the browser, learning only from the first three weeks." |
| 1:20 | Read the headline and the first move. Scroll to the business case. | "About 6% less picking time on the unseen week, and it explains itself. Around 60 moves, paid back in a few weeks of picking days." |
| 1:40 | Back to **Warehouse replay → Batch picking**. | "Carts of four cut walking by 60%; with the AI layout, even more." |
| 1:55 | Close. | "Same orders before and after, so every saving here is measured, not claimed." |

**If something fails:** the README results table has every number; keep screenshots of the AI panel, the batch
table and the peak-shift result on a backup slide.

## Q&A prep

| Question | Answer |
|---|---|
| Is there machine learning? | No trained model is needed: frequency is a count and AI Suggest is simulated annealing, a classical search. Its rigour comes from the hold-out: it learns on 1–21 Nov and is scored on 22–30 Nov. |
| Isn't the optimiser overfitting? | It's tuned on the planning weeks and still saves 6–8% on the unseen week. Charging for each move (Balanced) keeps most of the gain with fewer moves. |
| Can a player cheat by tuning on the test week? | No. Swap previews use 1–21 Nov; the test-week score stays hidden until Submit. |
| Why is the Baseline gain so small? | Wholesale orders average 7 lines and cross the floor anyway, and frequency alone ignores forklift access at aisle ends. |
| Where do FL levels come from? | Real order quantities: the mean units per order line, banded 0–7 (bigger loads need cases, pallets, then a forklift). The rules are in `src/core/engine/rules.ts`. |
| Where does the Original layout come from? | The dataset has no shelf positions, so Original is an assumed "as received" layout in stock-code order. That's stated in the README. |
| What does congestion mean here? | When two pickers meet in an aisle (same aisle, within 1.5 m), the one walking slows to 0.35 m/s to squeeze past. It's a simple, stated model, and the twin reports the minutes it costs. |
| The £ savings look small. | They cover one 100-product zone, about 92 orders a day. The same method across a full catalogue and shift scales the hours. Assumptions are editable on screen. |
| Are the product photos real? | They are openly licensed photos of each product type (credited in the app), not the exact items; the dataset has no images. |
| How would this work in a real warehouse? | Feed the WMS order history, add real shelf positions, weights and levels, run AI Suggest with the Balanced plan, and apply the move list in a quiet shift. |
