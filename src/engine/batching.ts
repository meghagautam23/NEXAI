// engine/batching.ts — batch picking: one trip serves several orders on a multi-order cart
//   FCFS:      orders join the cart in arrival order (the simple policy most warehouses start with)
//   Proximity: seed batching. The earliest waiting order seeds a cart; then the order that adds the
//              least walking joins, until the cart is full. Depends on the layout.
// Batches never span picking days (each day is one wave) and never exceed the cart's line capacity;
// an order larger than the cart goes on its own.
import type { Order } from './data';
import { PICK_TIME, WALK_SPEED, routeLength } from './sim';

export type BatchPolicy = 'fcfs' | 'proximity';
export type BatchOptions = { size: number; maxLines: number; policy: BatchPolicy };
export const DEFAULT_BATCH: BatchOptions = { size: 4, maxLines: 40, policy: 'proximity' };

const slotSet = (orders: Order[], idx: number[], assign: readonly number[]) => {
  const s = new Set<number>();
  for (const i of idx) for (const l of orders[i].lines) s.add(assign[l.p]);
  return s;
};
export const batchLength = (orders: Order[], idx: number[], assign: readonly number[]) =>
  routeLength([...slotSet(orders, idx, assign)]);

const byDay = (orders: Order[]) => {
  const days = new Map<string, number[]>();
  orders.forEach((o, i) => {
    const d = o.t.slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(i);
  });
  return [...days.values()]; // orders are already in time order
};

// Partition orders (by index) into batches
export function makeBatches(orders: Order[], assign: readonly number[], opts: BatchOptions): number[][] {
  const { size, maxLines, policy } = opts;
  const lines = (i: number) => orders[i].lines.length;
  const batches: number[][] = [];
  for (const day of byDay(orders)) {
    if (policy === 'fcfs') {
      let cur: number[] = [], n = 0;
      for (const i of day) {
        if (cur.length && (cur.length >= size || n + lines(i) > maxLines)) { batches.push(cur); cur = []; n = 0; }
        cur.push(i); n += lines(i);
      }
      if (cur.length) batches.push(cur);
      continue;
    }
    const waiting = [...day];
    while (waiting.length) {
      const cur = [waiting.shift()!];
      let n = lines(cur[0]), slots = slotSet(orders, cur, assign), len = routeLength([...slots]);
      while (cur.length < size) {
        let best = -1, bestAdd = Infinity, bestSlots = slots, bestLen = len;
        waiting.forEach((i, k) => {
          if (n + lines(i) > maxLines) return;
          const s = new Set(slots);
          for (const l of orders[i].lines) s.add(assign[l.p]);
          const L = routeLength([...s]);
          if (L - len < bestAdd) { bestAdd = L - len; best = k; bestSlots = s; bestLen = L; }
        });
        if (best < 0) break;
        const [i] = waiting.splice(best, 1);
        cur.push(i); n += lines(i); slots = bestSlots; len = bestLen;
      }
      batches.push(cur);
    }
  }
  return batches;
}

export type BatchStats = { trips: number; orders: number; lines: number; totalDist: number; avgTime: number };

export function scoreBatches(orders: Order[], batches: number[][], assign: readonly number[]): BatchStats {
  let totalDist = 0, lines = 0, n = 0;
  for (const b of batches) {
    totalDist += batchLength(orders, b, assign);
    for (const i of b) { lines += orders[i].lines.length; n++; }
  }
  return { trips: batches.length, orders: n, lines, totalDist, avgTime: (totalDist / WALK_SPEED + lines * PICK_TIME) / n };
}

// Single-order picking is batching with a cart of one
export const scoreBatching = (orders: Order[], assign: readonly number[], opts: BatchOptions) =>
  scoreBatches(orders, makeBatches(orders, assign, opts), assign);
