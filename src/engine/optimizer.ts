// engine/optimizer.ts — AI Suggest (Plan v2, Section 8)
// Simulated annealing over product swaps, scored by the real simulator on the TRAIN weeks only,
// starting from a given layout (normally the Baseline) and never breaking the placement rules.
// Then pruning: every move that does not pay for itself on the train weeks is undone, so the
// warehouse only re-slots products that earn it.
import { D } from './geometry';
import type { Order, Product } from './data';
import { swapProblem, type RuleOptions } from './rules';
import { makeEngine } from './sim';

export type OptimizeInput = {
  products: Product[];
  orders: Order[];            // train orders
  partners: number[][];       // bought-together partners per product (strongest first)
  start: number[];            // assign to start from
  rules: RuleOptions;
  budgetMs?: number;          // stop after this long (browser)...
  iterations?: number;        // ...or after this many proposals (tests)
  seed?: number;
  movePenalty?: number;       // train-week metres charged per product moved away from `start` (re-slotting cost)
  onProgress?: (p: Progress) => void;
};
export type Progress = { iterations: number; elapsedMs: number; best: number; start: number };
export type OptimizeResult = {
  assign: number[]; start: number; best: number; iterations: number; accepted: number; pruned: number;
};

const T_START = 25, T_END = 0.3;     // metres over the train weeks; ~half of early worsening moves accepted
const PARTNER_MOVES = 0.7;            // share of proposals that move a product next to a bought-together partner
const NEAR = 6;                       // candidate slots around the partner
const PROGRESS_EVERY_MS = 200;

// Small seeded PRNG so runs are repeatable
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The NEAR slots closest (walking distance) to each slot
const nearSlots: number[][] = Array.from({ length: 100 }, (_, s) =>
  [...Array(100).keys()].filter(o => o !== s).sort((a, b) => D[s][a] - D[s][b] || a - b).slice(0, NEAR));

export function optimize(input: OptimizeInput): OptimizeResult {
  const { products, orders, partners, start, rules, budgetMs, iterations = Infinity, seed = 1, movePenalty = 0, onProgress } = input;
  const rnd = mulberry32(seed);
  const eng = makeEngine(orders, start);
  const n = products.length;
  const t0 = performance.now();
  const startTotal = eng.stats().totalDist;
  // Objective = train-week walking + movePenalty per product not in its starting slot
  const away = (p: number, slot: number) => (slot !== start[p] ? 1 : 0);
  let cur = startTotal, best = startTotal, bestAssign = [...eng.assign];
  let it = 0, accepted = 0, lastReport = t0;

  const done = () => it >= iterations || (budgetMs !== undefined && performance.now() - t0 >= budgetMs);
  while (!done()) {
    it++;
    const p1 = Math.floor(rnd() * n);
    let p2: number;
    const ps = partners[p1];
    if (ps.length && rnd() < PARTNER_MOVES) {
      const q = ps[Math.floor(rnd() * ps.length)];
      const near = nearSlots[eng.assign[q]];
      p2 = eng.productAt[near[Math.floor(rnd() * near.length)]];
    } else p2 = Math.floor(rnd() * n);
    if (p1 === p2 || swapProblem(products, eng.productAt, eng.assign[p1], eng.assign[p2], rules)) continue;

    const frac = budgetMs !== undefined ? (performance.now() - t0) / budgetMs : it / iterations;
    const T = T_START * Math.pow(T_END / T_START, Math.min(1, frac));
    const s = eng.swapDelta(p1, p2);
    const a1 = eng.assign[p1], a2 = eng.assign[p2];
    const delta = s.delta + movePenalty * (away(p1, a2) + away(p2, a1) - away(p1, a1) - away(p2, a2));
    if (delta < 0 || rnd() < Math.exp(-delta / T)) {
      s.commit(); cur += delta; accepted++;
      if (cur < best - 1e-9) { best = cur; bestAssign = [...eng.assign]; }
    }
    if (onProgress && performance.now() - lastReport >= PROGRESS_EVERY_MS) {
      lastReport = performance.now();
      onProgress({ iterations: it, elapsedMs: lastReport - t0, best, start: startTotal });
    }
  }

  const pruned = prune(products, orders, start, bestAssign, rules);
  const final = makeEngine(orders, pruned.assign).stats().totalDist;
  return { assign: pruned.assign, start: startTotal, best: final, iterations: it, accepted, pruned: pruned.undone };
}

// Train-week metres one move must save to pay back its re-slotting labour within `paybackDays`:
// minutes of handling, as metres of walking at the same wage, spread over the train period.
export function penaltyFor(minutesPerMove: number, paybackDays: number, trainDays: number, walkSpeed = 1) {
  return (minutesPerMove * 60 * walkSpeed * trainDays) / paybackDays;
}

// Undo free moves: put a moved product back in its original slot (swapping with whatever is there now)
// whenever that does not lengthen the train-week walk and keeps the rules. Weakest moves first; repeats
// until nothing changes. (Cutting moves that save only a little is the job of movePenalty: moves depend
// on each other, so undoing them one by one afterwards unravels the whole plan.)
export function prune(products: Product[], orders: Order[], before: number[], after: number[], rules: RuleOptions,
                      minSaving = 0) { // minSaving > 0 is for experiments only
  const eng = makeEngine(orders, after);
  let undone = 0, changed = true;
  while (changed) {
    changed = false;
    const candidates = products
      .filter(p => eng.assign[p.id] !== before[p.id])
      .map(p => ({ p, s: eng.swapDelta(p.id, eng.productAt[before[p.id]]) }))
      .sort((a, b) => a.s.delta - b.s.delta || a.p.id - b.p.id);
    for (const { p } of candidates) {
      const home = before[p.id];
      if (eng.assign[p.id] === home) continue; // already put back by an earlier undo
      if (swapProblem(products, eng.productAt, eng.assign[p.id], home, rules)) continue;
      const s = eng.swapDelta(p.id, eng.productAt[home]); // recomputed: earlier undos change it
      if (s.delta <= minSaving + 1e-9) { s.commit(); undone++; changed = true; }
    }
  }
  return { assign: [...eng.assign], undone };
}

export const movedProducts = (before: readonly number[], after: readonly number[]) =>
  before.flatMap((s, p) => (after[p] !== s ? [p] : []));
