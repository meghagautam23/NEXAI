// The animation must match the score: same distance, same time, never off the aisles
import { describe, expect, it } from 'vitest'
import productsJson from '../../public/data/products.json'
import ordersJson from '../../public/data/orders.json'
import type { Orders, Product } from './data'
import { DOCK, pts } from './geometry'
import { baselineLayout } from './layouts'
import { buildTimeline, sampleOrders, sampleTimeline } from './replay'
import { PICK_TIME, WALK_SPEED, makeEngine } from './sim'

const orders = ordersJson as Orders
const eng = makeEngine(orders.test, baselineLayout(productsJson as Product[]))
const sample = sampleOrders(orders.test)

describe('buildTimeline', () => {
  it('walks exactly the scored distance and takes walk + pick time', () => {
    for (const i of sample) {
      const { path, total } = eng.route(i)
      const tl = buildTimeline(path)
      expect(tl.dist).toBeCloseTo(total, 9)
      expect(tl.time).toBeCloseTo(total / WALK_SPEED + (path.length - 2) * PICK_TIME, 9)
      expect(tl.slots).toEqual(path.slice(1, -1))
    }
  })
  it('starts and ends at the dock', () => {
    const tl = buildTimeline(eng.route(sample[3]).path)
    expect(tl.waypoints[0]).toEqual(pts[DOCK])
    expect(sampleTimeline(tl, 0)).toMatchObject({ x: pts[DOCK].x, y: pts[DOCK].y, dist: 0, picked: 0 })
    expect(sampleTimeline(tl, tl.time + 1)).toMatchObject({ x: pts[DOCK].x, y: pts[DOCK].y, picked: tl.slots.length })
  })
})

describe('sampleTimeline', () => {
  it('distance only grows and every position lies on an aisle or cross-aisle centerline', () => {
    const tl = buildTimeline(eng.route(sample[5]).path)
    let last = 0
    for (let t = 0; t <= tl.time; t += 0.37) {
      const s = sampleTimeline(tl, t)
      expect(s.dist).toBeGreaterThanOrEqual(last - 1e-9)
      last = s.dist
      const onAisle = Math.abs(s.x / 5 - Math.round(s.x / 5)) < 1e-9
      const onCross = Math.abs(s.y) < 1e-9 || Math.abs(s.y - 15) < 1e-9
      expect(onAisle || onCross).toBe(true)
    }
  })
})

describe('sampleOrders', () => {
  it('picks 25 distinct test orders spread across the week', () => {
    expect(new Set(sample).size).toBe(25)
    expect(sample[0]).toBe(0)
    expect(sample.at(-1)).toBeGreaterThan(orders.test.length * 0.9)
  })
})
