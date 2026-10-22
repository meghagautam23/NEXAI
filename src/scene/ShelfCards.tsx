// scene/ShelfCards.tsx — a product card standing above every rack, always turned to the camera.
// Clicking or hovering a card is the same as clicking or hovering its shelf. (From Jayesh Pani's version.)
import { Billboard } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { Texture } from 'three';
import { useStore } from '../store';
import { buildCardAtlas, cellUv } from './cardAtlas';
import { RACK_HEIGHT, slotBox } from './coords';

const SIZE = 1.0;

export function ShelfCards() {
  const products = useStore(s => s.data!.products);
  const productAt = useStore(s => s.productAt);
  const selected = useStore(s => s.selected);
  const hovered = useStore(s => s.hover?.slot ?? null);

  // One texture per product sharing the atlas image. Copies are uploaded separately, so all of them are
  // flagged whenever a photo arrives and the atlas is redrawn.
  const cards = useMemo(() => {
    const copies: Texture[] = [];
    const atlas = buildCardAtlas(products, () => copies.forEach(t => { t.needsUpdate = true; }));
    products.forEach(p => {
      const t = atlas.clone();
      const { offset, repeat } = cellUv(p.id);
      t.offset.set(...offset); t.repeat.set(...repeat);
      t.needsUpdate = true;
      copies.push(t);
    });
    return { atlas, copies };
  }, [products]);
  useEffect(() => () => { cards.atlas.dispose(); cards.copies.forEach(t => t.dispose()); }, [cards]);

  const { clickSlot, hoverSlot } = useStore.getState();
  return (
    <group>
      {productAt.map((p, slot) => {
        const [x, , z] = slotBox(slot);
        const up = slot === selected || slot === hovered ? 0.2 : 0;
        const scale = slot === selected ? 1.15 : slot === hovered ? 1.07 : 1;
        return (
          <Billboard key={slot} position={[x, RACK_HEIGHT + 0.1 + SIZE / 2 + up, z]} lockZ>
            <mesh scale={scale}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 4) return; clickSlot(slot); }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation(); document.body.style.cursor = 'pointer';
                hoverSlot(slot, e.nativeEvent.clientX, e.nativeEvent.clientY);
              }}
              onPointerOut={() => { document.body.style.cursor = ''; hoverSlot(null); }}>
              <planeGeometry args={[SIZE, SIZE]} />
              <meshBasicMaterial map={cards.copies[p]} toneMapped={false} />
            </mesh>
          </Billboard>
        );
      })}
    </group>
  );
}
