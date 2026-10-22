// Peak-day rush: shift simulation invariants and the on-time score
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import type { Orders, Product } from './data'
import { baselineLayout } from './layouts'
import { DEFAULT_RUSH, busiestDay, fmtClock, rushOrders, rushStars, rushStats, secondsOfDay, simulateRush } from './rush'

const orders = (ordersJson as Orders).test
const base = baselineLayout(productsJson as Product[])

describe('rush orders', () => {
  it('picks the busiest day, and merges the busiest days at their real times of day', () => {
    expect(busiestDay(orders)).toBe('2011-11-22')
    const one = rushOrders(orders, 1), three = rushOrders(orders, 3)
    expect(one.orders).toHaveLength(119)
    expect(three.dates).toHaveLength(3)
    expect(three.orders.length).toBe(orders.filter(o => three.dates.includes(o.t.slice(0, 10))).length)
    const times = (os: typeof orders) => os.map(o => o.t.slice(11)).sort()
    expect(times(three.orders)).toEqual(times(orders.filter(o => three.dates.includes(o.t.slice(0, 10)))))
  })
})

describe.each([[1, 1], [2, 1], [2, 4]])('simulateRush with %i picker(s), carts of %i', (pickers, cart) => {
  const day = rushOrders(orders, 3).orders
  const r = simulateRush(day, base, { ...DEFAULT_RUSH, pickers, cart, cutoff: 17 * 3600 })

  it('picks every order exactly once, never before it arrives', () => {
    expect(r.trips.flatMap(t => t.orders).sort((a, b) => a - b)).toEqual(day.map((_, i) => i))
    for (const t of r.trips) for (const i of t.orders) expect(t.start).toBeGreaterThanOrEqual(secondsOfDay(day[i].t))
  })
  it('keeps each picker on one trip at a time, from the shift start, within cart limits', () => {
    for (let p = 0; p < pickers; p++) {
      const mine = r.trips.filter(t => t.picker === p)
      mine.forEach((t, k) => {
        expect(t.start).toBeGreaterThanOrEqual(k ? mine[k - 1].end : DEFAULT_RUSH.shiftStart)
        expect(t.orders.length).toBeLessThanOrEqual(cart)
        if (t.orders.length > 1) expect(t.lines).toBeLessThanOrEqual(DEFAULT_RUSH.maxLines)
      })
    }
  })
  it('counts on time only orders packed by the cut-off that arrived before it', () => {
    const due = r.outcomes.filter(o => !o.tomorrow)
    expect(r.due).toBe(due.length)
    expect(r.onTime).toBe(due.filter(o => o.done <= 17 * 3600).length)
    const end = rushStats(r, r.lastDone, 17 * 3600)
    expect(end.shipped).toBe(day.length)
    expect(end.onTime).toBe(r.onTime)
    expect(end.late).toBe(r.due - r.onTime)
  })
})

describe('rush scoring', () => {
  it('more pickers and carts ship more on time at peak volume', () => {
    const day = rushOrders(orders, 3).orders
    const share = (pickers: number, cart: number) => {
      const r = simulateRush(day, base, { ...DEFAULT_RUSH, pickers, cart, cutoff: 17 * 3600 })
      return r.onTime / r.due
    }
    expect(share(2, 1)).toBeGreaterThan(share(1, 1))
    expect(share(2, 4)).toBeGreaterThan(share(2, 1))
  })
  it('rates and formats', () => {
    expect([0.79, 0.8, 0.9, 0.97].map(rushStars)).toEqual([0, 1, 2, 3])
    expect(fmtClock(17 * 3600 + 5 * 60)).toBe('17:05')
    expect(fmtClock(25 * 3600)).toBe('01:00 (+1 day)')
  })
})
