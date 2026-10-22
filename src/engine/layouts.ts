// engine/layouts.ts — the Original and Baseline layouts (Plan v2, Section 5.3)
// Both return assign: productId -> slotId.
import { D, DOCK } from './geometry';
import type { Product } from './data';

const SLOTS = 100;

// "As received": products in StockCode order fill slots 0..99. Deterministic and explainable.
export function originalLayout(products: Product[]): number[] {
  const assign: number[] = Array(products.length);
  [...products]
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.id - b.id))
    .forEach((p, i) => (assign[p.id] = i));
  return assign;
}

// Slots nearest the dock first; ties by slot id so the Baseline is identical on every run
export const slotsByDock = [...Array(SLOTS).keys()].sort((a, b) => D[DOCK][a] - D[DOCK][b] || a - b);

// Required baseline: fast movers (train-week picks) get the slots nearest the dock
export function baselineLayout(products: Product[]): number[] {
  const assign: number[] = Array(products.length);
  [...products]
    .sort((a, b) => b.picksTrain - a.picksTrain || a.id - b.id)
    .forEach((p, i) => (assign[p.id] = slotsByDock[i]));
  return assign;
}

// Left (side 0) and right (side 1) slots of one bay share a pick point: swapping them changes nothing
export const samePickPoint = (s1: number, s2: number) =>
  s1 !== s2 && Math.floor(s1 / 20) === Math.floor(s2 / 20) && s1 % 10 === s2 % 10;
