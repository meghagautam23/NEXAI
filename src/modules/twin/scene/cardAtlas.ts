// One canvas atlas with a product card per product: photo, name, category stripe, class and FL chips.
// Cells are per product, so a swap only changes which cell a shelf shows; nothing is redrawn.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { ABC_COLOUR, CATEGORY, shortName } from '../../../core/categories';
import type { Product } from '../../../core/engine/types';
import { productImage } from '../../../core/productImages';

export const GRID = 10, CELL = 256;
const FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
const PHOTO_H = 184;

// onRedraw runs after every redraw: copies of the texture are uploaded separately and must be flagged too
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
  return { tex, redraw };
}

function draw(c: HTMLCanvasElement, products: Product[], photos: Map<string, HTMLImageElement>) {
  const ctx = c.getContext('2d')!;
  ctx.textBaseline = 'middle';
  for (const p of products) {
    const x = (p.id % GRID) * CELL, y = Math.floor(p.id / GRID) * CELL;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, CELL, CELL);
    // photo, cover-cropped
    const img = photos.get(productImage(p));
    if (img?.complete && img.naturalWidth) {
      const s = Math.max(CELL / img.naturalWidth, PHOTO_H / img.naturalHeight);
      const w = CELL / s, h = PHOTO_H / s;
      ctx.drawImage(img, (img.naturalWidth - w) / 2, (img.naturalHeight - h) / 2, w, h, x, y, CELL, PHOTO_H);
    } else {
      ctx.fillStyle = '#e7eaee'; ctx.fillRect(x, y, CELL, PHOTO_H);
    }
    // class and FL chips over the photo
    chip(ctx, p.abc, x + 10, y + 10, 34, ABC_COLOUR[p.abc], p.abc === 'B' ? '#1d2433' : '#fff');
    chip(ctx, `FL${p.fl}`, x + CELL - 64, y + 10, 54, '#1d2433', '#fff');
    // name strip with category colour
    ctx.fillStyle = CATEGORY[p.category].colour; ctx.fillRect(x, y + PHOTO_H, 10, CELL - PHOTO_H);
    ctx.fillStyle = '#1d2433'; ctx.textAlign = 'left';
    fitText(ctx, shortName(p), x + 20, y + PHOTO_H + (CELL - PHOTO_H) / 2, CELL - 30);
    ctx.strokeStyle = '#1d2433'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
  }
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, bg: string, fg: string) {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, 34);
  ctx.fillStyle = fg; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(text, x + w / 2, y + 18);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  let size = 38;
  ctx.font = `600 ${size}px ${FONT}`;
  while (size > 18 && ctx.measureText(text).width > max) { size -= 1; ctx.font = `600 ${size}px ${FONT}`; }
  ctx.fillText(text, x, y);
}

/** UV offset/repeat for a product's cell (canvas y runs down, texture v runs up) */
export const cellUv = (id: number) => ({
  offset: [(id % GRID) / GRID, 1 - (Math.floor(id / GRID) + 1) / GRID] as [number, number],
  repeat: [1 / GRID, 1 / GRID] as [number, number],
});
