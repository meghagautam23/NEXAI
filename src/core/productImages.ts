// Product photo for each item: keyword rules on the name -> one openly licensed photo per product type
// (public/products/<type>.jpg, credits in public/products/credits.json). First match wins.
import type { Product } from './engine/types';

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
  ['colour-pencils', /PENCIL/],
];

export function productType(p: Product): string {
  const name = p.name.toUpperCase();
  return PRODUCT_TYPES.find(([, rx]) => rx.test(name))?.[0] ?? 'wrapping-paper';
}

export const productImage = (p: Product) => `${import.meta.env.BASE_URL}products/${productType(p)}.jpg`;
