// engine/geometry.ts — layout constants and leg() exactly as in Plan v2, Section 5.1
export type Pt = { aisle: number; x: number; y: number; side: number };
export const AISLES = 5, BAYS = 10, BAY = 1.2, PITCH = 5, L = 15, Y0 = 2.1;
export const DOCK = 100;

export const pts: Pt[] = [];
for (let a = 0; a < AISLES; a++)
  for (let side = 0; side < 2; side++)
    for (let b = 0; b < BAYS; b++)
      pts.push({ aisle: a, x: a * PITCH, y: Y0 + BAY * b, side }); // slot = a*20 + side*10 + b
pts.push({ aisle: -1, x: 10, y: 0, side: -1 });                     // dock, index 100

export function leg(a: Pt, b: Pt) {
  if (a.aisle === b.aisle && a.aisle !== -1)
    return { d: Math.abs(a.y - b.y), pts: [b] };
  const front = a.y + b.y, back = 2 * L - a.y - b.y;
  const cy = front <= back ? 0 : L;                                 // tie -> front
  return { d: Math.min(front, back) + Math.abs(a.x - b.x),
           pts: [{ ...a, y: cy }, { ...b, y: cy }, b] };
}

// Slot geometry never changes, so precompute once (101 x 101)
export const D: number[][] = pts.map(p => pts.map(q => leg(p, q).d));
