// Floor, painted aisle/cross-aisle centerlines and the PACKING dock (Section 6.1)
import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { AISLES, L, PITCH, pts, DOCK } from '../../../core/engine/geometry';
import { CENTER, to3 } from './coords';

const LINE = '#f2b705';

function Stripe({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <mesh position={to3(x, y, 0.01)} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={LINE} />
    </mesh>
  );
}

export function Floor() {
  const width = (AISLES - 1) * PITCH;
  const dock = pts[DOCK];
  return (
    <group>
      <mesh position={[CENTER[0], 0, CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 12, L + 10]} />
        <meshStandardMaterial color="#b9bfc7" roughness={0.95} />
      </mesh>
      {[...Array(AISLES).keys()].map(a => <Stripe key={a} x={a * PITCH} y={L / 2} w={0.14} h={L} />)}
      <Stripe x={width / 2} y={0} w={width + 0.14} h={0.14} />
      <Stripe x={width / 2} y={L} w={width + 0.14} h={0.14} />
      <mesh position={to3(dock.x, dock.y - 1.6, 0.4)}>
        <boxGeometry args={[3.2, 0.8, 1.6]} />
        <meshStandardMaterial color="#2b3446" />
      </mesh>
      <Label text="PACKING" position={to3(dock.x, dock.y - 1.6, 0.81)} />
    </group>
  );
}

// Text drawn into a canvas texture, laid flat on top of the dock
function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3, 0.75]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}
