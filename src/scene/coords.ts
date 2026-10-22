// scene/coords.ts — engine metres (x across, y deep from the front cross aisle) -> three.js world.
// The floor is centred on the origin; the dock side faces the camera (+z).
import { AISLES, BAY, BAYS, L, PITCH } from '../engine/geometry';

export const RACK_DEPTH = 1;
export const RACK_HEIGHT = 1.6;
export const AISLE_HALF = 1.5; // aisles are 3 m wide
const CX = ((AISLES - 1) * PITCH) / 2, CY = L / 2;

export const toWorld = (x: number, y: number, h = 0): [number, number, number] => [x - CX, h, CY - y];

// Centre of the rack box for a slot (slot = aisle*20 + side*10 + bay; side 0 = left of the aisle)
export function slotBox(slot: number): [number, number, number] {
  const aisle = Math.floor(slot / (2 * BAYS)), side = Math.floor(slot / BAYS) % 2, bay = slot % BAYS;
  const x = aisle * PITCH + (side ? 1 : -1) * (AISLE_HALF + RACK_DEPTH / 2);
  return toWorld(x, AISLE_HALF + BAY / 2 + BAY * bay, RACK_HEIGHT / 2);
}

export const FLOOR = {
  width: (AISLES - 1) * PITCH + 2 * (AISLE_HALF + RACK_DEPTH) + 4,
  depth: L + 9,
  centerZ: -1.5, // extra room in front for the dock
};
