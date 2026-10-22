// engine/rush.ts — peak-day rush: one shift of real orders against a courier cut-off.
// Orders arrive at their real invoice times. Each free picker takes the oldest waiting order (or a cart of
// waiting orders, built by proximity), walks the route, picks (10 s a line) and packs (per order).
// An order ships on time if it is packed by the cut-off; orders arriving after the cut-off ship tomorrow.
import type { Order } from './data';
import { PICK_TIME, WALK_SPEED, routeOrder } from './sim';

export type RushOptions = {
  pickers: number;
  cart: number;          // orders per trip (1 = single-order picking)
  maxLines: number;      // cart line capacity
  shiftStart: number;    // seconds since midnight
  cutoff: number;        // courier collection, seconds since midnight
  packSec: number;       // packing and labelling per order
};
export const DEFAULT_RUSH: RushOptions = {
  pickers: 1, cart: 1, maxLines: 40, shiftStart: 8 * 3600, cutoff: 16 * 3600, packSec: 90,
};

export type Trip = { picker: number; start: number; end: number; walkEnd: number; orders: number[]; path: number[]; dist: number; lines: number };
export type OrderOutcome = { arrive: number; done: number; onTime: boolean; tomorrow: boolean };
export type RushResult = {
  trips: Trip[]; outcomes: OrderOutcome[];
  due: number;            // orders that arrived before the cut-off
  onTime: number;         // of those, packed by the cut-off
  lastDone: number; walked: number; busy: number; avgWait: number;
};

export const secondsOfDay = (iso: string) => {
  const [h, m, s] = iso.slice(11, 19).split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

// The day of the test week with the most orders (ties: earliest)
export function busiestDay(orders: Order[]): string {
  const n = new Map<string, number>();
  for (const o of orders) n.set(o.t.slice(0, 10), (n.get(o.t.slice(0, 10)) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

// The orders of the `days` busiest days, each keeping its real time of day, merged into one shift
// (peak surge: 2 or 3 times a normal day's volume, made of real orders)
export function rushOrders(orders: Order[], days = 1): { orders: Order[]; dates: string[] } {
  const n = new Map<string, number>();
  for (const o of orders) n.set(o.t.slice(0, 10), (n.get(o.t.slice(0, 10)) ?? 0) + 1);
  const dates = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, days).map(([d]) => d);
  const first = dates[0];
  const merged = orders.filter(o => dates.includes(o.t.slice(0, 10)))
    .map(o => ({ ...o, t: first + o.t.slice(10) }))
    .sort((a, b) => a.t.localeCompare(b.t) || a.id.localeCompare(b.id));
  return { orders: merged, dates };
}

const slotsFor = (orders: Order[], idx: number[], assign: readonly number[]) =>
  [...new Set(idx.flatMap(i => orders[i].lines.map(l => assign[l.p])))];

export function simulateRush(orders: Order[], assign: readonly number[], opts: RushOptions): RushResult {
  const arrive = orders.map(o => secondsOfDay(o.t));
  const queue = orders.map((_, i) => i).sort((a, b) => arrive[a] - arrive[b] || a - b);
  const free = Array<number>(opts.pickers).fill(opts.shiftStart);
  const done = Array<number>(orders.length).fill(Infinity);
  const taken = new Set<number>();
  const trips: Trip[] = [];
  const lines = (i: number) => orders[i].lines.length;
  const length = (idx: number[]) => routeOrder(slotsFor(orders, idx, assign)).total;

  while (taken.size < orders.length) {
    const picker = free.indexOf(Math.min(...free));
    const next = queue.find(i => !taken.has(i))!;
    const t = Math.max(free[picker], arrive[next]);
    const waiting = queue.filter(i => !taken.has(i) && arrive[i] <= t);

    // Cart: the oldest waiting order, then whichever waiting order adds the least walking
    const cart = [waiting[0]];
    let n = lines(cart[0]);
    while (cart.length < opts.cart) {
      let best = -1, bestLen = Infinity;
      for (const i of waiting) {
        if (cart.includes(i) || n + lines(i) > opts.maxLines) continue;
        const L = length([...cart, i]);
        if (L < bestLen) { bestLen = L; best = i; }
      }
      if (best < 0) break;
      cart.push(best); n += lines(best);
    }

    const { path, total } = routeOrder(slotsFor(orders, cart, assign));
    const walkEnd = t + total / WALK_SPEED + n * PICK_TIME;
    const end = walkEnd + cart.length * opts.packSec;
    cart.forEach(i => { taken.add(i); done[i] = end; });
    trips.push({ picker, start: t, end, walkEnd, orders: cart, path, dist: total, lines: n });
    free[picker] = end;
  }

  const outcomes = orders.map((_, i) => {
    const tomorrow = arrive[i] >= opts.cutoff;
    return { arrive: arrive[i], done: done[i], tomorrow, onTime: !tomorrow && done[i] <= opts.cutoff };
  });
  const dueOrders = outcomes.filter(o => !o.tomorrow);
  const lastDone = Math.max(...done);
  return {
    trips, outcomes,
    due: dueOrders.length, onTime: dueOrders.filter(o => o.onTime).length,
    lastDone, walked: trips.reduce((s, x) => s + x.dist, 0),
    busy: trips.reduce((s, x) => s + (x.end - x.start), 0),
    avgWait: trips.reduce((s, x) => s + x.orders.reduce((w, i) => w + (x.start - arrive[i]), 0), 0) / orders.length,
  };
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const hhmm = `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  return s >= 24 * 3600 ? `${hhmm} (+1 day)` : hhmm;
};

// Live counters at a moment of the shift (for the shift clock)
export type RushStats = { arrived: number; waiting: number; shipped: number; onTime: number; late: number; tomorrow: number };
export function rushStats(r: RushResult, clock: number, cutoff: number): RushStats {
  const started = new Set(r.trips.filter(t => t.start <= clock).flatMap(t => t.orders));
  let arrived = 0, waiting = 0, shipped = 0, onTime = 0, late = 0, tomorrow = 0;
  r.outcomes.forEach((o, i) => {
    if (o.arrive > clock) return;
    arrived++;
    if (!started.has(i)) waiting++;
    if (o.done <= clock) shipped++;
    if (o.tomorrow) tomorrow++;
    else if (o.onTime && o.done <= clock) onTime++;
    else if (!o.onTime && clock > cutoff) late++;
  });
  return { arrived, waiting, shipped, onTime, late, tomorrow };
}

// On-time rating: 1 star from 80%, 2 from 90%, 3 from 97%
export const rushStars = (onTimeShare: number) => [0.8, 0.9, 0.97].filter(t => onTimeShare >= t).length;
