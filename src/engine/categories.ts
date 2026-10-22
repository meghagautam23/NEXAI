// engine/categories.ts — product families from the description, each with its own symbol on the shelf.
// The dataset has no categories: the first matching keyword wins (order matters), "Other" otherwise.
import type { Product } from './data';

export type Category = { key: string; label: string; symbol: string; keywords: string[] };

export const CATEGORIES: Category[] = [
  { key: 'bottle', label: 'Hot water bottle', symbol: '♨️', keywords: ['HOT WATER BOTTLE'] },
  { key: 'warmer', label: 'Hand warmer', symbol: '🧤', keywords: ['HAND WARMER'] },
  { key: 'tea', label: 'Tea set', symbol: '☕', keywords: ['TEA SET'] },
  { key: 'cake', label: 'Cake stand', symbol: '🎂', keywords: ['CAKESTAND'] },
  { key: 'baking', label: 'Baking', symbol: '🧁', keywords: ['CAKE CASES', 'BAKING', 'CAKE TINS', 'JELLY MOULDS', 'CAKE DECORATIONS', 'POPCORN', 'RECIPE'] },
  { key: 'bag', label: 'Bag', symbol: '👜', keywords: ['BAG', 'SHOPPER'] },
  { key: 'light', label: 'Light', symbol: '💡', keywords: ['NIGHT LIGHT', 'MINI LIGHTS'] },
  { key: 'candle', label: 'Candle holder', symbol: '🕯️', keywords: ['T-LIGHT'] },
  { key: 'clock', label: 'Clock', symbol: '⏰', keywords: ['CLOCK'] },
  { key: 'cracker', label: 'Cracker', symbol: '🎉', keywords: ['CRACKER'] },
  { key: 'game', label: 'Game', symbol: '🎲', keywords: ['NAUGHTS', 'PICK UP STICKS', 'DOMINOES', 'CARDS', 'CARD GAME', 'SNAP', 'HARMONICA', 'KNITTING'] },
  { key: 'wrap', label: 'Gift wrap', symbol: '🎁', keywords: ['ROLL WRAP', 'RIBBONS', 'PAPER CHAIN', 'BUNTING'] },
  { key: 'stationery', label: 'Stationery', symbol: '✏️', keywords: ['PENCIL', 'CHALKBOARD'] },
  { key: 'wicker', label: 'Wicker', symbol: '🧺', keywords: ['WICKER'] },
  { key: 'bird', label: 'Bird & owl ornament', symbol: '🐦', keywords: ['BIRD', 'OWL'] },
  { key: 'xmas', label: 'Christmas decoration', symbol: '🎄', keywords: ['CHRISTMAS', 'STAR', 'TREE', 'STOCKING', 'JINGLE', 'SLEIGH', 'HEART DECORATION', 'WOODEN HEART'] },
  { key: 'home', label: 'Home & garden', symbol: '🏡', keywords: ['DOORMAT', 'KNEELING PAD', 'FRAME', 'SEWING', 'NAPKINS', 'HANGING HEART'] },
];
export const OTHER: Category = { key: 'other', label: 'Other gift', symbol: '📦', keywords: [] };

export const categoryOf = (p: Pick<Product, 'name'>): Category => {
  const up = p.name.toUpperCase();
  return CATEGORIES.find(c => c.keywords.some(k => up.includes(k))) ?? OTHER;
};
