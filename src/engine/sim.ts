// engine/sim.ts — routing and scoring (Plan v2, Section 5.2)
// A layout is `assign: number[]`, productId -> slotId, a permutation of 0..99.
import { D, DOCK } from './geometry';
import type { Order } from './data';

export const WALK_SPEED = 1.0; // m/s
export const PICK_TIME = 10;   // s per order line

// Nearest-neighbour route from the dock through every slot and back. Ties -> lower slot id.
export function routeOrder(slots: number[]) {
  const left = new Set(slots);
  let cur = DOCK, total = 0;
  const path = [DOCK];
  while (left.size) {
    let best = -1, bd = Infinity;
    for (const s of left)
      if (D[cur][s] < bd || (D[cur][s] === bd && s < best)) { bd = D[cur][s]; best = s; }
    total += bd; cur = best; left.delete(best); path.push(best);
  }
  total += D[cur][DOCK]; path.push(DOCK);
  return { total, path };
}

// Same route as routeOrder, distance only, no allocation: the hot path for swapDelta and the optimizer.
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
  orders: number; lines: number;
  totalDist: number; meanDist: number; medianDist: number; p90Dist: number; // metres per order
  avgTime: number;                                                         // seconds per order
};

export function statsOf(dists: number[], lines: number): Stats {
  const n = dists.length;
  const sorted = [...dists].sort((a, b) => a - b);
  const totalDist = sorted.reduce((s, d) => s + d, 0);
  const q = (f: number) => sorted[Math.min(n - 1, Math.floor(f * n))];
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return {
    orders: n, lines,
    totalDist, meanDist: totalDist / n, medianDist: median, p90Dist: q(0.9),
    avgTime: (totalDist / WALK_SPEED + lines * PICK_TIME) / n,
  };
}

// One-off full score of a layout
export function scoreLayout(orders: Order[], assign: number[]): Stats {
  const lines = orders.reduce((n, o) => n + o.lines.length, 0);
  return statsOf(orders.map(o => routeLength(slotsOf(o, assign))), lines);
}

// Incremental engine: caches every order's distance; a swap rescores only the orders that
// contain either product. Owns its copy of the layout.
export function makeEngine(orders: Order[], initial: number[]) {
  const assign = [...initial];
  const productAt: number[] = [];                  // slotId -> productId
  assign.forEach((s, p) => (productAt[s] = p));

  const prods = orders.map(o => [...new Set(o.lines.map(l => l.p))]); // distinct products per order
  const ordersByProduct: number[][] = assign.map(() => []);
  prods.forEach((ps, i) => ps.forEach(p => ordersByProduct[p].push(i)));
  const scratch = new Int32Array(Math.max(1, ...prods.map(ps => ps.length)));
  const distOf = (i: number) => {
    const ps = prods[i];
    for (let k = 0; k < ps.length; k++) scratch[k] = assign[ps[k]];
    return routeLength(scratch, ps.length);
  };
  const orderDist = orders.map((_, i) => distOf(i));
  const lines = orders.reduce((n, o) => n + o.lines.length, 0);

  const exchange = (p1: number, p2: number) => {
    [assign[p1], assign[p2]] = [assign[p2], assign[p1]];
    productAt[assign[p1]] = p1; productAt[assign[p2]] = p2;
  };

  // Change in total distance if p1 and p2 swapped slots. Leaves the layout untouched;
  // call commit() to apply it without rescoring.
  function swapDelta(p1: number, p2: number) {
    const affected = new Set([...ordersByProduct[p1], ...ordersByProduct[p2]]);
    exchange(p1, p2);
    let delta = 0;
    const next = new Map<number, number>();
    for (const i of affected) {
      const d = distOf(i);
      next.set(i, d); delta += d - orderDist[i];
    }
    exchange(p1, p2);
    return {
      delta,
      commit: () => { exchange(p1, p2); next.forEach((d, i) => (orderDist[i] = d)); },
    };
  }

  return {
    orders,
    assign: assign as readonly number[],
    productAt: productAt as readonly number[],
    swapDelta,
    swap: (p1: number, p2: number) => swapDelta(p1, p2).commit(),
    orderDistance: (i: number) => orderDist[i],
    route: (i: number) => routeOrder(slotsOf(orders[i], assign)),
    stats: () => statsOf(orderDist, lines),
  };
}

export type Engine = ReturnType<typeof makeEngine>;
