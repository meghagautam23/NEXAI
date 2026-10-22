// scene/cardAtlas.ts — one canvas atlas with a card per product: photo, velocity-class and FL chips, and the
// family symbol with a short name. Cells are per product, so a swap only changes which cell a shelf shows.
// (Card design from Jayesh Pani's version.)
import { CanvasTexture, SRGBColorSpace } from 'three';
import { categoryOf } from '../engine/categories';
import type { Product } from '../engine/data';
import { VELOCITY } from '../ui/palette';
import { productImage, shortName } from '../ui/productImages';

export const GRID = 10, CELL = 256;
const PHOTO_H = 184;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// onRedraw runs after every redraw (each photo arriving), so per-card copies of the texture can be re-uploaded
export function buildCardAtlas(products: Product[], onRedraw: () => void = () => {}) {
  const c = document.createElement('canvas');
  c.width = c.height = GRID * CELL;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  const photos = new Map<string, HTMLImageElement>();
  const redraw = () => { draw(c, products, photos); tex.needsUpdate = true; onRedraw(); };
  for (const p of products) {
    const src = productImage(p);
    if (photos.has(src)) continue;
    const img = new Image();
    img.onload = redraw;
    img.src = src;
    photos.set(src, img);
  }
  redraw();
  return tex;
}

function draw(c: HTMLCanvasElement, products: Product[], photos: Map<string, HTMLImageElement>) {
  const ctx = c.getContext('2d')!;
  ctx.textBaseline = 'middle';
  for (const p of products) {
    const x = (p.id % GRID) * CELL, y = Math.floor(p.id / GRID) * CELL;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, CELL, CELL);
    const img = photos.get(productImage(p));
    if (img?.complete && img.naturalWidth) {   // cover-crop the photo
      const s = Math.max(CELL / img.naturalWidth, PHOTO_H / img.naturalHeight);
      const w = CELL / s, h = PHOTO_H / s;
      ctx.drawImage(img, (img.naturalWidth - w) / 2, (img.naturalHeight - h) / 2, w, h, x, y, CELL, PHOTO_H);
    } else {
      ctx.fillStyle = '#e7eaee'; ctx.fillRect(x, y, CELL, PHOTO_H);
    }
    chip(ctx, p.abcVelocity, x + 10, y + 10, 36, VELOCITY[p.abcVelocity], p.abcVelocity === 'A' ? '#fff' : '#172033');
    chip(ctx, `FL${p.fl}`, x + CELL - 66, y + 10, 56, p.fl >= 6 ? '#6f4a28' : '#172033', '#fff');
    ctx.fillStyle = '#172033'; ctx.textAlign = 'left';
    ctx.font = `34px ${FONT}`;
    ctx.fillText(categoryOf(p).symbol, x + 10, y + PHOTO_H + (CELL - PHOTO_H) / 2 + 2);
    fitText(ctx, shortName(p), x + 56, y + PHOTO_H + (CELL - PHOTO_H) / 2, CELL - 66);
    ctx.strokeStyle = '#172033'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
  }
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, bg: string, fg: string) {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, 34);
  ctx.fillStyle = fg; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(text, x + w / 2, y + 18);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  let size = 34;
  ctx.font = `600 ${size}px ${FONT}`;
  while (size > 16 && ctx.measureText(text).width > max) { size -= 1; ctx.font = `600 ${size}px ${FONT}`; }
  ctx.fillText(text, x, y);
}

// UV offset/repeat for a product's cell (canvas y runs down, texture v runs up)
export const cellUv = (id: number) => ({
  offset: [(id % GRID) / GRID, 1 - (Math.floor(id / GRID) + 1) / GRID] as [number, number],
  repeat: [1 / GRID, 1 / GRID] as [number, number],
});
