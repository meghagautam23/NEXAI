// engine/rules.ts — placement rules from the product classifications (README, "Classifications")
//   Bulk items (handling level FL6-7: more than 17 units per order line on average, picked as cases or
//   pallets) may only sit in the front 3 bays of an aisle, next to the cross aisle, so pallet trucks never
//   drive deep into an aisle. Applies to every layout, swap and the optimizer.
//   ABC zones (optional, Challenge): the 20 slots nearest the dock are zone A, the next 30 zone B, the rest
//   zone C; each product stays in the zone of its velocity class. Bulk items are exempt (handling first).
import { BAYS, slotsByDock } from './geometry';
import type { Abc, Product } from './data';

export const BULK_FROM = 6;   // FL6 and FL7
export const FRONT_BAYS = 3;
export const ZONE_SIZES: Record<Abc, number> = { A: 20, B: 30, C: 50 };

export const isBulk = (p: Product) => p.fl >= BULK_FROM;
export const isFrontSlot = (slot: number) => slot % BAYS < FRONT_BAYS;

// zoneOf[slot]: by distance from the dock (ties by slot id, so zone boundaries never split a pick point)
export const zoneOf: Abc[] = (() => {
  const z: Abc[] = [];
  slotsByDock.forEach((slot, i) => (z[slot] = i < ZONE_SIZES.A ? 'A' : i < ZONE_SIZES.A + ZONE_SIZES.B ? 'B' : 'C'));
  return z;
})();

export type RuleOptions = { abcZones: boolean };

// Why product p may not go into slot, or null if it may
export function placementProblem(p: Product, slot: number, opts: RuleOptions): string | null {
  if (isBulk(p) && !isFrontSlot(slot))
    return `${p.name} is bulk (FL${p.fl}, ${p.unitsPerLine} units a line): front ${FRONT_BAYS} bays only`;
  if (opts.abcZones && !isBulk(p) && zoneOf[slot] !== p.abcVelocity)
    return `ABC zones on: class ${p.abcVelocity} items stay in zone ${p.abcVelocity}`;
  return null;
}

// Why swapping the products in slots a and b is not allowed, or null
export function swapProblem(products: Product[], productAt: readonly number[], a: number, b: number, opts: RuleOptions) {
  return placementProblem(products[productAt[a]], b, opts) ?? placementProblem(products[productAt[b]], a, opts);
}

export const violations = (products: Product[], assign: readonly number[], opts: RuleOptions) =>
  products.filter(p => placementProblem(p, assign[p.id], opts) !== null).length;
