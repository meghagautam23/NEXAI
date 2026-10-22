import { CATEGORY } from '../categories';
import type { Category } from '../engine/types';

/** Category pictogram as inline SVG (same path data as the 3D shelf labels) */
export function CategoryIcon({ category, size = 16, colour }: { category: Category; size?: number; colour?: string }) {
  return (
    <svg className="cat-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke={colour ?? CATEGORY[category].colour} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={CATEGORY[category].glyph} />
    </svg>
  );
}
