// Warehouse time rules (rules.ts)
import { describe, expect, it } from 'vitest';
import { RULES, accessTime, aisleDepth, handlingTime, pickTime } from './rules';
import type { Product } from './types';

const item = (fl: number, abc: Product['abc'] = 'C'): Product =>
  ({ id: 0, code: '00000', name: 'Test', picksTrain: 1, category: 'Christmas', price: 1, valueTrain: 1, abc, fl });
const midAisle = 4, aisleEnd = 0;   // slot 4: bay 4 (y = 6.9 m); slot 0: bay 0 (y = 2.1 m)

describe('time rules', () => {
  it('handling time rises with the forklift/handling level: FL7 takes longer than FL1', () => {
    for (let fl = 1; fl <= 7; fl++) expect(handlingTime(item(fl))).toBeGreaterThan(handlingTime(item(fl - 1)));
    expect(handlingTime(item(0))).toBe(RULES.handlingBase);
    expect(handlingTime(item(7))).toBe(RULES.handlingBase + 7 * RULES.handlingPerFl);
  });
  it('class A lines take longer than B, and B longer than C', () => {
    expect(handlingTime(item(2, 'A'))).toBeGreaterThan(handlingTime(item(2, 'B')));
    expect(handlingTime(item(2, 'B'))).toBeGreaterThan(handlingTime(item(2, 'C')));
  });
  it('forklift access only applies from FL4 and grows towards the middle of an aisle', () => {
    expect(accessTime(item(3), midAisle)).toBe(0);
    expect(accessTime(item(4), midAisle)).toBeGreaterThan(accessTime(item(4), aisleEnd));
    expect(aisleDepth(aisleEnd)).toBeCloseTo(2.1, 9);
  });
  it('hand-picked items take the same time on every slot', () => {
    for (let s = 0; s < 100; s++) expect(pickTime(item(2, 'A'), s)).toBe(handlingTime(item(2, 'A')));
  });
});
