// Batch picking (stretch goal; ported from Megha Gautam's branch, scored in time): one trip serves several
// orders on a multi-order cart. The picker visits every slot of the batch once (nearest-neighbour route)
// and sorts the orders at the dock (sorting time not included).
//   First come: orders join the cart in arrival order.
//   Proximity: the earliest waiting order seeds a cart, then the order that adds the least walking joins.
// Batches never span picking days and never exceed the cart's line capacity.
import { WALK_SPEED, routeLength } from './sim';
import type { Order } from './types';

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
  return [...days.values()];
};

/** Partition orders (by index) into batches */
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

export type BatchStats = { trips: number; orders: number; lines: number; totalDist: number; totalTime: number; avgTime: number };

/** Each line is still picked on its own (handling, class check, forklift access); only walking is shared */
export function scoreBatches(orders: Order[], batches: number[][], assign: readonly number[], pick: number[][]): BatchStats {
  let totalDist = 0, lines = 0, n = 0, picking = 0;
  for (const b of batches) {
    totalDist += batchLength(orders, b, assign);
    for (const i of b) { n++; for (const l of orders[i].lines) { lines++; picking += pick[l.p][assign[l.p]]; } }
  }
  const totalTime = totalDist / WALK_SPEED + picking;
  return { trips: batches.length, orders: n, lines, totalDist, totalTime, avgTime: totalTime / n };
}

/** Single-order picking is batching with a cart of one */
export const scoreBatching = (orders: Order[], assign: readonly number[], pick: number[][], opts: BatchOptions) =>
  scoreBatches(orders, makeBatches(orders, assign, opts), assign, pick);

/** A batch as one pseudo-order (for the 3D replay and pick list): every line of every order in it */
export const batchAsOrder = (orders: Order[], idx: number[]) => ({
  id: idx.map(i => orders[i].id).join('+'), t: orders[idx[0]].t, lines: idx.flatMap(i => orders[i].lines),
  members: idx.map(i => orders[i].id),
});
