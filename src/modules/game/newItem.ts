// Slotting a NEW product with no pick history (cold start), ported from Megha Gautam's branch:
//   1. Look-alikes: products whose names share words (collection and type) or category predict how often it
//      will be picked, which orders it joins, its cost class and its handling level (FL).
//   2. Make room: the floor is full, so the slowest mover goes to reserve storage.
//   3. Every slot is tried with the real simulator on the train weeks (in seconds, with the time rules); the
//      best few are recommended. Placing the item builds a what-if copy of the data with it in.
import { categoryFor } from '../../core/categories';
import { REPLAY_ORDERS, type GameData } from '../../core/data';
import { AISLES, BAYS, D } from '../../core/engine/geometry';
import { partnersOf } from '../../core/engine/layouts';
import { pickTable } from '../../core/engine/rules';
import { makeEngine } from '../../core/engine/sim';
import type { Affinity, Order, Product } from '../../core/engine/types';

const STOP = new Set(['SET', 'OF', 'THE', 'AND', 'BOX', 'PACK', 'IN', 'WITH', 'DESIGN', 'ASSORTED', 'COLOUR', 'SMALL', 'LARGE', 'MINI']);
export const tokens = (name: string) => new Set(
  name.toUpperCase().replace(/[^A-Z0-9' ]+/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)));

/** Shared words (Jaccard) plus a bonus for the same category */
export function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  const shared = [...A].filter(t => B.has(t)).length;
  const union = new Set([...A, ...B]).size || 1;
  const ca = categoryFor(a), same = ca === categoryFor(b) && ca !== 'Gifts & gadgets';
  return Math.min(1, shared / union + (same ? 0.25 : 0));
}

export type Analogue = { product: number; similarity: number };
export function analoguesOf(name: string, products: Product[], k = 3): Analogue[] {
  return products.map(p => ({ product: p.id, similarity: similarity(name, p.name) }))
    .filter(a => a.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || a.product - b.product)
    .slice(0, k);
}

// Orders the new item joins: those containing its look-alikes, strongest match first, up to the predicted picks
function joiningOrders(orders: Order[], analogues: Analogue[], target: number): number[] {
  const sim = new Map(analogues.map(a => [a.product, a.similarity]));
  return orders
    .map((o, i) => ({ i, score: o.lines.reduce((s, l) => s + (sim.get(l.p) ?? 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, Math.max(0, Math.round(target)))
    .map(x => x.i)
    .sort((a, b) => a - b);
}

/** Affinity pairs from orders, as preprocess.py builds them */
export function affinityFrom(orders: Order[], top = 500): Affinity {
  const pairs = new Map<string, number>();
  for (const o of orders) {
    const ps = [...new Set(o.lines.map(l => l.p))].sort((a, b) => a - b);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const k = `${ps[i]},${ps[j]}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  return [...pairs].map(([k, n]) => [...k.split(',').map(Number), n] as [number, number, number])
    .sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]).slice(0, top);
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
const vote = <T,>(xs: T[], fallback: T): T => (xs.length ? [...xs].sort((a, b) => xs.filter(x => x === b).length - xs.filter(x => x === a).length)[0] : fallback);

export type SlotOption = {
  slot: number; aisle: number; bay: number;
  delta: number;          // train-week seconds vs putting it straight into the freed slot
  moved: number | null;   // product that moves into the freed slot to make way (null: none)
  near: { product: number; metres: number } | null;   // closest look-alike after placement
  assign: number[];
};
export type NewItemPlan = {
  name: string; item: Product; flEstimated: boolean;
  analogues: Analogue[]; predictedPicks: number; velocityRank: number;
  retire: number;         // product id sent to reserve; the new item takes over this id
  world: GameData;        // data with the new item in and the retired product out
  options: SlotOption[];  // best first
};

export function planNewItem(data: GameData, assign: readonly number[], name: string, fl?: number): NewItemPlan {
  const { products } = data;
  name = name.trim();
  // The slowest mover goes to reserve; the new item reuses its id
  const retire = [...products].sort((a, b) => a.picksTrain - b.picksTrain || b.id - a.id)[0].id;
  const others = products.filter(p => p.id !== retire);
  const analogues = analoguesOf(name, others);
  const like = analogues.map(a => products[a.product]);
  const wsum = analogues.reduce((s, a) => s + a.similarity, 0);
  const predictedPicks = Math.max(1, Math.round(wsum
    ? analogues.reduce((s, a) => s + a.similarity * products[a.product].picksTrain, 0) / wsum
    : median(others.map(p => p.picksTrain))));

  // What-if orders: retired product out; the new item joins the orders its look-alikes are in
  const scale = data.orders.test.length / data.orders.train.length;
  const rewrite = (orders: Order[], target: number) => {
    const join = new Set(joiningOrders(orders, analogues, target));
    return orders.map((o, i) => ({ ...o, lines: [...o.lines.filter(l => l.p !== retire), ...(join.has(i) ? [{ p: retire, q: 1 }] : [])] }))
      .filter(o => o.lines.length);
  };
  const train = rewrite(data.orders.train, predictedPicks);
  const test = rewrite(data.orders.test, predictedPicks * scale);
  const picks = train.reduce((n, o) => n + (o.lines.some(l => l.p === retire) ? 1 : 0), 0);

  const item: Product = {
    id: retire, code: 'NEW', name, picksTrain: picks, category: categoryFor(name),
    price: like.length ? median(like.map(p => p.price)) : median(others.map(p => p.price)),
    valueTrain: 0, abc: vote(like.map(p => p.abc), 'C'),
    fl: fl ?? (like.length ? median(like.map(p => p.fl)) : 2),
  };
  const worldProducts = products.map(p => (p.id === retire ? item : p));
  const pick = pickTable(worldProducts);
  const affinity = affinityFrom(train);
  const n = Math.min(REPLAY_ORDERS, test.length);
  const world: GameData = {
    ...data, products: worldProducts, orders: { train, test }, affinity, pick,
    partners: partnersOf(affinity), topPartners: partnersOf(affinity, 3),
    sample: Array.from({ length: n }, (_, i) => test[Math.floor((i * test.length) / n)]),
  };

  // Try every slot: the new item starts in the freed slot; going elsewhere swaps it with that slot's product
  const freed = assign[retire];
  const eng = makeEngine(train, assign, pick);
  const options: SlotOption[] = [];
  for (let slot = 0; slot < 100; slot++) {
    const occupant = eng.productAt[slot];
    const delta = slot === freed ? 0 : eng.swapDelta(retire, occupant).delta;
    const a = [...assign];
    if (slot !== freed) { a[retire] = slot; a[occupant] = freed; }
    const near = analogues.length
      ? analogues.map(x => ({ product: x.product, metres: D[slot][a[x.product]] })).sort((x, y) => x.metres - y.metres)[0]
      : null;
    options.push({ slot, aisle: Math.floor(slot / (2 * BAYS)) % AISLES + 1, bay: (slot % BAYS) + 1, delta, moved: slot === freed ? null : occupant, near, assign: a });
  }
  options.sort((x, y) => x.delta - y.delta || Number(x.moved !== null) - Number(y.moved !== null) || x.slot - y.slot);

  return {
    name, item, flEstimated: fl === undefined, analogues, predictedPicks: picks,
    velocityRank: others.filter(p => p.picksTrain > picks).length + 1, retire, world, options,
  };
}
