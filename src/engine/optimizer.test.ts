// AI Suggest (Phase 7): rules, hold-out, determinism, explanations and the business case
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import affinityJson from '../../public/data/affinity.json'
import { partnersOf, type Affinity, type Orders, type Product } from './data'
import { explainMoves, impact, pickingDays } from './insights'
import { baselineLayout } from './layouts'
import { movedProducts, optimize, penaltyFor, prune } from './optimizer'
import { violations } from './rules'
import { makeEngine, scoreLayout } from './sim'

const products = productsJson as Product[]
const orders = ordersJson as Orders
const affinity = affinityJson as Affinity
const base = baselineLayout(products)
const partners = partnersOf(affinity, 5)
const run = (o: Partial<Parameters<typeof optimize>[0]> = {}) =>
  optimize({ products, orders: orders.train, partners, start: base, rules: { abcZones: false }, iterations: 4000, seed: 3, ...o })
const isPermutation = (a: number[]) => [...a].sort((x, y) => x - y).every((s, i) => s === i)

describe('optimize', () => {
  const r = run()
  it('returns a valid layout that walks less on the train weeks than the Baseline', () => {
    expect(isPermutation(r.assign)).toBe(true)
    expect(r.best).toBeLessThan(r.start)
    expect(scoreLayout(orders.train, r.assign).totalDist).toBeCloseTo(r.best, 6)
  })
  it('never breaks the heavy-item rule, and keeps ABC zones when asked', () => {
    expect(violations(products, r.assign, { abcZones: false })).toBe(0)
    const z = run({ rules: { abcZones: true } })
    expect(violations(products, z.assign, { abcZones: true })).toBe(0)
  })
  it('is repeatable for a given seed', () => {
    expect(run().assign).toEqual(r.assign)
  })
  it('moves fewer products as the move penalty grows', () => {
    const free = movedProducts(base, r.assign).length
    expect(movedProducts(base, run({ movePenalty: 150 }).assign).length).toBeLessThan(free)
    expect(movedProducts(base, run({ movePenalty: 1e6 }).assign)).toEqual([])
  })
  it('generalises: the train-tuned layout also beats the Baseline on the unseen test week', () => {
    const long = run({ iterations: 20000 })
    expect(scoreLayout(orders.test, long.assign).totalDist).toBeLessThan(scoreLayout(orders.test, base).totalDist)
  })
})

describe('prune', () => {
  it('only undoes moves that do not cost walking', () => {
    const r = run({ iterations: 2000 })
    const p = prune(products, orders.train, base, r.assign, { abcZones: false })
    expect(scoreLayout(orders.train, p.assign).totalDist).toBeLessThanOrEqual(scoreLayout(orders.train, r.assign).totalDist + 1e-6)
    expect(movedProducts(base, p.assign).length).toBeLessThanOrEqual(movedProducts(base, r.assign).length)
  })
})

describe('explainMoves', () => {
  it('explains every moved product, strongest saving first', () => {
    const r = run()
    const moves = explainMoves(products, affinity, makeEngine(orders.train, r.assign), base)
    expect(moves.map(m => m.product).sort((a, b) => a - b)).toEqual(movedProducts(base, r.assign))
    moves.forEach((m, i) => {
      expect(m.reason.length).toBeGreaterThan(10)
      expect(m.from).toBe(base[m.product]); expect(m.to).toBe(r.assign[m.product])
      if (i) expect(m.saving).toBeLessThanOrEqual(moves[i - 1].saving)
    })
    expect(moves[0].saving).toBeGreaterThan(0)
  })
})

describe('business case', () => {
  it('converts metres to hours and pounds, and re-slotting labour to a payback period', () => {
    const x = impact(3600 * 8, 8, 30, { costPerHour: 15, minutesPerMove: 10, daysPerYear: 250 })
    expect(x.hoursPerDay).toBeCloseTo(1)           // 3,600 m a day at 1 m/s
    expect(x.poundsPerYear).toBeCloseTo(250 * 15)
    expect(x.reslotHours).toBeCloseTo(5)           // 30 moves x 10 min
    expect(x.paybackDays).toBeCloseTo(5)
    expect(impact(0, 8, 3, { costPerHour: 15, minutesPerMove: 10, daysPerYear: 250 }).paybackDays).toBe(Infinity)
    expect(penaltyFor(10, 18, 18)).toBe(600)        // a 10-minute move must save 600 m of walking to pay back
  })
  it('counts picking days, not calendar days', () => {
    expect(pickingDays(orders.test)).toBe(8)
    expect(pickingDays(orders.train)).toBe(18)
  })
})
