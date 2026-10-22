// Game rules (Phase 4) on the real data, without the 3D scene
import { beforeEach, describe, expect, it } from 'vitest'
import productsJson from '../public/data/products.json'
import ordersJson from '../public/data/orders.json'
import affinityJson from '../public/data/affinity.json'
import type { Affinity, Data, Orders, Product } from './engine/data'
import { baselineLayout, originalLayout } from './engine/layouts'
import { scoreLayout } from './engine/sim'
import { CHALLENGE_SWAPS, useStore } from './store'
import { isFrontSlot, isHeavy, violations, zoneOf } from './engine/rules'

const data: Data = { products: productsJson as Product[], orders: ordersJson as Orders, affinity: affinityJson as Affinity }
const st = () => useStore.getState()
const swap = (a: number, b: number) => { st().clickSlot(a); st().clickSlot(b) }

beforeEach(() => {
  useStore.setState({ mode: 'challenge', toast: null })
  st().init(data)
})

describe('Challenge mode', () => {
  it('starts from the Baseline with no swaps and the test score hidden from the board', () => {
    expect(st().assign).toEqual(baselineLayout(data.products))
    expect(st().history).toEqual([])
    expect(st().submitted).toBe(false)
    expect(st().yours!.test).toEqual(st().ref!.test.baseline)
  })

  it('swaps the products of two clicked slots and rescoring matches a full score', () => {
    const before = [...st().productAt]
    swap(0, 47)
    const { productAt, assign, yours } = st()
    expect(productAt[0]).toBe(before[47])
    expect(productAt[47]).toBe(before[0])
    assign.forEach((s, p) => expect(productAt[s]).toBe(p))
    expect(yours!.test.totalDist).toBeCloseTo(scoreLayout(data.orders.test, assign).totalDist, 6)
    expect(yours!.train.totalDist).toBeCloseTo(scoreLayout(data.orders.train, assign).totalDist, 6)
    expect(st().history).toEqual([[0, 47]])
  })

  it('previews exactly the train-week change the swap then makes', () => {
    st().clickSlot(3)
    st().hoverSlot(65, 0, 0)
    const delta = st().preview!.delta
    const before = st().yours!.train.totalDist
    st().clickSlot(65)
    expect(st().yours!.train.totalDist - before).toBeCloseTo(delta, 6)
    expect(st().preview).toBeNull()
  })

  it('refuses a same-pick-point swap without using a swap', () => {
    swap(4, 14) // left and right of the same bay
    expect(st().history).toEqual([])
    expect(st().toast?.text).toMatch(/same pick point/)
  })

  it('clicking the selected slot again deselects it', () => {
    st().clickSlot(5); st().clickSlot(5)
    expect(st().selected).toBeNull()
    expect(st().history).toEqual([])
  })

  it(`allows ${CHALLENGE_SWAPS} swaps, then refuses until a swap is undone`, () => {
    for (let i = 0; i < CHALLENGE_SWAPS; i++) swap(i, 50 + i)
    expect(st().history).toHaveLength(CHALLENGE_SWAPS)
    swap(20, 70)
    expect(st().history).toHaveLength(CHALLENGE_SWAPS)
    expect(st().toast?.text).toMatch(/No swaps left/)
    st().undo()
    expect(st().history).toHaveLength(CHALLENGE_SWAPS - 1)
  })

  it('undo restores the previous layout and score', () => {
    const assign = [...st().assign], score = st().yours!.test
    swap(1, 88); swap(30, 9)
    st().undo(); st().undo()
    expect(st().assign).toEqual(assign)
    expect(st().yours!.test.totalDist).toBeCloseTo(score.totalDist, 6)
  })

  it('submit needs at least one swap and then locks the layout', () => {
    st().submit()
    expect(st().submitted).toBe(false)
    swap(2, 77)
    st().submit()
    expect(st().submitted).toBe(true)
    const assign = [...st().assign]
    swap(6, 66)
    expect(st().assign).toEqual(assign)
    st().reset()
    expect(st().submitted).toBe(false)
    expect(st().assign).toEqual(baselineLayout(data.products))
  })
})

describe('Sandbox mode', () => {
  it('starts from the Original layout, has no swap limit, and can load the Baseline', () => {
    st().setMode('sandbox')
    expect(st().assign).toEqual(originalLayout(data.products))
    for (let i = 0; i < CHALLENGE_SWAPS + 3; i++) swap(i, 60 + i)
    expect(st().history).toHaveLength(CHALLENGE_SWAPS + 3)
    st().loadBaseline()
    expect(st().assign).toEqual(baselineLayout(data.products))
    expect(st().history).toEqual([])
  })
})

