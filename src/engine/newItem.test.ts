// New product arrivals (cold start): estimate, make room, test every slot, what-if world
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import affinityJson from '../../public/data/affinity.json'
import type { Affinity, Data, Orders, Product } from './data'
import { baselineLayout } from './layouts'
import { analoguesOf, flOf, planNewItem, similarity } from './newItem'
import { isFrontSlot, violations } from './rules'
import { makeEngine } from './sim'

const data: Data = { products: productsJson as Product[], orders: ordersJson as Orders, affinity: affinityJson as Affinity }
const base = baselineLayout(data.products)
const plan = (name: string, fl?: number) => planNewItem(data, base, { name, fl }, 18)
const isPermutation = (a: number[]) => [...a].sort((x, y) => x - y).every((s, i) => s === i)

describe('estimates', () => {
  it('handling levels use the same bands as the data pipeline', () => {
    for (const p of data.products) expect(flOf(p.unitsPerLine)).toBe(p.fl)
  })
  it('finds look-alikes by shared words and family', () => {
    expect(similarity('Jumbo Bag Woodland Animals', 'Jumbo Bag Red Retrospot'))
      .toBeGreaterThan(similarity('Jumbo Bag Woodland Animals', 'Alarm Clock Bakelike Red'))
    const top = analoguesOf('Jumbo Bag Woodland Animals', data.products)
    expect(top).toHaveLength(3)
    top.forEach(a => expect(data.products[a.product].name).toMatch(/Jumbo/))
  })
})

describe('planNewItem', () => {
  const p = plan('Jumbo Bag Woodland Animals')
  const slowest = [...data.products].sort((a, b) => a.picksTrain - b.picksTrain || b.id - a.id)[0]

  it('sends the slowest product to reserve and the new item takes its place in the data', () => {
    expect(p.retire).toBe(slowest.id)
    const w = p.world
    expect(w.products).toHaveLength(100)
    expect(w.products[p.retire].name).toBe('Jumbo Bag Woodland Animals')
    const lines = [...w.orders.train, ...w.orders.test].flatMap(o => o.lines.filter(l => l.p === p.retire))
    expect(lines.length).toBe(w.products[p.retire].picksMonth)
    expect(w.products[p.retire].picksTrain).toBe(p.predictedPicks)
    expect(p.predictedPicks).toBeGreaterThan(50)  // jumbo bags sell well
    expect(w.orders.train.every(o => o.lines.length > 0)).toBe(true)
  })

  it('tests every allowed slot, best first, and each option is a valid layout', () => {
    // Every slot is tried; slots are skipped only when the rules forbid them (bulk items stay in front)
    expect(p.options.length).toBeGreaterThan(80)
    p.options.forEach((o, i) => {
      expect(isPermutation(o.assign)).toBe(true)
      expect(violations(p.world.products, o.assign, { abcZones: false })).toBe(0)
      expect(o.assign[p.retire]).toBe(o.slot)
      if (i) expect(o.delta).toBeGreaterThanOrEqual(p.options[i - 1].delta)
    })
    const freed = p.options.find(o => o.moved === null)!
    expect(p.options[0].delta).toBeLessThanOrEqual(freed.delta)
    // the reported delta is the real change in train-week walking
    const walk = (a: number[]) => makeEngine(p.world.orders.train, a).stats().totalDist
    expect(walk(p.options[0].assign) - walk(freed.assign)).toBeCloseTo(p.options[0].delta - freed.delta, 6)
  })

  it('keeps a bulk new item in the front bays', () => {
    const b = plan('Jumbo Bag Woodland Animals', 7)
    expect(b.bulk).toBe(true)
    b.options.forEach(o => expect(isFrontSlot(o.slot)).toBe(true))
    expect(plan('Jumbo Bag Woodland Animals', 1).bulk).toBe(false)
  })
})
