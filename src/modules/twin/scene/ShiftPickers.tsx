// Peak shift in 3D: every picker at its simulated position, the shift clock advanced at playback speed
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { trackAt } from '../../../core/engine/shift';
import { PICKER_COLOURS, useScenario } from '../scenarioStore';
import { to3 } from './coords';


export function ShiftPickers() {
  const result = useScenario(s => s.shift.result);
  const groups = useRef<(Group | null)[]>([]);
  const lastPush = useRef(0);

  useFrame((_, delta) => {
    const { shift, setShift } = useScenario.getState();
    if (!shift.result) return;
    let clock = shift.clock;
    if (shift.playing) {
      clock = Math.min(shift.end, clock + Math.min(delta, 0.1) * shift.speed);
      const now = performance.now();
      if (now - lastPush.current > 100 || clock >= shift.end) {
        lastPush.current = now;
        setShift({ clock, playing: clock < shift.end });
      }
    }
    shift.result.tracks.forEach((tr, k) => {
      const g = groups.current[k];
      if (!g) return;
      const p = trackAt(tr, clock);
      g.position.set(...to3(p.x + (k % 2 ? 0.25 : -0.25) * (p.trip < 0 ? 1 : 0), p.y));   // idle pickers stand side by side
      g.visible = true;
    });
  });

  if (!result) return null;
  return (
    <group>
      {result.tracks.map((_, k) => (
        <group key={k} ref={el => { groups.current[k] = el; }} visible={false}>
          <mesh position={[0, 0.75, 0]}>
            <capsuleGeometry args={[0.28, 0.9, 4, 12]} />
            <meshStandardMaterial color="#2b3446" />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
            <meshStandardMaterial color={PICKER_COLOURS[k % PICKER_COLOURS.length]} />
          </mesh>
          <mesh position={[0, 1.66, 0]}>
            <sphereGeometry args={[0.24, 20, 16]} />
            <meshStandardMaterial color="#c99a7a" />
          </mesh>
          <mesh position={[0, 1.78, 0]}>
            <sphereGeometry args={[0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={PICKER_COLOURS[k % PICKER_COLOURS.length]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
