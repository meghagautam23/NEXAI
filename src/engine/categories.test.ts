import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import type { Product } from './data'
import { CATEGORIES, categoryOf } from './categories'

const products = productsJson as Product[]

describe('product categories', () => {
  it('give every product a family, each with its own symbol', () => {
    expect(products.filter(p => categoryOf(p).key === 'other')).toEqual([])
    expect(new Set(CATEGORIES.map(c => c.symbol)).size).toBe(CATEGORIES.length)
    expect(new Set(CATEGORIES.map(c => c.key)).size).toBe(CATEGORIES.length)
  })
  it('match the most specific keyword first', () => {
    expect(categoryOf({ name: 'Hot Water Bottle Keep Calm' }).key).toBe('bottle')
    expect(categoryOf({ name: 'Hand Warmer Owl Design' }).key).toBe('warmer')      // not "owl ornament"
    expect(categoryOf({ name: 'Jumbo Bag 50\'S Christmas' }).key).toBe('bag')      // not "christmas"
    expect(categoryOf({ name: 'Box Of 6 Mini 50\'S Crackers' }).key).toBe('cracker')
    expect(categoryOf({ name: 'Something new' }).key).toBe('other')
  })
})
