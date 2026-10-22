// Core: loads the JSON contracts from public/data (Plan v2, Section 3.3) and derives what every module shares
import { baselineLayout, originalLayout, partnersOf } from './engine/layouts';
import { pickTable } from './engine/rules';
import type { Affinity, Order, Orders, Product } from './engine/types';

export const REPLAY_ORDERS = 25;

export type GameData = {
  products: Product[]; orders: Orders; affinity: Affinity;
  partners: number[][];      // all affinity partners, strongest first (optimizer)
  topPartners: number[][];   // top 3 per product (hint lines)
  minPicks: number; maxPicks: number;
  originalAssign: number[];  // "as received": sorted by StockCode
  baselineAssign: number[];  // fast movers nearest the dock
  sample: Order[];           // replay sample: 25 orders spread across the test week
  pick: number[][];          // pick[product][slot] = seconds per line (rules.ts)
};

const get = async <T>(f: string): Promise<T> => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${f}`);
  if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`);
  return r.json();
};

export async function loadData(): Promise<GameData> {
  const [products, orders, affinity] = await Promise.all([
    get<Product[]>('products.json'), get<Orders>('orders.json'), get<Affinity>('affinity.json'),
  ]);
  const test = orders.test, n = Math.min(REPLAY_ORDERS, test.length);
  return {
    products, orders, affinity,
    partners: partnersOf(affinity), topPartners: partnersOf(affinity, 3),
    minPicks: Math.min(...products.map(p => p.picksTrain)),
    maxPicks: Math.max(...products.map(p => p.picksTrain)),
    originalAssign: originalLayout(products),
    baselineAssign: baselineLayout(products),
    sample: Array.from({ length: n }, (_, i) => test[Math.floor((i * test.length) / n)]),
    pick: pickTable(products),
  };
}
