// AI Suggest: rules, hold-out, determinism, explanations and the business case
// (ported from Megha Gautam's branch; scored in seconds of picking time).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineLayout, partnersOf } from '../../core/engine/layouts';
import { pickTable, placementProblem, zoneOf, velocityOf } from '../../core/engine/rules';
import { makeEngine, scoreLayout } from '../../core/engine/sim';
import type { Affinity, Orders, Product } from '../../core/engine/types';
import { explainMoves, impact, pickingDays } from './insights';
import { movedProducts, optimize, penaltyFor, prune } from './optimizer';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const orders = load<Orders>('orders.json');
const affinity = load<Affinity>('affinity.json');
const pick = pickTable(products);
const base = baselineLayout(products);
const partners = partnersOf(affinity, 5);
const run = (o: Partial<Parameters<typeof optimize>[0]> = {}) =>
  optimize({ products, orders: orders.train, pick, partners, start: base, rules: { abcZones: false }, iterations: 4000, seed: 3, ...o });
const isPermutation = (a: number[]) => [...a].sort((x, y) => x - y).every((s, i) => s === i);
const violations = (assign: number[]) => products.filter(p => placementProblem(p, assign[p.id], { abcZones: true })).length;

describe('optimize', () => {
  const r = run();
  it('returns a valid layout that is faster on the train weeks than the Baseline', () => {
    expect(isPermutation(r.assign)).toBe(true);
    expect(r.best).toBeLessThan(r.start);
    expect(scoreLayout(orders.train, r.assign, pick).totalTime).toBeCloseTo(r.best, 6);
  });
  it('keeps ABC zones when asked', () => {
    const z = run({ rules: { abcZones: true }, start: products.map(p => {   // a zone-respecting start
      const slots = [...Array(100).keys()].filter(s => zoneOf[s] === velocityOf(p));
      return slots[products.filter(q => velocityOf(q) === velocityOf(p) && q.id < p.id).length];
    }) });
    expect(violations(z.assign)).toBe(0);
  });
  it('is repeatable for a given seed', () => {
    expect(run().assign).toEqual(r.assign);
  });
  it('moves fewer products as the move penalty grows', () => {
    const free = movedProducts(base, r.assign).length;
    expect(movedProducts(base, run({ movePenalty: 150 }).assign).length).toBeLessThan(free);
    expect(movedProducts(base, run({ movePenalty: 1e6 }).assign)).toEqual([]);
  });
  it('generalises: the train-tuned layout also beats the Baseline on the unseen test week', () => {
    const long = run({ iterations: 20000 });
    expect(scoreLayout(orders.test, long.assign, pick).totalTime).toBeLessThan(scoreLayout(orders.test, base, pick).totalTime);
  }, 30000);
});

describe('prune', () => {
  it('only undoes moves that do not cost time', () => {
    const r = run({ iterations: 2000 });
    const p = prune(products, orders.train, pick, base, r.assign, { abcZones: false });
    expect(scoreLayout(orders.train, p.assign, pick).totalTime).toBeLessThanOrEqual(scoreLayout(orders.train, r.assign, pick).totalTime + 1e-6);
    expect(movedProducts(base, p.assign).length).toBeLessThanOrEqual(movedProducts(base, r.assign).length);
  });
});

describe('explainMoves', () => {
  it('explains every moved product, strongest saving first', () => {
    const r = run();
    const moves = explainMoves(products, affinity, makeEngine(orders.train, r.assign, pick), base);
    expect(moves.map(m => m.product).sort((a, b) => a - b)).toEqual(movedProducts(base, r.assign));
    moves.forEach((m, i) => {
      expect(m.reason.length).toBeGreaterThan(10);
      expect(m.from).toBe(base[m.product]); expect(m.to).toBe(r.assign[m.product]);
      if (i) expect(m.saving).toBeLessThanOrEqual(moves[i - 1].saving);
    });
    expect(moves[0].saving).toBeGreaterThan(0);
  });
});

describe('business case', () => {
  it('converts seconds to hours and pounds, and re-slotting labour to a payback period', () => {
    const x = impact(3600 * 8, 8, 30, { costPerHour: 15, minutesPerMove: 10, daysPerYear: 250 });
    expect(x.hoursPerDay).toBeCloseTo(1);
    expect(x.poundsPerYear).toBeCloseTo(250 * 15);
    expect(x.reslotHours).toBeCloseTo(5);
    expect(x.paybackDays).toBeCloseTo(5);
    expect(impact(0, 8, 3, { costPerHour: 15, minutesPerMove: 10, daysPerYear: 250 }).paybackDays).toBe(Infinity);
    expect(penaltyFor(10, 18, 18)).toBe(600);
  });
  it('counts picking days, not calendar days', () => {
    expect(pickingDays(orders.test)).toBe(8);
    expect(pickingDays(orders.train)).toBeGreaterThan(15);
  });
});
