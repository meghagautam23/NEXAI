// scene/Racks.tsx — 100 rack bays as one InstancedMesh (one draw call)
import { useLayoutEffect, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { BAY } from '../engine/geometry';
import { useStore } from '../store';
import { RACK_DEPTH, RACK_HEIGHT, slotBox } from './coords';

const SLOTS = 100;
const LOW = new Color('#c9d3df'), HIGH = new Color('#1f5fa8');
const TO_PICK = new Color('#f28c28'), PICKED = new Color('#3fa34d');

export function Racks() {
  const mesh = useRef<InstancedMesh>(null);
  const assign = useStore(s => s.assign);
  const products = useStore(s => s.data?.products);
  const routeSlots = useStore(s => s.routeSlots);
  const picked = useStore(s => s.picked);

  useLayoutEffect(() => {
    const m = mesh.current!, o = new Object3D();
    for (let s = 0; s < SLOTS; s++) {
      o.position.set(...slotBox(s));
      o.updateMatrix();
      m.setMatrixAt(s, o.matrix);
      m.setColorAt(s, LOW); // instanceColor stays null until setColorAt is called
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  // Base colour: darker blue = picked more often in the train weeks (by rank, so the shades spread
  // evenly; product ids are already in rank order). Then the current order on top.
  useLayoutEffect(() => {
    const m = mesh.current!;
    if (!products || assign.length !== products.length) return;
    const c = new Color(), last = products.length - 1;
    assign.forEach((slot, p) => m.setColorAt(slot, c.lerpColors(HIGH, LOW, p / last)));
    routeSlots.forEach((slot, i) => m.setColorAt(slot, i < picked ? PICKED : TO_PICK));
    m.instanceColor!.needsUpdate = true;
  }, [assign, products, routeSlots, picked]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SLOTS]}>
      <boxGeometry args={[RACK_DEPTH * 0.92, RACK_HEIGHT, BAY * 0.94]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
