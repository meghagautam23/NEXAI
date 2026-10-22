// Batch picking: every order picked exactly once, cart limits respected, and the saving is real
// (ported from Megha Gautam's tests; times include handling and forklift access).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { batchLength, makeBatches, scoreBatches, scoreBatching, type BatchPolicy } from './batching';
import { baselineLayout } from './layouts';
import { pickTable } from './rules';
import { scoreLayout } from './sim';
import type { Orders, Product } from './types';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const orders = load<Orders>('orders.json').test;
const pick = pickTable(products);
const base = baselineLayout(products);
const lines = (i: number) => orders[i].lines.length;

describe.each<BatchPolicy>(['fcfs', 'proximity'])('%s batching', policy => {
  const batches = makeBatches(orders, base, { size: 4, maxLines: 40, policy });
  it('picks every order exactly once', () => {
    expect(batches.flat().sort((a, b) => a - b)).toEqual(orders.map((_, i) => i));
  });
  it('respects cart size, line capacity and picking days', () => {
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(4);
      if (b.length > 1) expect(b.reduce((n, i) => n + lines(i), 0)).toBeLessThanOrEqual(40);
      expect(new Set(b.map(i => orders[i].t.slice(0, 10))).size).toBe(1);
    }
  });
  it('walks and takes less time than single-order picking', () => {
    const s = scoreBatches(orders, batches, base, pick), single = scoreLayout(orders, base, pick);
    expect(s.totalDist).toBeLessThan(single.totalDist);
    expect(s.totalTime).toBeLessThan(single.totalTime);
  });
});

describe('batch scoring', () => {
  it('a cart of one is single-order picking', () => {
    const one = scoreBatching(orders, base, pick, { size: 1, maxLines: Infinity, policy: 'fcfs' });
    const single = scoreLayout(orders, base, pick);
    expect(one.trips).toBe(orders.length);
    expect(one.totalDist).toBeCloseTo(single.totalDist, 6);
    expect(one.totalTime).toBeCloseTo(single.totalTime, 6);
  });
  it('proximity batching beats first-come batching at every cart size', () => {
    for (const size of [2, 3, 4, 5])
      expect(scoreBatching(orders, base, pick, { size, maxLines: 40, policy: 'proximity' }).totalDist)
        .toBeLessThan(scoreBatching(orders, base, pick, { size, maxLines: 40, policy: 'fcfs' }).totalDist);
  });
  it('a batch trip is never longer than its orders walked separately', () => {
    for (const b of makeBatches(orders, base, { size: 4, maxLines: 40, policy: 'proximity' }).slice(0, 50))
      expect(batchLength(orders, b, base)).toBeLessThanOrEqual(b.reduce((d, i) => d + batchLength(orders, [i], base), 0) + 1e-9);
  });
});
