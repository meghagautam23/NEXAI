// The three layouts (Plan v2, Section 5.3) and slot helpers
import { D, DOCK, pts } from './geometry';
import type { Affinity, Product } from './types';

// Original: products sorted by StockCode fill slots 0..99 in order ("as received")
export function originalLayout(products: Product[]): number[] {
  const assign: number[] = Array(100);
  [...products].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.id - b.id))
    .forEach((p, i) => (assign[p.id] = i));
  return assign;
}

// Baseline: fastest movers get the slots nearest the dock (ties by slot ID / product ID)
export const slotsByDock = [...Array(100).keys()].sort((a, b) => D[DOCK][a] - D[DOCK][b] || a - b);
export function baselineLayout(products: Product[]): number[] {
  const byPicks = [...products].sort((a, b) => b.picksTrain - a.picksTrain || a.id - b.id);
  const baseline: number[] = Array(100);
  byPicks.forEach((p, i) => (baseline[p.id] = slotsByDock[i]));
  return baseline;
}

// Left and right slots of the same bay share a pick point (Section 4)
export const twinSlot = (s: number) => (Math.floor(s / 10) % 2 === 0 ? s + 10 : s - 10);
export const samePickPoint = (a: number, b: number) =>
  pts[a].aisle === pts[b].aisle && pts[a].y === pts[b].y;

export const productAt = (assign: number[]) => {
  const at: number[] = Array(100);
  assign.forEach((s, p) => (at[s] = p));
  return at;
};

// Slots ordered by walking distance from each slot (excluding itself), for nearestProductTo
export const slotNeighbours: number[][] = [...Array(100).keys()].map(s =>
  [...Array(100).keys()].filter(t => t !== s).sort((a, b) => D[s][a] - D[s][b] || a - b));

// Product in the slot physically closest to product q's slot (Section 8 helper)
export function nearestProductTo(q: number, assign: number[]): number {
  const at = productAt(assign);
  return at[slotNeighbours[assign[q]][0]];
}

// Top-k affinity partners per product, strongest first
export function partnersOf(affinity: Affinity, k = Infinity): number[][] {
  const out: number[][] = Array.from({ length: 100 }, () => []);
  for (const [a, b] of affinity) {
    if (out[a].length < k) out[a].push(b);
    if (out[b].length < k) out[b].push(a);
  }
  return out;
}
