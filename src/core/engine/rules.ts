// Warehouse time rules for Holly & Ivy Gifts. Shown in the UI; every module scores with these.
import { D, DOCK, L, pts } from './geometry';
import type { Product } from './types';

export const RULES = {
  walkSpeed: 1.0,                               // m/s
  handlingBase: 6,                              // s per order line, picked by hand (FL0)
  handlingPerFl: 4,                             // s per forklift/handling level: FL7 = 6 + 28 = 34 s
  classCheck: { A: 5, B: 2, C: 0 } as const,    // s per line: scan and seal for valuable stock
  forkliftFrom: 4,                              // FL4 and up needs a forklift in the aisle
  accessPerMetre: 2,                            // s per metre between the slot and the nearest cross aisle
};

export type Abc = keyof typeof RULES.classCheck;

/** Handling time for one line of a product: the same on every layout. */
export const handlingTime = (p: Product) =>
  RULES.handlingBase + RULES.handlingPerFl * p.fl + RULES.classCheck[p.abc];

/** Metres from a slot's pick point to the nearest cross aisle (front y = 0, back y = L). */
export const aisleDepth = (slot: number) => Math.min(pts[slot].y, L - pts[slot].y);

/** Extra time for forklift items to drive into the aisle and back out: depends on the slot. */
export const accessTime = (p: Product, slot: number) =>
  p.fl >= RULES.forkliftFrom ? RULES.accessPerMetre * aisleDepth(slot) : 0;

export const pickTime = (p: Product, slot: number) => handlingTime(p) + accessTime(p, slot);

/** pick[productId][slotId] = seconds to pick one line of that product from that slot. */
export const pickTable = (products: Product[]): number[][] =>
  products.map(p => Array.from({ length: 100 }, (_, s) => pickTime(p, s)));

// ---- Optional placement rule: ABC zones (Challenge setting; ported from Megha Gautam's branch) ----
// Velocity class: A = top 20 products by train-week picks, B = next 30, C = last 50 (products.json is in
// pick-rank order). Zone A = the 20 slots nearest the dock, B = the next 30, C = the rest.
export type Zone = 'A' | 'B' | 'C';
export const velocityOf = (p: Product): Zone => (p.id < 20 ? 'A' : p.id < 50 ? 'B' : 'C');
export const zoneOf: Zone[] = (() => {
  const bySlot = [...Array(100).keys()].sort((a, b) => D[DOCK][a] - D[DOCK][b] || a - b);
  const z: Zone[] = [];
  bySlot.forEach((slot, i) => (z[slot] = i < 20 ? 'A' : i < 50 ? 'B' : 'C'));
  return z;
})();

export type RuleOptions = { abcZones: boolean };
export const NO_RULES: RuleOptions = { abcZones: false };

/** Why product p may not go into slot, or null if it may */
export function placementProblem(p: Product, slot: number, opts: RuleOptions): string | null {
  if (opts.abcZones && zoneOf[slot] !== velocityOf(p))
    return `ABC zones on: ${velocityOf(p)} movers stay in zone ${velocityOf(p)}`;
  return null;
}

/** Why swapping the products in slots a and b is not allowed, or null */
export const swapProblem = (products: Product[], productAt: readonly number[], a: number, b: number, opts: RuleOptions) =>
  placementProblem(products[productAt[a]], b, opts) ?? placementProblem(products[productAt[b]], a, opts);
