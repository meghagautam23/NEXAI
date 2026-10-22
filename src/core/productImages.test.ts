// Every product maps to a photo type that exists in public/products, with a credit entry
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Product } from './engine/types';

const root = new URL('../../public/', import.meta.url);
const products: Product[] = JSON.parse(readFileSync(new URL('data/products.json', root), 'utf8'));
const credits = JSON.parse(readFileSync(new URL('products/credits.json', root), 'utf8'));

describe('product photos', async () => {
  const { productType, PRODUCT_TYPES } = await import('./productImages');
  it('maps every product by a rule (no fallback) to a photo with credits', () => {
    for (const p of products) {
      expect(PRODUCT_TYPES.some(([, rx]) => rx.test(p.name.toUpperCase())), `${p.name} matches a rule`).toBe(true);
      const t = productType(p);
      expect(existsSync(new URL(`products/${t}.jpg`, root)), `${p.name} -> ${t}`).toBe(true);
      expect(credits[t]?.license, `credits for ${t}`).toBeTruthy();
    }
  });
});
