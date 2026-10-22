// engine/data.ts — shapes of public/data/*.json (README, "Output") and a browser loader
export type Abc = 'A' | 'B' | 'C';
export type Product = {
  id: number; code: string; name: string; picksTrain: number; picksMonth: number;
  valueTrain: number;  // £ moved in the train weeks (quantity x price)
  abcVelocity: Abc;    // by pick rank: top 20% A, next 30% B, last 50% C — drives slotting
  abcCost: Abc;        // by value moved, Pareto 80/95% — display only
  weightKg: number;    // ESTIMATED from the description (the dataset has no weights)
  weightClass: string; // FL01 (lightest) .. FL07 (heaviest), banded from weightKg
};
export type Line = { p: number; q: number };
export type Order = { id: string; t: string; lines: Line[] };
export type Orders = { train: Order[]; test: Order[] };
export type Affinity = [a: number, b: number, n: number][];
export type Data = { products: Product[]; orders: Orders; affinity: Affinity };

export async function loadData(base = '/data'): Promise<Data> {
  const get = async <T>(name: string): Promise<T> => {
    const r = await fetch(`${base}/${name}.json`);
    if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}`);
    return r.json() as Promise<T>;
  };
  const [products, orders, affinity] = await Promise.all([
    get<Product[]>('products'), get<Orders>('orders'), get<Affinity>('affinity'),
  ]);
  return { products, orders, affinity };
}

// Top-k bought-together partners per product, strongest first (affinity hints, optimizer moves)
export function partnersOf(affinity: Affinity, k = 3, n = 100): number[][] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of affinity) { // already sorted by count, descending
    if (out[a].length < k) out[a].push(b);
    if (out[b].length < k) out[b].push(a);
  }
  return out;
}
