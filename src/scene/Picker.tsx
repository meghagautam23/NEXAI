// scene/Picker.tsx — the animated picker and the replay driver.
// Each frame advances simulated time, samples the order's timeline and moves the picker.
// Pushes the readout to the store a few times per second rather than every frame.
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { DOCK, pts } from '../engine/geometry';
import { buildTimeline, sampleTimeline, type Timeline } from '../engine/replay';
import { routeOrder, slotsOf } from '../engine/sim';
import { useStore } from '../store';
import { toWorld } from './coords';

const HUD_EVERY = 0.1; // s of wall time

type Run = { key: number; idx: number; t: number; tl: Timeline | null; doneDist: number; doneTime: number; sinceHud: number; picked: number };

export function Picker() {
  const body = useRef<Group>(null);
  const run = useRef<Run>({ key: -1, idx: 0, t: 0, tl: null, doneDist: 0, doneTime: 0, sinceHud: HUD_EVERY, picked: -1 });
  const [route, setRoute] = useState<[number, number, number][]>([]);

  useFrame((_, delta) => {
    const s = useStore.getState();
    if (!s.data || !s.sample.length || !body.current) return;
    const r = run.current;
    const orders = s.data.orders.test;

    const start = (idx: number) => {
      r.idx = idx; r.t = 0; r.picked = -1;
      r.tl = buildTimeline(routeOrder(slotsOf(orders[s.sample[idx]], s.assign)).path);
      setRoute(r.tl.waypoints.map(w => toWorld(w.x, w.y, 0.05)));
      useStore.setState({ routeSlots: r.tl.slots, picked: 0 });
    };
    if (r.key !== s.replayKey) { r.key = s.replayKey; r.doneDist = 0; r.doneTime = 0; start(0); }
    const tl = r.tl!;
    const done = r.idx >= s.sample.length - 1 && r.t >= tl.time;

    if (s.playing && !done) {
      r.t += Math.min(delta, 0.1) * s.speed;
      if (r.t >= tl.time && r.idx < s.sample.length - 1) {
        r.doneDist += tl.dist; r.doneTime += tl.time;
        start(r.idx + 1);
      }
    }

    const p = sampleTimeline(r.tl!, Math.min(r.t, r.tl!.time));
    const [x, , z] = toWorld(p.x, p.y);
    body.current.position.set(x, p.picking ? 0.08 * Math.abs(Math.sin(r.t * 2)) : 0, z);
    if (p.heading !== null) body.current.rotation.y = Math.atan2(Math.sin(p.heading), -Math.cos(p.heading));

    if (p.picked !== r.picked) { r.picked = p.picked; useStore.setState({ picked: p.picked }); }
    r.sinceHud += delta;
    if (r.sinceHud >= HUD_EVERY || done) {
      r.sinceHud = 0;
      const order = orders[s.sample[r.idx]];
      useStore.setState({ hud: {
        index: r.idx, orderId: order.id, lines: order.lines.length,
        dist: r.doneDist + p.dist, time: r.doneTime + Math.min(r.t, r.tl!.time), done,
      } });
    }
  });

  const dock = pts[DOCK];
  return (
    <>
      {route.length > 1 && <Line points={route} color="#f28c28" lineWidth={2} dashed dashSize={0.4} gapSize={0.25} />}
      <group ref={body} position={toWorld(dock.x, dock.y)}>
        <mesh position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.28, 0.9, 4, 12]} />
          <meshLambertMaterial color="#d6452f" />
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
    </>
  );
}
