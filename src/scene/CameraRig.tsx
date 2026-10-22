// scene/CameraRig.tsx — eases the camera to the whole floor or to one aisle, then hands control back to
// the player (aisle camera idea from Jayesh Pani's version)
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useStore } from '../store';
import { toWorld } from './coords';

const VIEW = new Vector3(0, 19, 21.5).normalize();   // looking down the aisles from the dock side
const FLOOR_TARGET = new Vector3(-1.5, 0, -0.5);

export function CameraRig() {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const aspect = useThree(s => s.size.width / s.size.height);
  const focus = useStore(s => s.focus);
  const goal = useRef<{ target: Vector3; dist: number } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const portrait = Math.max(0, 1.2 - aspect);   // pull back on narrow screens
    if (focus === null) goal.current = { target: FLOOR_TARGET.clone(), dist: 28.7 + portrait * 30 };
    else {
      const [x, , z] = toWorld(focus * 5, 7.5);
      goal.current = { target: new Vector3(x, 0, z), dist: 12 + portrait * 12 };
    }
  }, [focus, aspect]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 6);
    const want = g.target.clone().addScaledVector(VIEW, g.dist);
    controls.target.lerp(g.target, k);
    camera.position.lerp(want, k);
    controls.update();
    if (camera.position.distanceTo(want) < 0.02 && controls.target.distanceTo(g.target) < 0.02) goal.current = null;
  });
  return null;
}
