// Every product gets a photo type that exists and is credited; short names stay short
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import credits from '../../public/products/credits.json'
import type { Product } from '../engine/data'
import { PRODUCT_TYPES, productType, shortName } from './productImages'

const products = productsJson as Product[]

describe('product photos', () => {
  it('match every product to a credited, openly licensed photo', () => {
    const credited = credits as Record<string, { license: string; source: string }>
    for (const p of products) {
      const c = credited[productType(p)]
      expect(c, p.name).toBeDefined()
      expect(c.license).toMatch(/^CC/)
      expect(c.source).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    }
    PRODUCT_TYPES.forEach(([type]) => expect(credited[type], type).toBeDefined())
  })
  it('short names drop filler words', () => {
    expect(shortName({ name: 'Set Of 3 Cake Tins Pantry Design' })).toBe('Cake Tins')
    expect(shortName({ name: 'Rabbit Night Light' })).toBe('Rabbit Night')
  })
})
