// ui/palette.ts — colours for the classification views (racks, floor zones and legends share them)
export const VELOCITY = { A: '#1b7f5b', B: '#7cc4a4', C: '#d9ece3' } as const;
export const COST = { A: '#c9a227', B: '#a7b1bd', C: '#b0703f' } as const;
// FL01 (lightest) .. FL07 (heaviest)
export const WEIGHT = ['#f1e7dc', '#e2cdb6', '#cfae8c', '#b98c63', '#9a6a3e', '#734a24', '#4a2c12'];
export const HEAVY_FLOOR = '#e8b77a';
export const weightIndex = (fl: string) => Math.min(6, Math.max(0, Number(fl.slice(2)) - 1));
