// engine/newItem.ts — slotting a NEW product that has no pick history yet (the cold-start problem).
//   1. Look-alikes: products whose descriptions share words (collection and type: "Jumbo Bag ... Retrospot")
//      or family predict how often it will be picked and which orders it will join.
//   2. Make room: the floor is full, so the slowest mover goes to reserve storage.
//   3. Every slot is tried with the real simulator on the train weeks (rules respected); the best few are
//      recommended. Placing the new item builds a what-if copy of the data with it in.
import { categoryOf } from './categories';
import type { Abc, Affinity, Data, Order, Product } from './data';
import { D, BAYS } from './geometry';
import { placementProblem, zoneOf } from './rules';
import { makeEngine } from './sim';

// ---- weight estimate: same rules and bands as preprocess.py (a test keeps them in step) ----
export const WEIGHT_RULES: [string, number][] = [
  ['DOORMAT', 2.5], ['CAKESTAND', 2.2], ['TEA SET', 1.8], ['CAKE TINS', 1.2], ['BAKING SET', 0.9],
  ['SLATE', 0.8], ['WOODEN FRAME', 0.6], ['JELLY MOULDS', 0.6], ['RECIPE BOX', 0.5],
  ['ALARM CLOCK', 0.45], ['HOT WATER BOTTLE', 0.45], ['KNEELING PAD', 0.35], ['DOMINOES', 0.35],
  ['LARGE WHITE HEART OF WICKER', 0.35], ['HEART OF WICKER LARGE', 0.35], ['T-LIGHT', 0.3],
  ['NIGHT LIGHT', 0.3], ['ZINC', 0.3], ['GIANT', 0.2], ['CRACKERS', 0.15], ['WICKER', 0.15],
  ['SEWING KIT', 0.15], ['ROLL WRAP', 0.15], ['MINI LIGHTS', 0.15], ['NAUGHTS', 0.15],
  ['PICK UP STICKS', 0.15], ['KNITTING', 0.15], ['HAND WARMER', 0.12], ['JUMBO', 0.12],
  ['PAPER CHAIN', 0.1], ['CARD', 0.1], ['SNAP', 0.1], ['STOCKING', 0.1], ['LUNCH BAG', 0.08],
  ['BUNTING', 0.08], ['HARMONICA', 0.08], ['WOODEN', 0.08], ['CHARLOTTE BAG', 0.06],
  ['CAKE CASES', 0.05], ['NAPKINS', 0.05], ['PENCIL', 0.05], ['POPCORN', 0.05], ['RIBBONS', 0.05],
  ['DECORATION', 0.05], ['ORNAMENT', 0.03],
];
const WEIGHT_BANDS: [number, string][] = [[0.1, 'FL01'], [0.25, 'FL02'], [0.5, 'FL03'], [1, 'FL04'], [2, 'FL05'], [4, 'FL06']];
export const estimateWeight = (name: string) => WEIGHT_RULES.find(([k]) => name.toUpperCase().includes(k))?.[1] ?? 0.15;
export const weightClassOf = (kg: number) => WEIGHT_BANDS.find(([limit]) => kg < limit)?.[1] ?? 'FL07';
export const WEIGHT_CLASS_KG: Record<string, number> = { FL01: 0.05, FL02: 0.15, FL03: 0.35, FL04: 0.7, FL05: 1.5, FL06: 3, FL07: 5 };

