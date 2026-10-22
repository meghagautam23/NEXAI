// The 3D warehouse: <Canvas> with an angled perspective camera and capped OrbitControls (Section 6.1).
// Pure view: layout, selection and replay orders come in as props, so the twin and the game can both use it.
import { useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Order } from '../../../core/engine/types';
import { useData } from '../../../core/appStore';
import { Floor } from './Floor';
import { Picker } from './Picker';
import { Racks, type RacksProps } from './Racks';
import { PITCH } from '../../../core/engine/geometry';
import { useReplay } from '../replayStore';
import { ShelfCards } from './ShelfCards';
import { CENTER } from './coords';

export function WarehouseScene({ racks, orders, getAssign, children, picker = true }: {
  racks: RacksProps; orders: Order[]; getAssign: () => readonly number[]; children?: ReactNode; picker?: boolean;
}) {
  const data = useData();
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [CENTER[0], 20, 12], fov: 42 }} onPointerMissed={() => racks.onSlotHover?.(null)}>
      <color attach="background" args={['#dfe3e8']} />
      <hemisphereLight args={['#ffffff', '#c9ced6', 1.15]} />
      <directionalLight position={[8, 20, 10]} intensity={1.6} />
      <Floor />
      <Racks {...racks} />
      <ShelfCards at={racks.at} selected={racks.selected} hovered={racks.hovered}
        onSlotClick={racks.onSlotClick} onSlotHover={racks.onSlotHover} />
      {children}
      {picker && <Picker orders={orders} getAssign={getAssign} pick={data.pick} />}
      <CameraRig />
      <OrbitControls
        makeDefault target={CENTER} enablePan={false}
        minDistance={7} maxDistance={60} minPolarAngle={0.25} maxPolarAngle={1.15}
      />
    </Canvas>
  );
}

// Standard viewing angle: looking down the aisles from the dock side, about 52 degrees up
const VIEW_DIR = new Vector3(0, 1.3, 1).normalize();

// Eases the camera to the whole floor or to one aisle; pulls back on narrow (portrait) screens
function CameraRig() {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as { target: Vector3; update: () => void } | null;
  const aspect = useThree(s => s.size.width / s.size.height);
  const focus = useReplay(s => s.focus);
  const goal = useRef<{ target: Vector3; dist: number } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;   // canvas not measured yet
    const portrait = Math.max(0, 1.2 - aspect);
    goal.current = focus === null
      ? { target: new Vector3(...CENTER), dist: 28 + portrait * 30 }
      : { target: new Vector3(focus * PITCH, 0, CENTER[2]), dist: 11 + portrait * 12 };
  }, [focus, aspect]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 6);
    const want = g.target.clone().addScaledVector(VIEW_DIR, g.dist);
    controls.target.lerp(g.target, k);
    camera.position.lerp(want, k);
    controls.update();
    if (camera.position.distanceTo(want) < 0.02 && controls.target.distanceTo(g.target) < 0.02) goal.current = null;   // hand back to the player
  });
  return null;
}
