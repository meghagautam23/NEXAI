// Peak shift: several pickers work one shift of real orders against a courier cut-off, and slow down when
// two meet in an aisle (stretch goal: "several pickers, with congestion when two meet in an aisle").
// Shift model (arrivals at real invoice times, oldest-first carts built by proximity, packing per order,
// on-time vs cut-off) ported from Megha Gautam's branch; the step-by-step movement and congestion are new.
//
// Every picker walks the same aisle/cross-aisle waypoints as the replay (leg()), picks each line for its
// rule-based time (rules.ts), and packs at the dock. Congestion: a picker walking in an aisle within
// CONGESTION.gap metres of another picker in the same aisle squeezes past at CONGESTION.speed.
import { L, PITCH, DOCK, leg, pts } from './geometry';
import { WALK_SPEED, routeLength, routeOrder } from './sim';
import type { Order } from './types';

export type ShiftOptions = {
  pickers: number;
  cart: number;          // orders per trip (1 = single-order picking)
  maxLines: number;      // cart line capacity
  shiftStart: number;    // seconds since midnight
  cutoff: number;        // courier collection, seconds since midnight
  packSec: number;       // packing and labelling per order
  congestion: boolean;
};
export const DEFAULT_SHIFT: ShiftOptions = {
  pickers: 3, cart: 1, maxLines: 40, shiftStart: 8 * 3600, cutoff: 17 * 3600, packSec: 90, congestion: true,
};
export const CONGESTION = { speed: 0.35, gap: 1.5 };   // m/s while squeezing past; metres
const DT = 0.5;                  // simulation step, seconds
export const TRACK_EVERY = 2;    // replay sample interval, seconds

type Seg = { kind: 'walk'; x0: number; y0: number; x1: number; y1: number; len: number } | { kind: 'wait'; dur: number };
export type Trip = { picker: number; start: number; end: number; orders: number[]; path: number[]; dist: number; lines: number; delay: number };
export type OrderOutcome = { arrive: number; start: number; done: number; onTime: boolean; tomorrow: boolean };
/** Positions of one picker every TRACK_EVERY seconds from `t0`, and the trip it was on (-1 = idle) */
export type Track = { t0: number; x: Float32Array; y: Float32Array; trip: Int32Array };
export type ShiftResult = {
  trips: Trip[]; outcomes: OrderOutcome[]; tracks: Track[];
  due: number; onTime: number; lastDone: number; walked: number; avgWait: number; congestionDelay: number;
};