// ---- look-alikes ----
const STOP = new Set(['SET', 'OF', 'THE', 'AND', 'BOX', 'PACK', 'IN', 'WITH', 'DESIGN', 'ASSORTED', 'COLOUR', 'SMALL', 'LARGE', 'MINI']);
export const tokens = (name: string) => new Set(
  name.toUpperCase().replace(/[^A-Z0-9' ]+/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)));

// Shared words (Jaccard) plus a bonus for the same product family
export function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  const shared = [...A].filter(t => B.has(t)).length;
  const union = new Set([...A, ...B]).size || 1;
  const family = categoryOf({ name: a }).key === categoryOf({ name: b }).key && categoryOf({ name: a }).key !== 'other';
  return Math.min(1, shared / union + (family ? 0.25 : 0));
}

export type Analogue = { product: number; similarity: number };
export const LOOK_ALIKES = 3;

export function analoguesOf(name: string, products: Product[], k = LOOK_ALIKES): Analogue[] {
  return products.map(p => ({ product: p.id, similarity: similarity(name, p.name) }))
    .filter(a => a.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || a.product - b.product)
    .slice(0, k);
}

// Orders the new item joins: those containing its look-alikes, strongest match first, until the
// predicted number of picks is reached (deterministic)
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

// Affinity pairs from orders, as preprocess.py builds them
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

const abcByRank = (rank: number, n: number): Abc => (rank < 0.2 * n ? 'A' : rank < 0.5 * n ? 'B' : 'C');

export type NewItemSpec = { name: string; weightClass?: string };
export type SlotOption = {
  slot: number; zone: Abc; aisle: number; bay: number;
  delta: number;          // train-week metres vs putting it straight into the freed slot
  moved: number | null;   // product that moves into the freed slot to make way (null: none)
  near: { product: number; metres: number } | null; // closest look-alike after placement
  assign: number[];       // the full layout with the new item placed here
};
export type NewItemPlan = {
  name: string; symbol: string; family: string;
  weightKg: number; weightClass: string; weightEstimated: boolean; heavy: boolean;
  analogues: Analogue[]; predictedPicks: number; velocity: Abc;
  retire: number;         // product id sent to reserve; the new item takes over this id
  world: Data;            // data with the new item in and the retired product out
  options: SlotOption[];  // best first
  trainDays: number;
};

export function planNewItem(data: Data, assign: readonly number[], spec: NewItemSpec, trainDays: number): NewItemPlan {
  const { products } = data;
  const name = spec.name.trim();
  const cat = categoryOf({ name });
  const est = estimateWeight(name);
  const weightClass = spec.weightClass ?? weightClassOf(est);
  const weightKg = spec.weightClass ? WEIGHT_CLASS_KG[spec.weightClass] : est;

  // The slowest mover goes to reserve; the new item reuses its id
  const retire = [...products].sort((a, b) => a.picksTrain - b.picksTrain || b.id - a.id)[0].id;
  const others = products.filter(p => p.id !== retire);
  const analogues = analoguesOf(name, others);
  const wsum = analogues.reduce((s, a) => s + a.similarity, 0);
  const median = [...others].sort((a, b) => a.picksTrain - b.picksTrain)[others.length >> 1].picksTrain;
  const predictedPicks = Math.max(1, Math.round(wsum
    ? analogues.reduce((s, a) => s + a.similarity * products[a.product].picksTrain, 0) / wsum : median));
  const rank = others.filter(p => p.picksTrain > predictedPicks).length;
  const velocity = abcByRank(rank, products.length);
  const costVotes = analogues.map(a => products[a.product].abcCost);
  const abcCost = (['A', 'B', 'C'] as Abc[]).sort((x, y) => costVotes.filter(c => c === y).length - costVotes.filter(c => c === x).length)[0];

  // What-if orders: retired product out; the new item joins the orders its look-alikes are in.
  // Test-week demand scales with the number of orders.
  const scale = data.orders.test.length / data.orders.train.length;
  const rewrite = (orders: Order[], target: number) => {
    const join = new Set(joiningOrders(orders, analogues, target));
    return orders.map((o, i) => ({
      ...o, lines: [...o.lines.filter(l => l.p !== retire), ...(join.has(i) ? [{ p: retire, q: 1 }] : [])],
    })).filter(o => o.lines.length);
  };
  const train = rewrite(data.orders.train, predictedPicks);
  const test = rewrite(data.orders.test, predictedPicks * scale);
  const count = (orders: Order[]) => orders.reduce((n, o) => n + (o.lines.some(l => l.p === retire) ? 1 : 0), 0);

  const item: Product = {
    id: retire, code: 'NEW', name, picksTrain: count(train), picksMonth: count(train) + count(test),
    valueTrain: 0, abcVelocity: velocity, abcCost, weightKg, weightClass,
  };
  // Velocity classes shift with the new item's rank
  const ranked = [...others, item].sort((a, b) => b.picksTrain - a.picksTrain || a.id - b.id);
  const classOf = new Map(ranked.map((p, i) => [p.id, abcByRank(i, ranked.length)]));
  const worldProducts = products.map(p => ({ ...(p.id === retire ? item : p), abcVelocity: classOf.get(p.id)! }));
  const world: Data = { products: worldProducts, orders: { train, test }, affinity: affinityFrom(train) };

  // Try every slot: the new item starts in the freed slot; going elsewhere swaps it with that slot's product
  const freed = assign[retire];
  const eng = makeEngine(train, [...assign]);
  const newItem = worldProducts[retire];
  const options: SlotOption[] = [];
  for (let slot = 0; slot < 100; slot++) {
    const occupant = eng.productAt[slot];
    if (slot !== freed && (placementProblem(newItem, slot, { abcZones: false }) ||
        placementProblem(worldProducts[occupant], freed, { abcZones: false }))) continue;
    if (slot === freed && placementProblem(newItem, slot, { abcZones: false })) continue;
    const delta = slot === freed ? 0 : eng.swapDelta(retire, occupant).delta;
    const a = [...assign];
    if (slot !== freed) { a[retire] = slot; a[occupant] = freed; }
    const near = analogues.length
      ? analogues.map(x => ({ product: x.product, metres: D[slot][a[x.product]] })).sort((x, y) => x.metres - y.metres)[0]
      : null;
    options.push({
      slot, zone: zoneOf[slot], aisle: Math.floor(slot / (2 * BAYS)) + 1, bay: (slot % BAYS) + 1,
      delta, moved: slot === freed ? null : occupant, near, assign: a,
    });
  }
  // Least walking first; on a tie, the option that moves nothing else; then by slot
  options.sort((x, y) => x.delta - y.delta || Number(x.moved !== null) - Number(y.moved !== null) || x.slot - y.slot);

  return {
    name, symbol: cat.symbol, family: cat.label, weightKg, weightClass, weightEstimated: !spec.weightClass,
    heavy: weightClass >= 'FL05', analogues, predictedPicks: item.picksTrain, velocity: classOf.get(retire)!,
    retire, world, options, trainDays,
  };
}
