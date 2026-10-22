// scene/Racks.tsx — 100 rack bays as one InstancedMesh (one draw call); click two bays to swap them
import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { BAY } from '../engine/geometry';
import { samePickPoint } from '../engine/layouts';
import { useStore } from '../store';
import { COST, VELOCITY, WEIGHT, weightIndex } from '../ui/palette';
import { RACK_DEPTH, RACK_HEIGHT, slotBox } from './coords';

const SLOTS = 100;
const LOW = new Color('#c9d3df'), HIGH = new Color('#1f5fa8');
const TO_PICK = new Color('#f28c28'), PICKED = new Color('#3fa34d');
const SELECTED = new Color('#8b3fd9'), NO_TARGET = new Color('#8d949e'), WHITE = new Color('#ffffff');
const COLD = new Color('#d7dbe0'), WARM = new Color('#ffd166'), HOT = new Color('#c8102e');

// Heatmap: unvisited grey, then yellow -> red as visits approach the busiest bay
function heat(c: Color, visits: number, max: number) {
  if (!visits) return c.copy(COLD);
  const f = max > 1 ? (visits - 1) / (max - 1) : 1;
  return c.lerpColors(WARM, HOT, f);
}

export function Racks() {
  const mesh = useRef<InstancedMesh>(null);
  const assign = useStore(s => s.assign);
  const products = useStore(s => s.data?.products);
  const routeSlots = useStore(s => s.routeSlots);
  const picked = useStore(s => s.picked);
  const selected = useStore(s => s.selected);
  const hovered = useStore(s => s.hover?.slot ?? null);
  const rackColor = useStore(s => s.rackColor);
  const visits = useStore(s => s.visits);

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
  // evenly; product ids are already in rank order). Then the current order, selection and hover on top.
  useLayoutEffect(() => {
    const m = mesh.current!;
    if (!products || assign.length !== products.length) return;
    const c = new Color(), last = products.length - 1;
    if (rackColor === 'visits') {
      const max = Math.max(...visits);
      for (let s = 0; s < SLOTS; s++) m.setColorAt(s, heat(c, visits[s], max));
    } else if (rackColor === 'velocity' || rackColor === 'cost' || rackColor === 'weight') {
      assign.forEach((slot, p) => {
        const pr = products[p];
        m.setColorAt(slot, c.set(rackColor === 'velocity' ? VELOCITY[pr.abcVelocity]
          : rackColor === 'cost' ? COST[pr.abcCost] : WEIGHT[weightIndex(pr.weightClass)]));
      });
    } else {
      assign.forEach((slot, p) => m.setColorAt(slot, c.lerpColors(HIGH, LOW, p / last)));
      routeSlots.forEach((slot, i) => m.setColorAt(slot, i < picked ? PICKED : TO_PICK));
    }
    if (selected !== null) {
      m.setColorAt(selected, SELECTED);
      for (let s = 0; s < SLOTS; s++) if (samePickPoint(selected, s)) m.setColorAt(s, NO_TARGET);
    }
    if (hovered !== null && hovered !== selected) {
      m.getColorAt(hovered, c);
      m.setColorAt(hovered, c.lerp(WHITE, 0.35));
    }
    m.instanceColor!.needsUpdate = true;
  }, [assign, products, routeSlots, picked, selected, hovered, rackColor, visits]);

  const { clickSlot, hoverSlot } = useStore.getState();
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    hoverSlot(e.instanceId!, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };
  const onOut = () => { document.body.style.cursor = ''; hoverSlot(null); };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // the click that ends a camera drag is not a selection
    clickSlot(e.instanceId!);
  };

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SLOTS]}
                   onPointerMove={onMove} onPointerOut={onOut} onClick={onClick}>
      <boxGeometry args={[RACK_DEPTH * 0.92, RACK_HEIGHT, BAY * 0.94]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
