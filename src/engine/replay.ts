// engine/replay.ts — turns a route into a timeline the picker animation plays back.
// Walk steps come only from leg() waypoints, so the animated distance always equals the score.
import { DOCK, leg, pts, type Pt } from './geometry';
import { PICK_TIME, WALK_SPEED } from './sim';
import type { Order } from './data';

type Base = { t0: number; dur: number; d0: number }; // start time (s), duration (s), distance walked before (m)
export type Step = Base & ({ kind: 'walk'; from: Pt; to: Pt } | { kind: 'pick'; at: Pt; slot: number });
export type Timeline = { steps: Step[]; dist: number; time: number; slots: number[]; waypoints: Pt[] };

export function buildTimeline(path: number[]): Timeline {
  const steps: Step[] = [];
  const waypoints: Pt[] = [pts[path[0]]];
  let t = 0, d = 0;
  for (let i = 1; i < path.length; i++) {
    let cur = pts[path[i - 1]];
    for (const w of leg(pts[path[i - 1]], pts[path[i]]).pts) {
      const len = Math.abs(w.x - cur.x) + Math.abs(w.y - cur.y); // legs are axis-aligned
      if (len > 0) {
        steps.push({ kind: 'walk', from: cur, to: w, t0: t, dur: len / WALK_SPEED, d0: d });
        t += len / WALK_SPEED; d += len; waypoints.push(w);
      }
      cur = w;
    }
    if (path[i] !== DOCK) {
      steps.push({ kind: 'pick', at: pts[path[i]], slot: path[i], t0: t, dur: PICK_TIME, d0: d });
      t += PICK_TIME;
    }
  }
  return { steps, dist: d, time: t, slots: path.filter(s => s !== DOCK), waypoints };
}

export type Sample = { x: number; y: number; dist: number; picked: number; picking: boolean; heading: number | null };

// Picker state at time t (s) into the order. heading is the walking direction in engine
// coordinates (atan2 of dx, dy), null while standing.
export function sampleTimeline(tl: Timeline, t: number): Sample {
  let picked = 0;
  for (const s of tl.steps) {
    if (t < s.t0 + s.dur) {
      if (s.kind === 'pick') return { x: s.at.x, y: s.at.y, dist: s.d0, picked, picking: t >= s.t0, heading: null };
      const f = Math.max(0, (t - s.t0) / s.dur);
      const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y;
      return { x: s.from.x + dx * f, y: s.from.y + dy * f, dist: s.d0 + f * (Math.abs(dx) + Math.abs(dy)),
               picked, picking: false, heading: Math.atan2(dx, dy) };
    }
    if (s.kind === 'pick') picked++;
  }
  const dock = pts[DOCK];
  return { x: dock.x, y: dock.y, dist: tl.dist, picked, picking: false, heading: null };
}

// k evenly spaced, deterministic indices out of n
export function evenly(n: number, k: number): number[] {
  const step = n / k;
  return Array.from({ length: Math.min(k, n) }, (_, i) => Math.floor(i * step));
}

// Evenly spaced sample of orders for the on-screen replay
export const sampleOrders = (orders: Order[], k = 25) => evenly(orders.length, k);
