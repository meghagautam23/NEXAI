// Game rules (Phase 4) on the real data, without the 3D scene
import { beforeEach, describe, expect, it } from 'vitest'
import productsJson from '../public/data/products.json'
import ordersJson from '../public/data/orders.json'
import affinityJson from '../public/data/affinity.json'
import type { Affinity, Data, Orders, Product } from './engine/data'
import { baselineLayout, originalLayout } from './engine/layouts'
import { scoreLayout } from './engine/sim'
import { CHALLENGE_SWAPS, useStore } from './store'

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
    st().hoverSlot(62, 0, 0)
    const delta = st().preview!.delta
    const before = st().yours!.train.totalDist
    st().clickSlot(62)
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
