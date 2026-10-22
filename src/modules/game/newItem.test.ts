// New product (cold start): look-alikes, a valid what-if copy, and slot options that are really tested
// (in the spirit of Megha Gautam's newItem tests).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryFor } from '../../core/categories';
import { REPLAY_ORDERS, type GameData } from '../../core/data';
import { baselineLayout, originalLayout, partnersOf } from '../../core/engine/layouts';
import { pickTable } from '../../core/engine/rules';
import { makeEngine } from '../../core/engine/sim';
import type { Affinity, Orders, Product } from '../../core/engine/types';
import { analoguesOf, planNewItem } from './newItem';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const orders = load<Orders>('orders.json');
const affinity = load<Affinity>('affinity.json');
const data: GameData = {
  products, orders, affinity, partners: partnersOf(affinity), topPartners: partnersOf(affinity, 3), minPicks: 0, maxPicks: 1,
  originalAssign: originalLayout(products), baselineAssign: baselineLayout(products),
  sample: orders.test.slice(0, REPLAY_ORDERS), pick: pickTable(products),
};

describe('category rules', () => {
  it('the TypeScript copy matches preprocess.py for every product', () => {
    for (const p of products) expect(categoryFor(p.name), p.name).toBe(p.category);
  });
});

describe('planNewItem', () => {
  const plan = planNewItem(data, data.baselineAssign, 'Jumbo Bag Woodland Animals');
  it('finds look-alikes from the same collection or type', () => {
    expect(analoguesOf('Jumbo Bag Woodland Animals', products).map(a => products[a.product].name).join(' ')).toMatch(/Jumbo Bag/);
    expect(plan.item.category).toBe('Bags & storage');
    expect(plan.predictedPicks).toBeGreaterThan(0);
  });
  it('sends the slowest mover to reserve and builds a consistent what-if copy', () => {
    const slowest = Math.min(...products.map(p => p.picksTrain));
    expect(products[plan.retire].picksTrain).toBe(slowest);
    expect(plan.world.products[plan.retire].name).toBe('Jumbo Bag Woodland Animals');
    const lines = plan.world.orders.train.flatMap(o => o.lines).filter(l => l.p === plan.retire).length;
    expect(lines).toBe(plan.predictedPicks);
    expect(plan.world.orders.train.every(o => o.lines.length > 0)).toBe(true);
  });
  it('ranks slots by real simulated time, best first', () => {
    const best = plan.options[0];
    const eng = makeEngine(plan.world.orders.train, best.assign, plan.world.pick);
    const freed = makeEngine(plan.world.orders.train, data.baselineAssign, plan.world.pick);
    expect(eng.stats().totalTime - freed.stats().totalTime).toBeCloseTo(best.delta, 6);
    expect(best.delta).toBeLessThanOrEqual(0);
    for (let i = 1; i < plan.options.length; i++) expect(plan.options[i].delta).toBeGreaterThanOrEqual(plan.options[i - 1].delta);
  });
  it('lets the user set the handling level', () => {
    expect(planNewItem(data, data.baselineAssign, 'Regency Cakestand 2 Tier', 7).item.fl).toBe(7);
  });
});
