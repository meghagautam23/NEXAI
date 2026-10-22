// scene/RushPickers.tsx — the peak-day shift in 3D: every picker walks its trips against the shift clock.
// Trips come from the simulation (engine/rush.ts); walking follows leg() waypoints via buildTimeline, then the
// picker stands at the dock packing until the trip's end time.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { DOCK, pts } from '../engine/geometry';
import { buildTimeline, sampleTimeline, type Timeline } from '../engine/replay';
import { rushStats } from '../engine/rush';
import { rushOptions, useStore } from '../store';
import { toWorld } from './coords';

const PICKER_COLORS = ['#d6452f', '#2a7fd6', '#2f9e44'];
const STATS_EVERY = 0.15; // s of wall time

function Body({ color, refCb }: { color: string; refCb: (g: Group | null) => void }) {
  return (
    <group ref={refCb}>
      <mesh position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.28, 0.9, 4, 12]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshLambertMaterial color="#f1c9a5" />
      </mesh>
      <mesh position={[0, 1.62, 0.18]}>
        <boxGeometry args={[0.3, 0.08, 0.12]} />
        <meshLambertMaterial color="#222" />
      </mesh>
    </group>
  );
}

export function RushPickers() {
  const result = useStore(s => s.rush.result);
  const pickers = useStore(s => s.rush.settings.pickers);
  const bodies = useRef<(Group | null)[]>([]);
  const sinceStats = useRef(STATS_EVERY);
  const lastSlots = useRef('');

  // Timelines per trip, and each picker's trips in order
  const plan = useMemo(() => {
    if (!result) return null;
    const timelines = new Map<number, Timeline>();
    result.trips.forEach((t, i) => timelines.set(i, buildTimeline(t.path)));
    const byPicker = Array.from({ length: pickers }, (_, p) => result.trips.map((t, i) => ({ t, i })).filter(x => x.t.picker === p));
    return { timelines, byPicker };
  }, [result, pickers]);

  useFrame((_, delta) => {
    const s = useStore.getState();
    const { rush } = s;
    if (!rush.active || !rush.result || !plan) return;
    let clock = rush.clock;
    if (rush.playing && !rush.finished) clock = Math.min(rush.end, clock + Math.min(delta, 0.1) * rush.speed);
    const finished = clock >= rush.end;

    const dock = pts[DOCK];
    const active: number[] = [];
    plan.byPicker.forEach((trips, p) => {
      const g = bodies.current[p];
      if (!g) return;
      const cur = trips.find(x => x.t.start <= clock && clock < x.t.end);
      let x = dock.x + (p - (pickers - 1) / 2) * 1.2, y = dock.y; // idle pickers wait side by side at the dock
      let heading: number | null = null;
      if (cur) {
        const tl = plan.timelines.get(cur.i)!;
        const smp = sampleTimeline(tl, Math.min(clock - cur.t.start, tl.time));
        if (clock - cur.t.start < tl.time) { x = smp.x; y = smp.y; heading = smp.heading; }
        tl.slots.slice(smp.picked).forEach(sl => active.push(sl));
      }
      const [wx, , wz] = toWorld(x, y);
      g.position.set(wx, 0, wz);
      if (heading !== null) g.rotation.y = Math.atan2(Math.sin(heading), -Math.cos(heading));
    });

    // Racks still to pick in any running trip turn orange
    const key = active.join(',');
    const patch: Record<string, unknown> = {};
    if (key !== lastSlots.current) { lastSlots.current = key; patch.routeSlots = active; patch.picked = 0; }
    sinceStats.current += delta;
    if (sinceStats.current >= STATS_EVERY || finished) {
      sinceStats.current = 0;
      patch.rush = { ...rush, clock, finished, playing: finished ? false : rush.playing,
                     stats: rushStats(rush.result, clock, rushOptions(rush.settings).cutoff) };
    } else patch.rush = { ...rush, clock };
    useStore.setState(patch);
  });

  if (!result) return null;
  return (
    <>
      {Array.from({ length: pickers }, (_, p) => (
        <Body key={p} color={PICKER_COLORS[p % PICKER_COLORS.length]} refCb={g => { bodies.current[p] = g; }} />
      ))}
    </>
  );
}
