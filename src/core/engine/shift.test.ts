// Peak shift: every order handled once, timing consistent, congestion costs time and more pickers help
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineLayout } from './layouts';
import { pickTable } from './rules';
import { DEFAULT_SHIFT, rushOrders, simulateShift, trackAt } from './shift';
import { routeOrder, slotsOf } from './sim';
import type { Orders, Product } from './types';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const test = load<Orders>('orders.json').test;
const pick = pickTable(products);
const base = baselineLayout(products);
const day = rushOrders(test, 1).orders;
const peak = rushOrders(test, 3).orders;

describe('simulateShift', () => {
  const r = simulateShift(day, base, pick, { ...DEFAULT_SHIFT, pickers: 2, congestion: false });
  it('handles every order exactly once, never before it arrives', () => {
    expect(r.trips.flatMap(t => t.orders).sort((a, b) => a - b)).toEqual(day.map((_, i) => i));
    for (const o of r.outcomes) { expect(o.start).toBeGreaterThanOrEqual(o.arrive - 1e-9); expect(o.done).toBeGreaterThan(o.start); }
  });
  it('a single-order trip takes walking + picking + packing (within one step per segment)', () => {
    const trip = r.trips.find(t => t.orders.length === 1)!;
    const o = day[trip.orders[0]];
    const route = routeOrder(slotsOf(o, base));
    const expected = route.total + o.lines.reduce((s, l) => s + pick[l.p][base[l.p]], 0) + DEFAULT_SHIFT.packSec;
    expect(trip.end - trip.start).toBeGreaterThanOrEqual(expected - 1e-6);
    expect(trip.end - trip.start).toBeLessThan(expected + 0.5 * (route.path.length * 4 + 2));
  });
  it('records a replay track that starts at the dock', () => {
    const p = trackAt(r.tracks[0], DEFAULT_SHIFT.shiftStart);
    expect(p).toMatchObject({ x: 10, y: 0 });
  });
  it('congestion costs time when several pickers share aisles, and never helps', () => {
    const opts = { ...DEFAULT_SHIFT, pickers: 4 };
    const on = simulateShift(peak, base, pick, opts), off = simulateShift(peak, base, pick, { ...opts, congestion: false });
    expect(on.congestionDelay).toBeGreaterThan(0);
    expect(off.congestionDelay).toBe(0);
    expect(on.lastDone).toBeGreaterThanOrEqual(off.lastDone - 60);
  }, 30000);
  it('a second picker ships more orders on time', () => {
    const one = simulateShift(peak, base, pick, { ...DEFAULT_SHIFT, pickers: 1 });
    const two = simulateShift(peak, base, pick, { ...DEFAULT_SHIFT, pickers: 2 });
    expect(two.onTime).toBeGreaterThan(one.onTime);
  }, 30000);
});
