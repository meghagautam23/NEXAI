// ui/PlayCard.tsx — the player's round: swaps left, planning score and actions (top left)
import { useShallow } from 'zustand/react/shallow';
import { CHALLENGE_SWAPS, useStore } from '../store';
import { fmtPct } from './format';

export function PlayCard() {
  const s = useStore(useShallow(s => ({
    mode: s.mode, history: s.history, submitted: s.submitted, yours: s.yours, ref: s.ref, abcZones: s.abcZones,
    undo: s.undo, reset: s.reset, submit: s.submit, loadBaseline: s.loadBaseline, setAbcZones: s.setAbcZones,
  })));
  const used = s.history.length;
  const challenge = s.mode === 'challenge';
  // Planning score: the player's layout vs Baseline on the train weeks, updated live
  const planning = s.yours && s.ref ? s.yours.train.totalDist / s.ref.train.baseline.totalDist - 1 : 0;

  return (
    <section className="card play">
      <div className="card-head">
        <b>{challenge ? 'Beat the Baseline' : 'Free play'}</b>
        <span className="muted">{challenge ? `in ${CHALLENGE_SWAPS} swaps` : 'from the Original layout'}</span>
      </div>

      <div className="stats">
        <div>
          <span className="label">{challenge ? 'Swaps left' : 'Swaps'}</span>
          <b>{challenge ? CHALLENGE_SWAPS - used : used}</b>
        </div>
        <div>
          <span className="label">vs Baseline, past 3 wks</span>
          <b className={planning < 0 ? 'good' : planning > 0 ? 'bad' : ''}>{fmtPct(planning)}</b>
        </div>
      </div>

      <div className="actions">
        <button onClick={s.undo} disabled={!used || s.submitted} title="Ctrl/⌘+Z">Undo</button>
        <button onClick={s.reset}>Reset</button>
        {!challenge && <button onClick={s.loadBaseline}>Load Baseline</button>}
        {challenge && (s.submitted
          ? <button className="primary" onClick={s.reset}>Play again</button>
          : <button className="primary" onClick={s.submit} disabled={!used}>Submit</button>)}
      </div>

      {challenge && (
        <label className="check">
          <input type="checkbox" checked={s.abcZones} onChange={e => s.setAbcZones(e.target.checked)} />
          Keep ABC zones
        </label>
      )}

      <details className="help">
        <summary>How to play</summary>
        <ul>
          <li>Symbols show each product's family (👜 bags, 🎄 Christmas, ♨️ hot water bottles…); hover for its name.</li>
          <li>Click a rack, then another, to swap their products. <b>Esc</b> cancels.</li>
          <li>Purple arcs link products often bought together; hover a target to preview the saving.</li>
          <li>You plan on 1–21 Nov. {challenge
            ? 'Your score is the next week (22–30 Nov), hidden until you submit.'
            : 'Every score is shown live.'}</li>
          <li>Bulk items (FL6–7, bought by the case) must stay in the front 3 bays, next to the cross aisle.</li>
        </ul>
      </details>
    </section>
  );
}
