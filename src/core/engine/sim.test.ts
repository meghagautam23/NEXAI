// Section 5.4 engine tests, run on the real data in public/data
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineLayout, originalLayout, samePickPoint, twinSlot } from './layouts';
import { D, DOCK } from './geometry';
import { pickTable } from './rules';
import { makeEngine, routeOrder, scoreLayout } from './sim';
import type { Orders, Product } from './types';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const orders = load<Orders>('orders.json');
const pick = pickTable(products);

describe('layouts (Section 5.3)', () => {
  const original = originalLayout(products), baseline = baselineLayout(products);
  it('are permutations of the 100 slots', () => {
    for (const a of [original, baseline]) expect([...a].sort((x, y) => x - y)).toEqual([...Array(100).keys()]);
  });
  it('Baseline walks less than Original on both train and test', () => {
    for (const split of ['train', 'test'] as const)
      expect(scoreLayout(orders[split], baseline, pick).totalDist).toBeLessThan(scoreLayout(orders[split], original, pick).totalDist);
  });
  it('Baseline puts the fastest mover in a slot nearest the dock', () => {
    const nearest = Math.min(...[...Array(100).keys()].map(s => D[DOCK][s]));
    expect(D[DOCK][baseline[0]]).toBe(nearest);
  });
});

describe('scoring (Section 5.4)', () => {
  const baseline = baselineLayout(products);
  it('scoring the same layout twice gives identical numbers', () => {
    expect(scoreLayout(orders.test, baseline, pick)).toEqual(scoreLayout(orders.test, baseline, pick));
  });
  it('routes start and end at the dock and visit every slot once', () => {
    const { path } = routeOrder([3, 47, 81, 12]);
    expect(path[0]).toBe(DOCK);
    expect(path.at(-1)).toBe(DOCK);
    expect([...path.slice(1, -1)].sort((a, b) => a - b)).toEqual([3, 12, 47, 81]);
  });
  it('swapDelta then commit gives the same total as a full rescore', () => {
    const eng = makeEngine(orders.train, [...baseline], pick);
    let total = eng.stats().totalTime, dist = eng.stats().totalDist;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) % 100;
    for (let k = 0; k < 200; k++) {
      const p1 = rnd(), p2 = rnd();
      if (p1 === p2) continue;
      const s = eng.swapDelta(p1, p2);
      if (k % 3 !== 0) { s.commit(); total += s.delta; dist += s.dDist; }   // every third preview is dropped
    }
    expect(eng.stats().totalTime).toBeCloseTo(total, 6);
    expect(scoreLayout(orders.train, eng.assign, pick).totalTime).toBeCloseTo(total, 6);
    expect(scoreLayout(orders.train, eng.assign, pick).totalDist).toBeCloseTo(dist, 6);
  });
  it('a swap preview leaves the layout and the scores untouched until committed', () => {
    const eng = makeEngine(orders.train, [...baseline], pick);
    const before = [...eng.assign], stats = eng.stats();
    eng.swapDelta(0, 50);
    expect(eng.assign).toEqual(before);
    expect(eng.stats()).toEqual(stats);
    expect(eng.productAt[eng.assign[0]]).toBe(0);
  });
  it('swapping the left/right slots of one bay changes nothing (Section 7.3)', () => {
    const eng = makeEngine(orders.test, [...baseline], pick);
    const p1 = 0, slot = eng.assign[p1], p2 = eng.assign.indexOf(twinSlot(slot));
    expect(samePickPoint(slot, twinSlot(slot))).toBe(true);
    const s = eng.swapDelta(p1, p2);
    expect(s.delta).toBeCloseTo(0, 9);
    expect(s.dDist).toBeCloseTo(0, 9);
  });
});
