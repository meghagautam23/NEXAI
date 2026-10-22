// 100 rack slots as one InstancedMesh (one draw call). Colour by category, class, FL, picks or visits; plus selection.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { samePickPoint } from '../../../core/engine/layouts';
import { useData } from '../../../core/appStore';
import { ABC_COLOUR, CATEGORY, flColour } from '../../../core/categories';
import type { ColourBy } from '../replayStore';
import { BAY_LEN, RACK_DEPTH, RACK_HEIGHT, rackCenter } from './coords';

const COLD = new Color('#4f9be0'), MID = new Color('#ffc93c'), HOT = new Color('#e4572e');
const HEAT_LO = new Color('#e8edf2'), HEAT_HI = new Color('#c2185b');
const SELECTED = new Color('#33a867'), PARTNER = new Color('#9b5de5'), DISABLED = new Color('#b8bec6');

export type RacksProps = {
  at: number[];                         // slot -> product
  colourBy: ColourBy; visits: number[];
  selected?: number | null; hovered?: number | null; partnerSlots?: Set<number>;
  onSlotClick?: (slot: number) => void;
  onSlotHover?: (slot: number | null, e?: ThreeEvent<PointerEvent>) => void;
};

export function Racks({ at, colourBy, visits, selected = null, hovered = null, partnerSlots, onSlotClick, onSlotHover }: RacksProps) {
  const ref = useRef<InstancedMesh>(null);
  const data = useData();

  useLayoutEffect(() => {
    const o = new Object3D();
    for (let s = 0; s < 100; s++) {
      o.position.set(...rackCenter(s));
      o.updateMatrix();
      ref.current!.setMatrixAt(s, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);

  // setColorAt for all 100 instances, then instanceColor.needsUpdate (Section 6.1)
  useEffect(() => {
    const mesh = ref.current!;
    const c = new Color();
    const maxVisits = Math.max(1, ...visits);
    for (let s = 0; s < 100; s++) {
      const p = data.products[at[s]];
      if (colourBy === 'busy') c.copy(HEAT_LO).lerp(HEAT_HI, Math.sqrt(visits[s] / maxVisits));
      else if (colourBy === 'category') c.set(CATEGORY[p.category].colour);
      else if (colourBy === 'class') c.set(ABC_COLOUR[p.abc]);
      else if (colourBy === 'fl') c.setStyle(flColour(p.fl));
      else {
        const f = (p.picksTrain - data.minPicks) / (data.maxPicks - data.minPicks || 1);
        if (f < 0.5) c.copy(COLD).lerp(MID, f * 2); else c.copy(MID).lerp(HOT, f * 2 - 1);
      }
      if (selected !== null) {
        if (s === selected) c.copy(SELECTED);
        else if (samePickPoint(s, selected)) c.copy(DISABLED);   // not a valid swap target
        else if (partnerSlots?.has(s)) c.copy(PARTNER);
      }
      if (s === hovered && s !== selected) c.offsetHSL(0, 0, -0.12);
      mesh.setColorAt(s, c);
    }
    mesh.instanceColor!.needsUpdate = true;
  }, [at, selected, hovered, colourBy, visits, partnerSlots, data]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, 100]}
      onClick={e => { e.stopPropagation(); if (e.delta > 4) return; onSlotClick?.(e.instanceId!); }}
      onPointerMove={e => { e.stopPropagation(); onSlotHover?.(e.instanceId ?? null, e); }}
      onPointerOut={() => onSlotHover?.(null)}
    >
      <boxGeometry args={[RACK_DEPTH * 0.92, RACK_HEIGHT, BAY_LEN * 0.92]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}
