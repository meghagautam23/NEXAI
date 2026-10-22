// Colour-by switch and its legend (used by the twin and the game)
import { ABC_COLOUR, CATEGORY, flColour } from '../../../core/categories';
import { CategoryIcon } from '../../../core/ui/CategoryIcon';
import type { Category } from '../../../core/engine/types';
import { COLOUR_BY, useReplay, type ColourBy as Mode } from '../replayStore';

const LABEL: Record<Mode, string> = { category: 'Category', class: 'Class', fl: 'FL', picks: 'Picks', busy: 'Busy' };

export function ColourBySwitch() {
  const { colourBy, setColourBy } = useReplay();
  return (
    <div className="seg colour-by" role="group" aria-label="Colour shelves by">
      {COLOUR_BY.map(c => (
        <button key={c} className={colourBy === c ? 'on' : ''} aria-pressed={colourBy === c} onClick={() => setColourBy(c)}>{LABEL[c]}</button>
      ))}
    </div>
  );
}

export function ColourLegend({ extra }: { extra?: React.ReactNode }) {
  const colourBy = useReplay(s => s.colourBy);
  let body: React.ReactNode;
  if (colourBy === 'category') body = (Object.keys(CATEGORY) as Category[]).filter(c => c !== 'Gifts & gadgets')
    .map(c => <span key={c}><CategoryIcon category={c} size={14} /> {c}</span>);
  else if (colourBy === 'class') body = (['A', 'B', 'C'] as const).map(k => <span key={k}><i className="sw dot" style={{ background: ABC_COLOUR[k] }} />Class {k}</span>);
  else if (colourBy === 'fl') body = <span><i className="sw" style={{ background: `linear-gradient(90deg, ${flColour(0)}, ${flColour(7)})` }} /> FL0 by hand → FL7 forklift</span>;
  else if (colourBy === 'picks') body = <span><i className="sw picks" /> rarely picked → picked a lot</span>;
  else body = <span><i className="sw heat" /> picker visits during the replay</span>;
  return <div className="legend">{body}{extra}</div>;
}
