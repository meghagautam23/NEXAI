// ui/productImages.ts — a photo for each product: keyword rules on the name -> one openly licensed photo
// per product type (public/products/<type>.jpg; titles, authors and licences in public/products/credits.json).
// Photos show the type of item, not the exact product. First match wins. (From Jayesh Pani's version.)
import type { Product } from '../engine/data';

export const PRODUCT_TYPES: [string, RegExp][] = [
  ['hot-water-bottle', /HOT WATER BOTTLE/],
  ['hand-warmer', /HAND WARMER/],
  ['night-light', /NIGHT LIGHT/],
  ['fairy-lights', /MINI LIGHTS/],
  ['tlight-holder', /T-LIGHT/],
  ['lunch-bag', /LUNCH BAG/],
  ['jumbo-bag', /BAG|SHOPPER/],
  ['paper-chain', /PAPER CHAIN/],
  ['baking-cases', /CAKE CASES|BAKING CASES/],
  ['baking-set', /BAKING SET/],
  ['cake-stand', /CAKESTAND/],
  ['cake-tins', /CAKE TINS/],
  ['jelly-mould', /JELLY/],
  ['recipe-box', /RECIPE/],
  ['tea-set', /TEA SET/],
  ['popcorn-holder', /POPCORN/],
  ['crackers', /CRACKER/],
  ['wrapping-paper', /WRAP/],
  ['napkins', /NAPKIN/],
  ['ribbons', /RIBBON/],
  ['bunting', /BUNTING/],
  ['sleigh-bells', /SLEIGH BELLS|JINGLE BELL/],
  ['stocking', /STOCKING/],
  ['felt-craft', /CHRISTMAS CRAFT|CAKE DECORATIONS/],
  ['wicker-heart', /WICKER/],
  ['hanging-heart', /HANGING HEART|HEART DECORATION/],
  ['wooden-decoration', /WOODEN (STAR|HEART|TREE)|WOODEN .*DECORATION/],
  ['bird-ornament', /BIRD ORNAMENT|HANGING OWLS/],
  ['kneeling-pad', /KNEELING PAD/],
  ['alarm-clock', /ALARM CLOCK/],
  ['doormat', /DOORMAT/],
  ['chalkboard', /CHALKBOARD/],
  ['photo-frame', /FRAME/],
  ['sewing-kit', /SEWING/],
  ['naughts-crosses', /NAUGHTS/],
  ['pick-up-sticks', /PICK UP STICKS/],
  ['dominoes', /DOMINOES/],
  ['playing-cards', /CARDS|CARD GAME/],
  ['harmonica', /HARMONICA/],
  ['knitting-nancy', /KNITTING/],
  ['colour-pencils', /PENCILS/],
];

export const productType = (p: Pick<Product, 'name'>) =>
  PRODUCT_TYPES.find(([, rx]) => rx.test(p.name.toUpperCase()))?.[0] ?? 'wrapping-paper';

export const productImage = (p: Pick<Product, 'name'>) => `${import.meta.env.BASE_URL}products/${productType(p)}.jpg`;

// Two meaningful words for a card ("Set Of 3 Cake Tins Pantry Design" -> "Cake Tins")
export function shortName(p: Pick<Product, 'name'>) {
  const words = p.name.replace(/[^A-Za-z' ]/g, ' ').split(/\s+/)
    .filter(w => w && !/^(set|of|pack|box|the|and|a|in|\d+)$/i.test(w));
  return words.slice(0, 2).join(' ');
}

export type Credit = { title: string; author: string; license: string; source: string };
