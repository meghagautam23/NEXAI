// Challenge rules: planning previews, hidden score until submit, swap limit, undo, blocked swaps
// (in the spirit of Megha Gautam's store tests).
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { REPLAY_ORDERS, type GameData } from '../../core/data';
import { baselineLayout, originalLayout, partnersOf, twinSlot } from '../../core/engine/layouts';
import { pickTable } from '../../core/engine/rules';
import type { Affinity, Orders, Product } from '../../core/engine/types';
import { MAX_SWAPS, useGame } from './gameStore';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../../public/data/${f}`, import.meta.url), 'utf8'));
const products = load<Product[]>('products.json');
const orders = load<Orders>('orders.json');
const affinity = load<Affinity>('affinity.json');
const data: GameData = {
  products, orders, affinity, partners: partnersOf(affinity), topPartners: partnersOf(affinity, 3),
  minPicks: 0, maxPicks: 1, originalAssign: originalLayout(products), baselineAssign: baselineLayout(products),
  sample: orders.test.slice(0, REPLAY_ORDERS), pick: pickTable(products),
};
const g = () => useGame.getState();
const slotsNotTwins = (k: number) => { const out: number[] = []; for (let s = 0; out.length < k; s++) if (!out.some(o => twinSlot(o) === s)) out.push(s); return out; };

describe('challenge', () => {
  beforeEach(() => { useGame.setState({ data: null, mode: 'challenge', abcZones: false }); g().init(data); });

  it('starts from the baseline and previews swaps on the planning weeks', () => {
    expect(g().assign).toEqual(data.baselineAssign);
    g().clickSlot(0); g().hoverSlot(55);
    expect(g().preview).not.toBeNull();
    expect(g().assign).toEqual(data.baselineAssign);   // preview never changes the layout
  });

  it('allows 10 swaps, undo gives one back, then submit reveals the score', () => {
    const s = slotsNotTwins(2 * MAX_SWAPS + 2);
    for (let k = 0; k < MAX_SWAPS; k++) { g().clickSlot(s[2 * k]); g().clickSlot(s[2 * k + 1]); }
    expect(g().history).toHaveLength(MAX_SWAPS);
    const before = [...g().assign];
    g().clickSlot(s[20]); g().clickSlot(s[21]);
    expect(g().assign).toEqual(before);                 // no swaps left
    g().undo();
    expect(g().history).toHaveLength(MAX_SWAPS - 1);
    expect(g().submitted).toBe(false);
    g().submit();
    expect(g().submitted).toBe(true);
    g().clickSlot(s[0]);
    expect(g().selected).toBeNull();                    // no changes after submitting
  });

  it('a same-pick-point swap uses no swap', () => {
    g().clickSlot(0); g().clickSlot(twinSlot(0));
    expect(g().history).toHaveLength(0);
  });

  it('ABC zones block swaps across zones and say why', () => {
    g().setAbcZones(true);
    const a = data.baselineAssign[0], c = data.baselineAssign[99];   // fastest and slowest mover
    g().clickSlot(a); g().hoverSlot(c);
    expect(g().blocked).toMatch(/ABC zones/);
    g().clickSlot(c);
    expect(g().history).toHaveLength(0);
  });

  it('runs AI Suggest synchronously without workers and explains its moves', () => {
    useGame.setState(s => ({ ai: { ...s.ai, plan: 'balanced' } }));
    g().runAI();
    const r = g().ai.result!;
    expect(r.moves.length).toBeGreaterThan(0);
    expect(r.test.totalTime).toBeLessThan(g().ref!.test.baseline.totalTime);
  }, 60000);
});