export const secondsOfDay = (iso: string) => {
  const [h, m, s] = iso.slice(11, 19).split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

/** The orders of the `days` busiest days, each keeping its real time of day, merged into one shift */
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

const aisleX = (x: number) => { const a = Math.round(x / PITCH); return Math.abs(x - a * PITCH) < 1e-6 ? a : -1; };
const inAisle = (x: number, y: number) => aisleX(x) >= 0 && y > 1e-6 && y < L - 1e-6;

export function simulateShift(orders: Order[], assign: readonly number[], pick: number[][], opts: ShiftOptions): ShiftResult {
  const n = orders.length;
  const arrive = orders.map(o => secondsOfDay(o.t));
  const queue = orders.map((_, i) => i).sort((a, b) => arrive[a] - arrive[b] || a - b);
  const taken = new Uint8Array(n);
  const outcomes: OrderOutcome[] = orders.map((_, i) => ({ arrive: arrive[i], start: Infinity, done: Infinity, onTime: false, tomorrow: arrive[i] >= opts.cutoff }));
  const trips: Trip[] = [];
  const slotsFor = (idx: number[]) => [...new Set(idx.flatMap(i => orders[i].lines.map(l => assign[l.p])))];
  const lines = (i: number) => orders[i].lines.length;
  const dock = pts[DOCK];

  type P = { x: number; y: number; segs: Seg[]; si: number; segT: number; trip: number };
  const ps: P[] = Array.from({ length: opts.pickers }, () => ({ x: dock.x, y: dock.y, segs: [], si: 0, segT: 0, trip: -1 }));
  let left = n;

  const dispatch = (p: P, picker: number, t: number) => {
    const waiting = queue.filter(i => !taken[i] && arrive[i] <= t);
    if (!waiting.length) return;
    // Cart: the oldest waiting order, then whichever waiting order adds the least walking
    const cart = [waiting[0]];
    let nl = lines(cart[0]);
    while (cart.length < opts.cart) {
      let best = -1, bestLen = Infinity;
      for (const i of waiting) {
        if (cart.includes(i) || nl + lines(i) > opts.maxLines) continue;
        const len = routeLength(slotsFor([...cart, i]));
        if (len < bestLen) { bestLen = len; best = i; }
      }
      if (best < 0) break;
      cart.push(best); nl += lines(best);
    }
    const { path, total } = routeOrder(slotsFor(cart));
    const segs: Seg[] = [];
    let cx = dock.x, cy = dock.y;
    for (let k = 1; k < path.length; k++) {
      for (const w of leg(pts[path[k - 1]], pts[path[k]]).pts) {
        const len = Math.abs(w.x - cx) + Math.abs(w.y - cy);
        if (len > 1e-9) segs.push({ kind: 'walk', x0: cx, y0: cy, x1: w.x, y1: w.y, len });
        cx = w.x; cy = w.y;
      }
      const slot = path[k];
      if (slot !== DOCK) {
        let dur = 0;
        for (const i of cart) for (const l of orders[i].lines) if (assign[l.p] === slot) dur += pick[l.p][slot];
        segs.push({ kind: 'wait', dur });
      }
    }
    segs.push({ kind: 'wait', dur: cart.length * opts.packSec });
    cart.forEach(i => { taken[i] = 1; outcomes[i].start = t; });
    p.segs = segs; p.si = 0; p.segT = 0; p.trip = trips.length;
    trips.push({ picker, start: t, end: Infinity, orders: cart, path, dist: total, lines: nl, delay: 0 });
  };

  const t0 = opts.shiftStart;
  const samples: { x: number[]; y: number[]; trip: number[] }[] = ps.map(() => ({ x: [], y: [], trip: [] }));
  let t = t0, step = 0;
  const every = Math.round(TRACK_EVERY / DT);
  while (left > 0 || ps.some(p => p.trip >= 0)) {
    ps.forEach((p, k) => { if (p.trip < 0 && left > 0) dispatch(p, k, t); });
    if (step % every === 0) ps.forEach((p, k) => { samples[k].x.push(p.x); samples[k].y.push(p.y); samples[k].trip.push(p.trip); });
    ps.forEach(p => {
      if (p.trip < 0) return;
      let budget = DT;
      while (budget > 1e-9 && p.si < p.segs.length) {
        const seg = p.segs[p.si];
        if (seg.kind === 'wait') {
          const use = Math.min(budget, seg.dur - p.segT);
          p.segT += use; budget -= use;
        } else {
          let speed = WALK_SPEED;
          if (opts.congestion && inAisle(p.x, p.y) && ps.some(o => o !== p && o.trip >= 0 && inAisle(o.x, o.y) &&
              Math.abs(o.x - p.x) < 1e-6 && Math.abs(o.y - p.y) < CONGESTION.gap)) speed = CONGESTION.speed;
          const dist = Math.min(budget * speed, seg.len - p.segT);
          p.segT += dist; budget -= dist / speed;
          trips[p.trip].delay += (dist / speed) * (1 - speed / WALK_SPEED);
          const f = seg.len ? p.segT / seg.len : 1;
          p.x = seg.x0 + (seg.x1 - seg.x0) * f; p.y = seg.y0 + (seg.y1 - seg.y0) * f;
        }
        const done = seg.kind === 'wait' ? p.segT >= seg.dur - 1e-9 : p.segT >= seg.len - 1e-9;
        if (done) { p.si++; p.segT = 0; }
        else if (seg.kind === 'walk') break;   // slowed by congestion: re-check next step
      }
      if (p.si >= p.segs.length) {
        const end = t + DT - budget;
        const trip = trips[p.trip];
        trip.end = end;
        for (const i of trip.orders) { outcomes[i].done = end; outcomes[i].onTime = !outcomes[i].tomorrow && end <= opts.cutoff; left--; }
        p.trip = -1; p.x = dock.x; p.y = dock.y;
      }
    });
    t += DT; step++;
    if (t - t0 > 72 * 3600) throw new Error('shift did not finish');   // safety net (one picker on a peak can take >24 h)
  }

  const due = outcomes.filter(o => !o.tomorrow);
  return {
    trips, outcomes,
    tracks: samples.map(s => ({ t0, x: Float32Array.from(s.x), y: Float32Array.from(s.y), trip: Int32Array.from(s.trip) })),
    due: due.length, onTime: due.filter(o => o.onTime).length,
    lastDone: Math.max(...outcomes.map(o => o.done)),
    walked: trips.reduce((s, x) => s + x.dist, 0),
    avgWait: outcomes.reduce((s, o) => s + Math.max(0, o.start - o.arrive), 0) / n,
    congestionDelay: trips.reduce((s, x) => s + x.delay, 0),
  };
}

/** Position of a picker at time `t` (linear between samples) */
export function trackAt(tr: Track, t: number) {
  const f = Math.max(0, (t - tr.t0) / TRACK_EVERY);
  const i = Math.min(tr.x.length - 1, Math.floor(f)), j = Math.min(tr.x.length - 1, i + 1), u = f - Math.floor(f);
  return { x: tr.x[i] + (tr.x[j] - tr.x[i]) * u, y: tr.y[i] + (tr.y[j] - tr.y[i]) * u, trip: tr.trip[i] };
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const hhmm = `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  return s >= 24 * 3600 ? `${hhmm} (+1 day)` : hhmm;
};

/** Live counters at a moment of the shift */
export function shiftStats(r: ShiftResult, clock: number, cutoff: number) {
  let arrived = 0, waiting = 0, shipped = 0, onTime = 0, late = 0, tomorrow = 0;
  for (const o of r.outcomes) {
    if (o.arrive > clock) continue;
    arrived++;
    if (o.start > clock) waiting++;
    if (o.done <= clock) shipped++;
    if (o.tomorrow) tomorrow++;
    else if (o.onTime && o.done <= clock) onTime++;
    else if (!o.onTime && clock > cutoff) late++;
  }
  return { arrived, waiting, shipped, onTime, late, tomorrow };
}

/** On-time rating: 1 star from 80%, 2 from 90%, 3 from 97% (Megha's thresholds) */
export const shiftStars = (onTimeShare: number) => [0.8, 0.9, 0.97].filter(x => onTimeShare >= x).length;
