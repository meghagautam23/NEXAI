// scene/ItemIcons.tsx — a product-family symbol on top of every rack bay.
// One InstancedMesh per family (17 draw calls), each with its symbol painted on a canvas texture,
// so symbols follow their products when the layout changes. No font or image downloads.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, InstancedMesh, Object3D, SRGBColorSpace } from 'three';
import { CATEGORIES, OTHER, categoryOf, type Category } from '../engine/categories';
import { useStore } from '../store';
import { RACK_HEIGHT, slotBox } from './coords';

const SIZE = 0.78;      // metres, on a 0.92 x 1.13 m rack top
const LIFT = 0.012;     // just above the rack top
const noRaycast = () => null; // icons never catch clicks meant for the racks

function symbolTexture(symbol: string) {
  const px = 128, c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.93)'; g.fill();
  g.lineWidth = 4; g.strokeStyle = 'rgba(23,32,51,0.25)'; g.stroke();
  g.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(symbol, px / 2, px / 2 + 5);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Family({ cat, slots }: { cat: Category; slots: number[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const tex = useMemo(() => symbolTexture(cat.symbol), [cat.symbol]);
  useLayoutEffect(() => {
    const m = mesh.current!, o = new Object3D();
    o.rotation.x = -Math.PI / 2; // lie flat, top of the symbol towards the back of the floor
    slots.forEach((s, i) => {
      const [x, , z] = slotBox(s);
      o.position.set(x, RACK_HEIGHT + LIFT, z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = slots.length;
    m.instanceMatrix.needsUpdate = true;
  }, [slots]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 100]} raycast={noRaycast} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.05} depthWrite={false} />
    </instancedMesh>
  );
}

export function ItemIcons() {
  const assign = useStore(s => s.assign);
  const products = useStore(s => s.data?.products);
  const show = useStore(s => s.showIcons);

  const families = useMemo(() => {
    const by = new Map<string, number[]>();
    products?.forEach(p => {
      const k = categoryOf(p).key;
      if (assign[p.id] !== undefined) by.set(k, [...(by.get(k) ?? []), assign[p.id]]);
    });
    return [...CATEGORIES, OTHER].map(cat => ({ cat, slots: by.get(cat.key) ?? [] }));
  }, [assign, products]);

  if (!show) return null;
  return <>{families.map(f => <Family key={f.cat.key} cat={f.cat} slots={f.slots} />)}</>;
}
