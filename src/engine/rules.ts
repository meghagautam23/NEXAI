// engine/rules.ts — placement rules from the product classifications (README, "Classifications")
//   Heavy items (estimated FL05 and above, >= 1 kg) may only sit in the front 3 bays of an aisle, so heavy
//   loads are carried the shortest way. Applies to every layout, swap and the optimizer.
//   ABC zones (optional, Challenge): the 20 slots nearest the dock are zone A, the next 30 zone B, the rest
//   zone C; each product stays in the zone of its velocity class. Heavy items are exempt (safety first).
import { BAYS, slotsByDock } from './geometry';
import type { Abc, Product } from './data';

export const HEAVY_FROM = 'FL05';
export const HEAVY_BAYS = 3;
export const ZONE_SIZES: Record<Abc, number> = { A: 20, B: 30, C: 50 };

export const isHeavy = (p: Product) => p.weightClass >= HEAVY_FROM; // FL05..FL07 sort as strings
export const isFrontSlot = (slot: number) => slot % BAYS < HEAVY_BAYS;

// zoneOf[slot]: by distance from the dock (ties by slot id, so zone boundaries never split a pick point)
export const zoneOf: Abc[] = (() => {
  const z: Abc[] = [];
  slotsByDock.forEach((slot, i) => (z[slot] = i < ZONE_SIZES.A ? 'A' : i < ZONE_SIZES.A + ZONE_SIZES.B ? 'B' : 'C'));
  return z;
})();

export type RuleOptions = { abcZones: boolean };

// Why product p may not go into slot, or null if it may
export function placementProblem(p: Product, slot: number, opts: RuleOptions): string | null {
  if (isHeavy(p) && !isFrontSlot(slot))
    return `${p.name} is heavy (${p.weightClass}, est. ${p.weightKg} kg): front ${HEAVY_BAYS} bays only`;
  if (opts.abcZones && !isHeavy(p) && zoneOf[slot] !== p.abcVelocity)
    return `ABC zones on: class ${p.abcVelocity} items stay in zone ${p.abcVelocity}`;
  return null;
}

// Why swapping the products in slots a and b is not allowed, or null
export function swapProblem(products: Product[], productAt: readonly number[], a: number, b: number, opts: RuleOptions) {
  return placementProblem(products[productAt[a]], b, opts) ?? placementProblem(products[productAt[b]], a, opts);
}

export const violations = (products: Product[], assign: readonly number[], opts: RuleOptions) =>
  products.filter(p => placementProblem(p, assign[p.id], opts) !== null).length;
