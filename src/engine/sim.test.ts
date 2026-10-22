// Section 5.4 engine tests, on the real committed data in public/data
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import affinityJson from '../../public/data/affinity.json'
import type { Affinity, Orders, Product } from './data'
import { partnersOf } from './data'
import { D, DOCK } from './geometry'
import { baselineLayout, originalLayout, samePickPoint, slotsByDock } from './layouts'
import { makeEngine, routeLength, routeOrder, scoreLayout } from './sim'

const products = productsJson as Product[]
const orders = ordersJson as Orders
const affinity = affinityJson as Affinity
const original = originalLayout(products)
const baseline = baselineLayout(products)

// Small seeded PRNG so the random-swap tests are repeatable
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const isPermutation = (a: number[]) => [...a].sort((x, y) => x - y).every((s, i) => s === i)

describe('layouts (Section 5.3)', () => {
  it('Original and Baseline are permutations of the 100 slots', () => {
    expect(isPermutation(original)).toBe(true)
    expect(isPermutation(baseline)).toBe(true)
  })
  it('Baseline gives the most-picked product the slot nearest the dock', () => {
    const top = products.reduce((a, b) => (b.picksTrain > a.picksTrain ? b : a))
    expect(baseline[top.id]).toBe(slotsByDock[0])
    for (const s of slotsByDock) expect(D[DOCK][s]).toBeGreaterThanOrEqual(D[DOCK][slotsByDock[0]])
  })
  it('is deterministic: building and scoring twice gives identical numbers', () => {
    expect(baselineLayout(products)).toEqual(baseline)
    expect(scoreLayout(orders.test, baseline)).toEqual(scoreLayout(orders.test, baseline))
  })
  it('Baseline beats Original on both train and test', () => {
    for (const split of [orders.train, orders.test])
      expect(scoreLayout(split, baseline).totalDist).toBeLessThan(scoreLayout(split, original).totalDist)
  })
})

describe('routeOrder (Section 5.2)', () => {
  it('starts and ends at the dock, visits every slot once, and its length is the sum of legs', () => {
    for (const o of orders.test.slice(0, 200)) {
      const slots = [...new Set(o.lines.map(l => baseline[l.p]))]
      const { total, path } = routeOrder(slots)
      expect(path[0]).toBe(DOCK)
      expect(path.at(-1)).toBe(DOCK)
      expect([...path.slice(1, -1)].sort((a, b) => a - b)).toEqual([...slots].sort((a, b) => a - b))
      let sum = 0
      for (let i = 1; i < path.length; i++) sum += D[path[i - 1]][path[i]]
      expect(total).toBeCloseTo(sum, 9)
    }
  })
  it('routeLength (fast path) gives exactly the routeOrder distance', () => {
    for (const layout of [original, baseline])
      for (const o of [...orders.train, ...orders.test]) {
        const slots = [...new Set(o.lines.map(l => layout[l.p]))]
        expect(routeLength([...slots])).toBe(routeOrder(slots).total)
      }
  })
})

describe('makeEngine (Section 5.2)', () => {
  it('starts with the same numbers as a full score', () => {
    expect(makeEngine(orders.test, baseline).stats()).toEqual(scoreLayout(orders.test, baseline))
  })
  it('swapDelta + commit matches a full rescore after many random swaps', () => {
    const eng = makeEngine(orders.train, baseline)
    const r = rng(42)
    let total = eng.stats().totalDist
    for (let k = 0; k < 300; k++) {
      const p1 = Math.floor(r() * 100), p2 = Math.floor(r() * 100)
      if (p1 === p2) continue
      const s = eng.swapDelta(p1, p2)
      if (r() < 0.5) { s.commit(); total += s.delta }
    }
    const full = scoreLayout(orders.train, [...eng.assign])
    expect(eng.stats().totalDist).toBeCloseTo(full.totalDist, 6)
    expect(total).toBeCloseTo(full.totalDist, 6)
  })
  it('swapDelta alone leaves the layout and score untouched', () => {
    const eng = makeEngine(orders.test, baseline)
    const before = eng.stats()
    eng.swapDelta(0, 99)
    expect([...eng.assign]).toEqual(baseline)
    expect(eng.stats()).toEqual(before)
  })
  it('keeps productAt as the inverse of assign', () => {
    const eng = makeEngine(orders.test, original)
    eng.swap(3, 77); eng.swap(10, 3)
    eng.assign.forEach((s, p) => expect(eng.productAt[s]).toBe(p))
  })
  it('swapping the left and right slots of one bay changes nothing', () => {
    const eng = makeEngine(orders.test, original)
    const pairs = [[0, 10], [25, 35], [89, 99]]
    for (const [a, b] of pairs) {
      expect(samePickPoint(a, b)).toBe(true)
      expect(eng.swapDelta(eng.productAt[a], eng.productAt[b]).delta).toBe(0)
    }
    expect(samePickPoint(0, 1)).toBe(false)
    expect(samePickPoint(0, 20)).toBe(false)
  })
})

describe('partnersOf', () => {
  it('lists up to k strongest bought-together partners, never the product itself', () => {
    const partners = partnersOf(affinity, 3)
    const [a, b] = affinity[0]
    expect(partners[a][0]).toBe(b)
    expect(partners[b][0]).toBe(a)
    partners.forEach((ps, p) => { expect(ps.length).toBeLessThanOrEqual(3); expect(ps).not.toContain(p) })
  })
})
