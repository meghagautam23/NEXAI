// Holly & Ivy Gifts: product categories, ABC and FL colours shared by every module
import type { Category, Product } from './engine/types';

export const BUSINESS = {
  name: 'Holly & Ivy Gifts',
  tagline: 'UK gift and Christmas-décor wholesaler · November 2011 rush',
};

// Line pictograms on a 24-unit grid (stroked, round caps), used on shelf labels and in the UI
export const CATEGORY: Record<Category, { glyph: string; colour: string }> = {
  'Christmas':        { colour: '#2f7d4f', glyph: 'M12 3 L6.5 10.5 H9.5 L5 17 H19 L14.5 10.5 H17.5 Z M12 17 V21' },
  'Lights & candles': { colour: '#b8871f', glyph: 'M9.5 17.5 H14.5 M10.5 20.5 H13.5 M12 3 A6 6 0 0 0 8.5 13.8 V17.5 H15.5 V13.8 A6 6 0 0 0 12 3 Z' },
  'Bags & storage':   { colour: '#a8436a', glyph: 'M5 8.5 H19 L18 20.5 H6 Z M9 8.5 V6.5 A3 3 0 0 1 15 6.5 V8.5' },
  'Kitchen & baking': { colour: '#c0652a', glyph: 'M5 8 H15.5 V17 A3 3 0 0 1 12.5 20 H8 A3 3 0 0 1 5 17 Z M15.5 10 H17.5 A2.3 2.3 0 0 1 17.5 15 H15.5 M8 3.5 V5.5 M11.5 3.5 V5.5' },
  'Party & paper':    { colour: '#6a4fb0', glyph: 'M3 5 H21 M4 5 L7 11.5 L10 5 M10 5 L13 11.5 L16 5 M16 5 L19 11.5 L21 6.5 M6 15 V20 M12 15 V20 M18 15 V20' },
  'Cosy & warm':      { colour: '#b33c2c', glyph: 'M12 3 C15 7 18 9.5 18 14 A6 6 0 0 1 6 14 C6 10.5 8.5 9 9.8 6.5 C10.8 9 11.5 10 13 10.5 C13.3 8.3 12.6 5.8 12 3 Z' },
  'Games & crafts':   { colour: '#2d68b0', glyph: 'M5 5 H19 V19 H5 Z M9 9 H9.01 M15 9 H15.01 M12 12 H12.01 M9 15 H9.01 M15 15 H15.01' },
  'Home & garden':    { colour: '#6a5848', glyph: 'M4 11 L12 4 L20 11 M6 9.5 V20 H18 V9.5 M10 20 V14 H14 V20' },
  'Gifts & gadgets':  { colour: '#27857f', glyph: 'M4 9 H20 V13 H4 Z M5 13 V20 H19 V13 M12 9 V20 M12 9 C10 5 7 6 8 8 C9 9 12 9 12 9 C12 9 15 9 16 8 C17 6 14 5 12 9' },
};

export const ABC_COLOUR = { A: '#d64933', B: '#f2b705', C: '#9aa3af' } as const;
export const ABC_LABEL = { A: 'Class A · top 20% by sales value', B: 'Class B · next 30%', C: 'Class C · last 50%' } as const;

/** FL0 (by hand) light → FL7 (forklift) dark */
export const flColour = (fl: number) => `hsl(215, 35%, ${86 - fl * 8.5}%)`;
export const FL_LABEL = (fl: number) => (fl === 0 ? 'by hand' : fl < 4 ? 'trolley' : fl < 7 ? 'forklift' : 'forklift, pallet');

/** Two words for a shelf label: skip filler like "Set Of 3" */
export function shortName(p: Product) {
  const words = p.name.replace(/[^A-Za-z' ]/g, ' ').split(/\s+/)
    .filter(w => w && !/^(set|of|pack|box|the|and|a|in|\d+)$/i.test(w));
  return words.slice(0, 2).join(' ');
}

// Same keyword rules as preprocess.py (first match wins); a test keeps the two in step
const CATEGORY_RULES: [Category, RegExp][] = [
  ['Cosy & warm', /HOT WATER BOTTLE|HAND WARMER/],
  ['Lights & candles', /T-LIGHT|NIGHT LIGHT|LIGHTS|CANDLE|LANTERN/],
  ['Bags & storage', /\bBAG\b|SHOPPER|STORAGE/],
  ['Kitchen & baking', /CAKE|BAKING|TEA SET|JELLY|RECIPE|POPCORN|PANTRY|MUG/],
  ['Party & paper', /PAPER CHAIN|WRAP|NAPKIN|BUNTING|RIBBON|CRACKER/],
  ['Christmas', /CHRISTMAS|SLEIGH|JINGLE|STOCKING|TREE|STAR|ANGEL/],
  ['Games & crafts', /GAME|CARDS|NAUGHTS|STICKS|KNITTING|DOMINOES|HARMONICA|PENCIL|SEWING|CRAFT/],
  ['Home & garden', /HEART|WICKER|FRAME|CLOCK|DOORMAT|CHALKBOARD|ORNAMENT|OWL|KNEELING|DECORATION/],
];
export const categoryFor = (name: string): Category =>
  CATEGORY_RULES.find(([, rx]) => rx.test(name.toUpperCase()))?.[0] ?? 'Gifts & gadgets';
