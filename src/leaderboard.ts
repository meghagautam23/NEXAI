// leaderboard.ts — finished Challenge layouts, saved in this browser only (localStorage).
// Storage can be missing or throw (private windows, blocked site data); the game works without it.

export type Entry = {
  id: string;
  name: string;
  total: number;      // test-week walking distance (m)
  vsBaseline: number; // fraction, negative = better than Baseline
  swaps: number;
  at: string;         // ISO date
  assign: number[];   // the layout, so it can be loaded again
};

const KEY = 'warehouse-twin:leaderboard:v1';
export const MAX_ENTRIES = 50;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStorage = (): StorageLike | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

const valid = (e: unknown): e is Entry => {
  const x = e as Entry;
  return !!x && typeof x.name === 'string' && typeof x.total === 'number' && typeof x.vsBaseline === 'number'
    && typeof x.swaps === 'number' && Array.isArray(x.assign) && x.assign.length === 100;
};

// Best (shortest walk) first; ties by earlier save
export const ranked = (entries: Entry[]) =>
  [...entries].sort((a, b) => a.total - b.total || a.at.localeCompare(b.at));

export function readBoard(storage = defaultStorage()): Entry[] {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? ranked(parsed.filter(valid)) : [];
  } catch {
    return [];
  }
}

// Returns the new board (best MAX_ENTRIES kept) and whether it was persisted
export function addEntry(entry: Entry, storage = defaultStorage()): { board: Entry[]; saved: boolean } {
  const board = ranked([...readBoard(storage), entry]).slice(0, MAX_ENTRIES);
  try {
    if (!storage) return { board, saved: false };
    storage.setItem(KEY, JSON.stringify(board));
    return { board, saved: true };
  } catch {
    return { board, saved: false };
  }
}
