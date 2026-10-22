// Batch picking: every order picked exactly once, cart limits respected, and the saving is real
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import type { Orders, Product } from './data'
import { batchLength, makeBatches, scoreBatches, scoreBatching, type BatchPolicy } from './batching'
import { baselineLayout } from './layouts'
import { scoreLayout } from './sim'

const orders = (ordersJson as Orders).test
const base = baselineLayout(productsJson as Product[])
const lines = (i: number) => orders[i].lines.length

describe.each<BatchPolicy>(['fcfs', 'proximity'])('%s batching', policy => {
  const opts = { size: 4, maxLines: 40, policy }
  const batches = makeBatches(orders, base, opts)

  it('picks every order exactly once', () => {
    expect(batches.flat().sort((a, b) => a - b)).toEqual(orders.map((_, i) => i))
  })
  it('respects cart size, line capacity and picking days', () => {
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(4)
      if (b.length > 1) expect(b.reduce((n, i) => n + lines(i), 0)).toBeLessThanOrEqual(40)
      expect(new Set(b.map(i => orders[i].t.slice(0, 10))).size).toBe(1)
    }
  })
  it('walks less than single-order picking', () => {
    expect(scoreBatches(orders, batches, base).totalDist).toBeLessThan(scoreLayout(orders, base).totalDist)
  })
})

describe('scoring', () => {
  it('a cart of one is single-order picking', () => {
    const one = scoreBatching(orders, base, { size: 1, maxLines: Infinity, policy: 'fcfs' })
    const single = scoreLayout(orders, base)
    expect(one.trips).toBe(orders.length)
    expect(one.totalDist).toBeCloseTo(single.totalDist, 6)
    expect(one.avgTime).toBeCloseTo(single.avgTime, 6)
  })
  it('proximity batching beats first-come batching at every cart size', () => {
    for (const size of [2, 3, 4, 5]) {
      const f = scoreBatching(orders, base, { size, maxLines: 40, policy: 'fcfs' })
      const p = scoreBatching(orders, base, { size, maxLines: 40, policy: 'proximity' })
      expect(p.totalDist).toBeLessThan(f.totalDist)
    }
  })
  it('a batch trip is never longer than its orders walked separately', () => {
    for (const b of makeBatches(orders, base, { size: 4, maxLines: 40, policy: 'proximity' }).slice(0, 50))
      expect(batchLength(orders, b, base)).toBeLessThanOrEqual(b.reduce((d, i) => d + batchLength(orders, [i], base), 0) + 1e-9)
  })
})