describe('Heatmap and leaderboard (Phase 6)', () => {
  it('counts picks per slot and clears them on reset', () => {
    st().recordPick(7); st().recordPick(7); st().recordPick(42)
    expect(st().visits[7]).toBe(2)
    expect(st().visits[42]).toBe(1)
    st().resetVisits()
    expect(st().visits.every(v => v === 0)).toBe(true)
  })

  it('saves a Challenge result once, only after submitting', () => {
    useStore.setState({ board: [] })
    swap(2, 77)
    st().saveResult('Megha')
    expect(st().board).toHaveLength(0)  // not submitted yet
    st().submit()
    st().saveResult('  Megha  ')
    st().saveResult('again')
    expect(st().board).toHaveLength(1)
    expect(st().board[0]).toMatchObject({ name: 'Megha', swaps: 1, total: st().yours!.test.totalDist })
    expect(st().board[0].assign).toEqual(st().assign)
    expect(st().boardOpen).toBe(true)
  })

  it('loads a saved layout into Sandbox with live scores', () => {
    swap(2, 77)
    const saved = [...st().assign]
    st().reset()
    st().loadLayout(saved)
    expect(st().mode).toBe('sandbox')
    expect(st().assign).toEqual(saved)
    expect(st().yours!.test.totalDist).toBeCloseTo(scoreLayout(data.orders.test, saved).totalDist, 6)
  })
})

describe('Classification rules', () => {
  const heavy = data.products.filter(isHeavy)
  const ruleSet = { abcZones: true }

  it('every built-in layout keeps heavy items in the front bays; Baseline also keeps ABC zones', () => {
    expect(heavy.map(p => p.weightClass).every(c => c >= 'FL05')).toBe(true)
    for (const layout of [originalLayout(data.products), baselineLayout(data.products)])
      for (const p of heavy) expect(isFrontSlot(layout[p.id])).toBe(true)
    expect(violations(data.products, baselineLayout(data.products), ruleSet)).toBe(0)
  })

  it('refuses a swap that moves a heavy item out of the front bays, without using a swap', () => {
    const p = heavy[0], from = st().assign[p.id]
    const back = [...Array(100).keys()].find(s => !isFrontSlot(s))!
    swap(from, back)
    expect(st().history).toEqual([])
    expect(st().toast?.text).toMatch(/heavy/)
    st().clickSlot(from) // deselect
    st().clickSlot(from); st().hoverSlot(back, 0, 0)
    expect(st().blocked?.reason).toMatch(/heavy/)
    expect(st().preview).toBeNull()
  })

  it('with ABC zones on, keeps products in their velocity zone (Challenge only)', () => {
    st().setAbcZones(true)
    const a = st().assign[1]                                      // class A product
    const cSlot = [...Array(100).keys()].find(s => zoneOf[s] === 'C' && !isHeavy(data.products[st().productAt[s]]))!
    swap(a, cSlot)
    expect(st().history).toEqual([])
    expect(st().toast?.text).toMatch(/ABC zones/)
    const aSlot2 = st().assign[2]                                 // A to A is fine
    st().clickSlot(a)                                             // a refused swap keeps the selection: clear it
    swap(a, aSlot2)
    expect(st().history).toHaveLength(1)
    st().setMode('sandbox')                                       // zones never apply in Sandbox
    swap(st().assign[1], cSlot)
    expect(st().history).toHaveLength(1)
    useStore.setState({ abcZones: false })
  })
})

describe('AI Suggest in the store', () => {
  it('turns an optimizer result into scored, explained moves and a scoreboard row', async () => {
    const { optimize } = await import('./engine/optimizer')
    const { partnersOf } = await import('./engine/data')
    const r = optimize({ products: data.products, orders: data.orders.train, partners: partnersOf(data.affinity, 5),
      start: baselineLayout(data.products), rules: { abcZones: false }, iterations: 3000, seed: 5 })
    st().finishAI(r, 'balanced', false)
    const res = st().ai.result!
    expect(st().ai.status).toBe('done')
    expect(res.test.totalDist).toBeCloseTo(scoreLayout(data.orders.test, r.assign).totalDist, 6)
    expect(res.moves.length).toBeGreaterThan(0)
    expect(res.testDays).toBe(8)
    st().setAbcZones(true)                        // a rule change makes the old result stale
    expect(st().ai.result).toBeNull()
    useStore.setState({ abcZones: false })
  })
})
