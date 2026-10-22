// engine/sim.ts — routing and scoring with a per-order cache (Plan v2, Section 5.2).
// Each order caches its walking distance and its time: walk / speed + per-line pick time from rules.ts.
// Engine design (non-mutating swap previews, typed-array routing) ported from Megha Gautam's branch.
import { D, DOCK } from './geometry';
import { RULES } from './rules';
import type { Order } from './types';

export const WALK_SPEED = RULES.walkSpeed;   // m/s

// Nearest-neighbour route from the dock through every slot and back. Ties -> lower slot id.
export function routeOrder(slots: number[]) {
  const left = new Set(slots); let cur = DOCK, total = 0; const path = [DOCK];
  while (left.size) {
    let best = -1, bd = Infinity;
    for (const s of left) if (D[cur][s] < bd || (D[cur][s] === bd && s < best)) { bd = D[cur][s]; best = s; }
    total += bd; cur = best; left.delete(best); path.push(best);
  }
  total += D[cur][DOCK]; path.push(DOCK);
  return { total, path };
}

// Same route as routeOrder, distance only, no allocation: the hot path for swaps and the optimiser.
// `slots` is used as scratch space and reordered.
const N = D.length;
const FLAT = Float64Array.from(D.flat());
export function routeLength(slots: number[] | Int32Array, n = slots.length) {
  let cur = DOCK, total = 0;
  for (let left = n; left > 0; left--) {
    let bi = 0, bd = Infinity, bs = 0;
    const row = cur * N;
    for (let i = 0; i < left; i++) {
      const s = slots[i], d = FLAT[row + s];
      if (d < bd || (d === bd && s < bs)) { bd = d; bi = i; bs = s; }
    }
    total += bd; cur = bs; slots[bi] = slots[left - 1];
  }
  return total + FLAT[cur * N + DOCK];
}

export const slotsOf = (o: Order, assign: readonly number[]) => [...new Set(o.lines.map(l => assign[l.p]))];

export type Stats = {
  totalDist: number; meanDist: number; medianDist: number; p90Dist: number;
  totalTime: number; avgTime: number; medianTime: number; p90Time: number;   // seconds
};

const spread = (xs: ArrayLike<number>) => {
  const sorted = Array.from(xs).sort((a, b) => a - b);
  const total = sorted.reduce((s, d) => s + d, 0);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  return { total, mean: total / sorted.length, median: q(0.5), p90: q(0.9) };
};

/** pick[productId][slotId] = seconds per line (see rules.ts pickTable). The engine owns its copy of the layout. */
export function makeEngine(orders: Order[], initial: readonly number[], pick: number[][]) {
  const assign = [...initial];
  const productAt: number[] = [];                  // slotId -> productId
  assign.forEach((s, p) => (productAt[s] = p));

  const prods = orders.map(o => [...new Set(o.lines.map(l => l.p))]);   // distinct products per order
  const ordersByProduct: number[][] = assign.map(() => []);
  prods.forEach((ps, i) => ps.forEach(p => ordersByProduct[p].push(i)));
  const scratch = new Int32Array(Math.max(1, ...prods.map(ps => ps.length)));
  const distOf = (i: number) => {
    const ps = prods[i];
    for (let k = 0; k < ps.length; k++) scratch[k] = assign[ps[k]];
    return routeLength(scratch, ps.length);
  };
  const pickOf = (i: number) => { let t = 0; for (const p of prods[i]) t += pick[p][assign[p]]; return t; };
  const orderDist = orders.map((_, i) => distOf(i));
  const orderTime = orders.map((_, i) => orderDist[i] / WALK_SPEED + pickOf(i));

  const exchange = (p1: number, p2: number) => {
    [assign[p1], assign[p2]] = [assign[p2], assign[p1]];
    productAt[assign[p1]] = p1; productAt[assign[p2]] = p2;
  };

  // Change if p1 and p2 swapped slots: delta in seconds (the score), dDist in metres.
  // Leaves the layout untouched; commit() applies it without rescoring.
  function swapDelta(p1: number, p2: number) {
    const affected = new Set([...ordersByProduct[p1], ...ordersByProduct[p2]]);
    exchange(p1, p2);
    let delta = 0, dDist = 0;
    const next = new Map<number, [number, number]>();
    for (const i of affected) {
      const d = distOf(i), t = d / WALK_SPEED + pickOf(i);
      next.set(i, [d, t]); delta += t - orderTime[i]; dDist += d - orderDist[i];
    }
    exchange(p1, p2);
    return {
      delta, dDist,
      commit: () => { exchange(p1, p2); next.forEach(([d, t], i) => { orderDist[i] = d; orderTime[i] = t; }); },
    };
  }

  function stats(): Stats {
    const d = spread(orderDist), t = spread(orderTime);
    return { totalDist: d.total, meanDist: d.mean, medianDist: d.median, p90Dist: d.p90,
             totalTime: t.total, avgTime: t.mean, medianTime: t.median, p90Time: t.p90 };
  }

  return {
    orders,
    assign: assign as readonly number[],
    productAt: productAt as readonly number[],
    swapDelta,
    swap: (p1: number, p2: number) => swapDelta(p1, p2).commit(),
    orderTime: (i: number) => orderTime[i],
    stats,
  };
}

export type Engine = ReturnType<typeof makeEngine>;

export const scoreLayout = (orders: Order[], assign: readonly number[], pick: number[][]) =>
  makeEngine(orders, assign, pick).stats();
