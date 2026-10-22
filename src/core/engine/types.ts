// JSON contracts from Plan v2, Section 3.3. assign[productId] = slotId.
export type Category =
  | 'Cosy & warm' | 'Lights & candles' | 'Bags & storage' | 'Kitchen & baking' | 'Party & paper'
  | 'Christmas' | 'Games & crafts' | 'Home & garden' | 'Gifts & gadgets';
export type Product = {
  id: number; code: string; name: string; picksTrain: number;
  category: Category; price: number; valueTrain: number; abc: 'A' | 'B' | 'C'; fl: number;
};
export type OrderLine = { p: number; q: number };
export type Order = { id: string; t: string; lines: OrderLine[] };
export type Orders = { train: Order[]; test: Order[] };
export type Affinity = [number, number, number][];
