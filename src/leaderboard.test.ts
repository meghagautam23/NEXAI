import { describe, expect, it } from 'vitest'
import { MAX_ENTRIES, addEntry, readBoard, type Entry } from './leaderboard'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}
const entry = (name: string, total: number, at = '2026-10-22T10:00:00Z'): Entry =>
  ({ id: name, name, total, vsBaseline: total / 49414 - 1, swaps: 3, at, assign: [...Array(100).keys()] })

describe('leaderboard', () => {
  it('keeps entries sorted by shortest walk, ties by earlier save', () => {
    const s = memory()
    addEntry(entry('b', 49300), s)
    addEntry(entry('a', 49000), s)
    addEntry(entry('c', 49300, '2026-10-22T09:00:00Z'), s)
    expect(readBoard(s).map(e => e.name)).toEqual(['a', 'c', 'b'])
  })
  it(`keeps only the best ${MAX_ENTRIES}`, () => {
    const s = memory()
    for (let i = 0; i < MAX_ENTRIES + 5; i++) addEntry(entry(`p${i}`, 50000 - i), s)
    const board = readBoard(s)
    expect(board).toHaveLength(MAX_ENTRIES)
    expect(board[0].name).toBe(`p${MAX_ENTRIES + 4}`)
  })
  it('survives corrupt data, invalid rows and storage that throws', () => {
    const s = memory()
    s.setItem('warehouse-twin:leaderboard:v2', '{not json')
    expect(readBoard(s)).toEqual([])
    s.setItem('warehouse-twin:leaderboard:v2', JSON.stringify([{ name: 'x' }, entry('ok', 49000)]))
    expect(readBoard(s).map(e => e.name)).toEqual(['ok'])
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readBoard(broken)).toEqual([])
    expect(addEntry(entry('z', 1), broken)).toMatchObject({ saved: false, board: [{ name: 'z' }] })
    expect(addEntry(entry('z', 1), null).saved).toBe(false)
  })
})
