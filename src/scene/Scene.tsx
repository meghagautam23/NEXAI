// scene/Scene.tsx — canvas, camera, lights and the warehouse
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useStore } from '../store';
import { AffinityLines } from './AffinityLines';
import { ZoneFloor } from './ZoneFloor';
import { ItemIcons } from './ItemIcons';
import { ShelfCards } from './ShelfCards';
import { RushPickers } from './RushPickers';
import { Dock, Floor } from './Warehouse';
import { Picker } from './Picker';
import { Racks } from './Racks';
import { CameraRig } from './CameraRig';

export function Scene() {
  const ready = useStore(s => s.data !== null);
  const rush = useStore(s => s.rush.active);
  const photos = useStore(s => s.labels === 'photos');
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [-1.5, 19, 21], fov: 45 }} gl={{ antialias: true }}>
      <color attach="background" args={['#eef1f5']} />
      <hemisphereLight args={['#ffffff', '#b8c0cc', 1.1]} />
      <directionalLight position={[8, 20, 12]} intensity={1.4} />
      <Floor />
      <Dock />
      <Racks />
      <ZoneFloor />
      {ready && <ItemIcons />}
      {ready && photos && <ShelfCards />}
      {ready && !rush && <Picker />}
      {ready && rush && <RushPickers />}
      {ready && <AffinityLines />}
      <OrbitControls makeDefault enableDamping minDistance={6} maxDistance={60}
                     maxPolarAngle={1.35} minPolarAngle={0.15} />
      <CameraRig />
    </Canvas>
  );
}
