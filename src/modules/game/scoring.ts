// Scoring: 1 point per second of picking time saved over the whole test week
// (walking + forklift access; see core/engine/rules.ts).
// Star thresholds come from a greedy 10-swap search on the test week (~6,480 s is near perfect).
export const STAR_THRESHOLDS = [0, 1500, 4000] as const;   // seconds saved for 1, 2, 3 stars

export const pointsFor = (secondsSaved: number) => Math.round(secondsSaved);

export function starsFor(secondsSaved: number): 0 | 1 | 2 | 3 {
  if (secondsSaved >= STAR_THRESHOLDS[2]) return 3;
  if (secondsSaved >= STAR_THRESHOLDS[1]) return 2;
  if (secondsSaved > STAR_THRESHOLDS[0]) return 1;
  return 0;
}

// Feedback for one swap; delta is the change in total seconds (negative is good)
export function swapVerdict(delta: number): { text: string; tone: 'great' | 'good' | 'meh' | 'oops' } {
  if (delta < -300) return { text: 'Excellent move', tone: 'great' };
  if (delta < -100) return { text: 'Strong move', tone: 'great' };
  if (delta < -0.5) return { text: 'Faster', tone: 'good' };
  if (delta <= 0.5) return { text: 'No change', tone: 'meh' };
  return { text: 'Slower', tone: 'oops' };
}

/** "1 h 48 min" style duration for the end screen */
export function duration(seconds: number) {
  const mins = Math.round(Math.max(0, seconds) / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
}
