// AI Suggest (Plan v2, Section 8): simulated annealing over product swaps, scored by the real simulator on
// the TRAIN weeks only, starting from the Baseline and never breaking the placement rules. Then pruning:
// every move that does not pay for itself on the train weeks is undone, so only products that earn it move.
// Ported from Megha Gautam's branch; the objective here is total picking time in seconds (walking +
// handling + forklift access, core/engine/rules.ts) rather than distance.
import { D } from '../../core/engine/geometry';
import { swapProblem, type RuleOptions } from '../../core/engine/rules';
import { makeEngine } from '../../core/engine/sim';
import type { Order, Product } from '../../core/engine/types';

export type OptimizeInput = {
  products: Product[];
  orders: Order[];            // train orders
  pick: number[][];           // pick[product][slot] seconds per line
  partners: number[][];       // bought-together partners per product (strongest first)
  start: readonly number[];   // assign to start from
  rules: RuleOptions;
  budgetMs?: number;          // stop after this long (safety cap)...
  iterations?: number;        // ...or after this many proposals
  seed?: number;
  movePenalty?: number;       // train-week seconds charged per product moved away from `start` (re-slotting cost)
  onProgress?: (p: Progress) => void;
};
export type Progress = { iterations: number; elapsedMs: number; best: number; start: number };
export type OptimizeResult = {
  assign: number[]; start: number; best: number; iterations: number; accepted: number; pruned: number;
};

const T_START = 25, T_END = 0.3;     // seconds over the train weeks
const PARTNER_MOVES = 0.7;            // share of proposals that move a product next to a bought-together partner
const NEAR = 6;                       // candidate slots around the partner
const PROGRESS_EVERY_MS = 200;

// Small seeded PRNG so runs are repeatable
export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The NEAR slots closest (walking distance) to each slot
const nearSlots: number[][] = Array.from({ length: 100 }, (_, s) =>
  [...Array(100).keys()].filter(o => o !== s).sort((a, b) => D[s][a] - D[s][b] || a - b).slice(0, NEAR));

export function optimize(input: OptimizeInput): OptimizeResult {
  const { products, orders, pick, partners, start, rules, budgetMs, iterations = Infinity, seed = 1, movePenalty = 0, onProgress } = input;
  const rnd = mulberry32(seed);
  const eng = makeEngine(orders, start, pick);
  const n = products.length;
  const t0 = performance.now();
  const startTotal = eng.stats().totalTime;
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

    // Cooling follows whichever limit is closer: iterations, or the time cap
    const frac = Math.max(Number.isFinite(iterations) ? it / iterations : 0,
                          budgetMs !== undefined ? (performance.now() - t0) / budgetMs : 0);
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

  const pruned = prune(products, orders, pick, start, bestAssign, rules);
  const final = makeEngine(orders, pruned.assign, pick).stats().totalTime;
  return { assign: pruned.assign, start: startTotal, best: final, iterations: it, accepted, pruned: pruned.undone };
}

// Train-week seconds one move must save to pay back its re-slotting labour within `paybackDays`
export const penaltyFor = (minutesPerMove: number, paybackDays: number, trainDays: number) =>
  (minutesPerMove * 60 * trainDays) / paybackDays;

// Undo free moves: put a moved product back in its original slot whenever that does not lengthen the
// train-week time and keeps the rules. Weakest moves first; repeats until nothing changes.
export function prune(products: Product[], orders: Order[], pick: number[][], before: readonly number[],
                      after: readonly number[], rules: RuleOptions) {
  const eng = makeEngine(orders, after, pick);
  let undone = 0, changed = true;
  while (changed) {
    changed = false;
    const candidates = products
      .filter(p => eng.assign[p.id] !== before[p.id])
      .map(p => ({ p, s: eng.swapDelta(p.id, eng.productAt[before[p.id]]) }))
      .sort((a, b) => a.s.delta - b.s.delta || a.p.id - b.p.id);
    for (const { p } of candidates) {
      const home = before[p.id];
      if (eng.assign[p.id] === home) continue;   // already put back by an earlier undo
      if (swapProblem(products, eng.productAt, eng.assign[p.id], home, rules)) continue;
      const s = eng.swapDelta(p.id, eng.productAt[home]);   // recomputed: earlier undos change it
      if (s.delta <= 1e-9) { s.commit(); undone++; changed = true; }
    }
  }
  return { assign: [...eng.assign], undone };
}

export const movedProducts = (before: readonly number[], after: readonly number[]) =>
  before.flatMap((s, p) => (after[p] !== s ? [p] : []));
