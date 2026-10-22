// engine/layouts.ts — the Original and Baseline layouts (Plan v2, Section 5.3)
// Both return assign: productId -> slotId and obey the heavy-item rule (engine/rules.ts).
import { slotsByDock } from './geometry';
import type { Product } from './data';
import { isFrontSlot, isHeavy, zoneOf } from './rules';

export { slotsByDock };

const byCode = (a: Product, b: Product) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.id - b.id);

// "As received": products in StockCode order fill slots 0..99. Deterministic and explainable.
// Then each heavy item outside the front bays trades places with the light item in the
// lowest-numbered front slot, so even the unplanned layout is safe.
export function originalLayout(products: Product[]): number[] {
  const assign: number[] = Array(products.length);
  [...products].sort(byCode).forEach((p, i) => (assign[p.id] = i));
  const productAt: number[] = [];
  assign.forEach((s, p) => (productAt[s] = p));
  for (const p of products) {
    if (!isHeavy(p) || isFrontSlot(assign[p.id])) continue;
    const s = productAt.findIndex((q, slot) => isFrontSlot(slot) && !isHeavy(products[q]));
    const q = productAt[s], from = assign[p.id];
    assign[p.id] = s; assign[q] = from; productAt[s] = p.id; productAt[from] = q;
  }
  return assign;
}

// Required baseline: fast movers (train-week picks) get the slots nearest the dock, within the rules.
// Heavy items first take the nearest front slot of their velocity zone; then every other product takes
// the nearest free slot of its zone. Zone sizes equal class sizes, so the result also keeps ABC zones.
export function baselineLayout(products: Product[]): number[] {
  const assign: number[] = Array(products.length);
  const free = new Set(slotsByDock);
  const take = (p: Product, ok: (slot: number) => boolean) => {
    const slot = slotsByDock.find(s => free.has(s) && ok(s)) ?? slotsByDock.find(s => free.has(s))!;
    assign[p.id] = slot; free.delete(slot);
  };
  const ranked = [...products].sort((a, b) => b.picksTrain - a.picksTrain || a.id - b.id);
  for (const p of ranked.filter(isHeavy))
    take(p, s => isFrontSlot(s) && zoneOf[s] === p.abcVelocity);
  for (const p of ranked.filter(p => !isHeavy(p)))
    take(p, s => zoneOf[s] === p.abcVelocity);
  return assign;
}

// Left (side 0) and right (side 1) slots of one bay share a pick point: swapping them changes nothing
export const samePickPoint = (s1: number, s2: number) =>
  s1 !== s2 && Math.floor(s1 / 20) === Math.floor(s2 / 20) && s1 % 10 === s2 % 10;
