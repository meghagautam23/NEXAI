// Why AI Suggest moved each product, and what the change is worth (ported from Megha Gautam's branch,
// in seconds of picking time, with forklift-access reasons for FL4+ items).
import { D, DOCK } from '../../core/engine/geometry';
import { RULES, aisleDepth } from '../../core/engine/rules';
import type { Engine } from '../../core/engine/sim';
import type { Affinity, Order, Product } from '../../core/engine/types';

export type Move = {
  product: number;
  from: number; to: number;   // slots
  saving: number;             // train-week seconds this move is worth (what undoing it alone would cost)
  reason: string;
};

/** `eng` must hold the AFTER layout on the train orders */
export function explainMoves(products: Product[], affinity: Affinity, eng: Engine, before: readonly number[]): Move[] {
  const after = eng.assign;
  const together = new Map<number, [number, number][]>();   // product -> [partner, orders together]
  for (const [a, b, n] of affinity) {
    if (!together.has(a)) together.set(a, []);
    if (!together.has(b)) together.set(b, []);
    together.get(a)!.push([b, n]); together.get(b)!.push([a, n]);
  }
  const moves: Move[] = [];
  for (const p of products) {
    const from = before[p.id], to = after[p.id];
    if (from === to) continue;
    const saving = eng.swapDelta(p.id, eng.productAt[from]).delta;   // seconds; layout untouched
    let best: { q: number; n: number; was: number; now: number; gain: number } | null = null;
    for (const [q, n] of together.get(p.id) ?? []) {
      const was = D[from][before[q]], now = D[to][after[q]], gain = n * (was - now);
      if (gain > 0 && (!best || gain > best.gain)) best = { q, n, was, now, gain };
    }
    const forklift = p.fl >= RULES.forkliftFrom && aisleDepth(to) < aisleDepth(from) - 1e-9;
    const reason = forklift
      ? `Forklift item (FL${p.fl}): now ${aisleDepth(to).toFixed(1)} m into its aisle (was ${aisleDepth(from).toFixed(1)} m), so ${(RULES.accessPerMetre * (aisleDepth(from) - aisleDepth(to))).toFixed(0)} s less per pick`
      : best
        ? `Now ${best.now.toFixed(1)} m from ${products[best.q].name} (was ${best.was.toFixed(1)} m): bought together in ${best.n} orders`
        : D[DOCK][to] < D[DOCK][from]
          ? `Closer to the dock: ${D[DOCK][from].toFixed(1)} m → ${D[DOCK][to].toFixed(1)} m`
          : 'Gave up its slot to a product that saves more there';
    moves.push({ product: p.id, from, to, saving, reason });
  }
  return moves.sort((a, b) => b.saving - a.saving || a.product - b.product);
}

// Business case. The defaults are assumptions, shown and editable in the UI.
export type Assumptions = { costPerHour: number; minutesPerMove: number; daysPerYear: number };
export const DEFAULT_ASSUMPTIONS: Assumptions = { costPerHour: 15, minutesPerMove: 10, daysPerYear: 250 };

export type Impact = {
  hoursPerDay: number; hoursPerYear: number; poundsPerYear: number;
  reslotHours: number; reslotCost: number; paybackDays: number;
};

export function impact(savedSeconds: number, days: number, moves: number, a: Assumptions): Impact {
  const hoursPerDay = Math.max(0, savedSeconds) / days / 3600;
  const reslotHours = (moves * a.minutesPerMove) / 60;
  return {
    hoursPerDay, hoursPerYear: hoursPerDay * a.daysPerYear, poundsPerYear: hoursPerDay * a.daysPerYear * a.costPerHour,
    reslotHours, reslotCost: reslotHours * a.costPerHour,
    paybackDays: hoursPerDay > 0 ? reslotHours / hoursPerDay : Infinity,
  };
}

/** Days on which orders were picked (the retailer did not trade every day) */
export const pickingDays = (orders: Order[]) => new Set(orders.map(o => o.t.slice(0, 10))).size;
