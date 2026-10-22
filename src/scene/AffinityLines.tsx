// scene/AffinityLines.tsx — arcs from the selected bay to the products most often bought with it
import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { useStore } from '../store';
import { RACK_HEIGHT, slotBox } from './coords';

const ARC = 12;

function arc(a: number, b: number): [number, number, number][] {
  const [ax, , az] = slotBox(a), [bx, , bz] = slotBox(b);
  const top = RACK_HEIGHT + 0.15, lift = 0.6 + 0.08 * Math.hypot(bx - ax, bz - az);
  return Array.from({ length: ARC + 1 }, (_, i) => {
    const f = i / ARC;
    return [ax + (bx - ax) * f, top + lift * Math.sin(Math.PI * f), az + (bz - az) * f];
  });
}

export function AffinityLines() {
  const selected = useStore(s => s.selected);
  const productAt = useStore(s => s.productAt);
  const assign = useStore(s => s.assign);
  const partners = useStore(s => s.partners);

  const arcs = useMemo(() => {
    if (selected === null || !partners.length) return [];
    return partners[productAt[selected]].map(q => arc(selected, assign[q]));
  }, [selected, productAt, assign, partners]);

  return arcs.map((pts, i) => (
    <Line key={i} points={pts} color="#8b3fd9" lineWidth={3 - i * 0.7} transparent opacity={0.9 - i * 0.2} />
  ));
}
