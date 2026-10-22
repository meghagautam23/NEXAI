// scene/Warehouse.tsx — static floor, aisle markings and the packing dock
import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { AISLES, L, PITCH, pts, DOCK } from '../engine/geometry';
import { FLOOR, toWorld } from './coords';

const LINE = 0.08, MARK = '#e3b341';

function Stripe({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const [ax, , az] = toWorld(x0, y0), [bx, , bz] = toWorld(x1, y1);
  return (
    <mesh position={[(ax + bx) / 2, 0.01, (az + bz) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[Math.abs(bx - ax) || LINE, Math.abs(bz - az) || LINE]} />
      <meshBasicMaterial color={MARK} />
    </mesh>
  );
}

export function Floor() {
  const width = (AISLES - 1) * PITCH;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, FLOOR.centerZ]}>
        <planeGeometry args={[FLOOR.width, FLOOR.depth]} />
        <meshLambertMaterial color="#d9dde3" />
      </mesh>
      {/* walking centerlines: the picker only ever moves along these */}
      {[...Array(AISLES).keys()].map(a => <Stripe key={a} x0={a * PITCH} y0={0} x1={a * PITCH} y1={L} />)}
      <Stripe x0={0} y0={0} x1={width} y1={0} />
      <Stripe x0={0} y0={L} x1={width} y1={L} />
    </group>
  );
}

// Text painted onto a canvas texture: no font download, so it works offline at the demo
function useTextTexture(text: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d2430'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = '600 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 4);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
}

export function Dock() {
  const d = pts[DOCK];
  const [x, , z] = toWorld(d.x, d.y - 2.2);
  const label = useTextTexture('PACKING');
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 1, 1.6]} />
        <meshLambertMaterial color="#8a5a2b" />
      </mesh>
      <mesh position={[0, 1.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={label} />
      </mesh>
    </group>
  );
}
