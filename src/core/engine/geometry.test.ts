// Section 5.4 tests that depend only on geometry. Engine/layout tests (Baseline beats
// Original, determinism, swapDelta vs full rescore) belong in sim.test.ts with sim.ts.
import { describe, expect, it } from 'vitest'
import { AISLES, D, DOCK, L, PITCH, leg, pts, type Pt } from './geometry'

const EPS = 1e-9
const slots = [...Array(100).keys()]
const all = [...slots, DOCK]
const pathLength = (from: Pt, way: Pt[]) => {
  let len = 0, cur = from
  for (const p of way) { len += Math.abs(p.x - cur.x) + Math.abs(p.y - cur.y); cur = p }
  return len
}
const onAisleCenterline = (p: Pt) => [...Array(AISLES).keys()].some(a => Math.abs(p.x - a * PITCH) < EPS)
const onCrossAisle = (p: Pt) => Math.abs(p.y) < EPS || Math.abs(p.y - L) < EPS

describe('layout (Section 4)', () => {
  it('has 100 slots plus the dock at (10, 0)', () => {
    expect(pts).toHaveLength(101)
    expect(pts[DOCK]).toMatchObject({ x: 10, y: 0 })
  })
  it('puts every pick point inside the rack span 1.5–13.5 m', () => {
    for (const s of slots) {
      expect(pts[s].y).toBeGreaterThan(1.5)
      expect(pts[s].y).toBeLessThan(13.5)
    }
  })
})

describe('leg() (Section 5.4)', () => {
  it('is symmetric for every pair', () => {
    for (const a of all) for (const b of all)
      expect(leg(pts[a], pts[b]).d).toBeCloseTo(leg(pts[b], pts[a]).d, 9)
  })
  it('waypoint length equals the scored distance (animation matches score)', () => {
    for (const a of all) for (const b of all) {
      const l = leg(pts[a], pts[b])
      expect(pathLength(pts[a], l.pts)).toBeCloseTo(l.d, 9)
    }
  })
  it('same-aisle distance equals |Δy|', () => {
    for (const a of slots) for (const b of slots)
      if (pts[a].aisle === pts[b].aisle)
        expect(leg(pts[a], pts[b]).d).toBeCloseTo(Math.abs(pts[a].y - pts[b].y), 9)
  })
  it('never crosses a rack: every segment runs along an aisle or cross-aisle centerline', () => {
    for (const a of all) for (const b of all) {
      let cur = pts[a]
      for (const p of leg(pts[a], pts[b]).pts) {
        const vertical = Math.abs(p.x - cur.x) < EPS
        const horizontal = Math.abs(p.y - cur.y) < EPS
        expect(vertical || horizontal).toBe(true)
        if (vertical && !horizontal) expect(onAisleCenterline(p)).toBe(true)
        if (horizontal && !vertical) expect(onCrossAisle(p)).toBe(true)
        cur = p
      }
    }
  })
  it('breaks ties toward the front cross aisle', () => {
    const mid = { aisle: 0, x: 0, y: L / 2, side: 0 }
    const other = { aisle: 1, x: PITCH, y: L / 2, side: 0 }
    expect(leg(mid, other).pts[0].y).toBe(0)
  })
  it('D matches leg() and the left/right slots of a bay share a pick point', () => {
    for (const a of all) for (const b of all) expect(D[a][b]).toBe(leg(pts[a], pts[b]).d)
    for (let a = 0; a < AISLES; a++) for (let b = 0; b < 10; b++)
      expect(D[a * 20 + b][a * 20 + 10 + b]).toBe(0)
  })
})
