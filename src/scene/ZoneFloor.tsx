// scene/ZoneFloor.tsx — floor patches under the racks: ABC zones, or the heavy-item front bays
import { useLayoutEffect, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { BAY } from '../engine/geometry';
import { isFrontSlot, zoneOf } from '../engine/rules';
import { useStore } from '../store';
import { HEAVY_FLOOR, VELOCITY } from '../ui/palette';
import { RACK_DEPTH, slotBox } from './coords';

const SLOTS = 100, FLOOR = new Color('#d9dde3');

export function ZoneFloor() {
  const mesh = useRef<InstancedMesh>(null);
  const rackColor = useStore(s => s.rackColor);
  const visible = rackColor === 'velocity' || rackColor === 'weight';

  useLayoutEffect(() => {
    const m = mesh.current!, o = new Object3D(), c = new Color();
    for (let s = 0; s < SLOTS; s++) {
      const [x, , z] = slotBox(s);
      o.position.set(x, 0.015, z); o.updateMatrix(); m.setMatrixAt(s, o.matrix);
      m.setColorAt(s, rackColor === 'velocity' ? c.set(VELOCITY[zoneOf[s]])
        : isFrontSlot(s) ? c.set(HEAVY_FLOOR) : FLOOR);
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, [rackColor]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SLOTS]} visible={visible}>
      <boxGeometry args={[RACK_DEPTH + 0.5, 0.02, BAY]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
