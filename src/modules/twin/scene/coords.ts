// Plan coordinates (x, y on the floor) -> three.js (x, height, -y), so x reads left to right
// and the front cross aisle / dock sit nearest the camera.
import { AISLES, L, PITCH, pts } from '../../../core/engine/geometry';

export const RACK_DEPTH = 1, RACK_HEIGHT = 2.2, BAY_LEN = 1.2, AISLE_HALF = 1.5;
export const CENTER: [number, number, number] = [((AISLES - 1) * PITCH) / 2, 0, -L / 2];

export const to3 = (x: number, y: number, h = 0): [number, number, number] => [x, h, -y];

// Rack box centre for a slot: side 0 = left of the aisle, side 1 = right
export function rackCenter(slot: number): [number, number, number] {
  const p = pts[slot];
  const x = p.x + (p.side === 0 ? -1 : 1) * (AISLE_HALF + RACK_DEPTH / 2);
  return to3(x, p.y, RACK_HEIGHT / 2);
}
