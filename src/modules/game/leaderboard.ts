// High scores (Plan v2 stretch goal 5): stored in localStorage, so they live in this browser only.
export type HighScore = { name: string; points: number; stars: number; at: string; swaps?: number; assign?: number[] };
const KEY = 'pip-high-scores-v2';   // v2: points are seconds saved (v1 was metres)
export const MAX_SCORES = 8;

export function readScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HighScore[]) : [];
    return Array.isArray(list) ? list.filter(s => typeof s.points === 'number') : [];
  } catch {
    return [];
  }
}

export function addScore(entry: HighScore): HighScore[] {
  const list = [...readScores(), entry]
    .sort((a, b) => b.points - a.points || a.at.localeCompare(b.at))
    .slice(0, MAX_SCORES);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: keep in memory only */ }
  return list;
}

export const qualifies = (points: number, list = readScores()) =>
  points > 0 && (list.length < MAX_SCORES || points > list[list.length - 1].points);
