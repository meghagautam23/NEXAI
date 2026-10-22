// ui/Overlays.tsx — rack tooltip with swap preview, toast, and the Challenge result card
import { useState } from 'react';
import { samePickPoint } from '../engine/layouts';
import { isHeavy, zoneOf } from '../engine/rules';
import { useStore } from '../store';
import { fmtDelta, fmtM, fmtPct } from './format';

export function Tooltip() {
  const { hover, data, productAt, selected, preview, blocked } = useStore();
  if (!hover || !data || !productAt.length) return null;
  const p = data.products[productAt[hover.slot]];
  const target = selected !== null && hover.slot !== selected;
  return (
    <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
      <b>{p.name}</b>
      <div className="muted">{p.picksTrain} picks in 3 weeks · rank {p.id + 1} · slot {hover.slot} (zone {zoneOf[hover.slot]})</div>
      <div className="muted">
        Frequency {p.abcVelocity} · Cost {p.abcCost} · {p.weightClass} ≈{p.weightKg} kg (est.){isHeavy(p) ? ' · heavy' : ''}
      </div>
      {target && blocked?.slot === hover.slot && <div className="bad">Not allowed: {blocked.reason}</div>}
      {target && samePickPoint(selected, hover.slot) && <div className="muted">Same pick point: no change</div>}
      {target && preview?.slot === hover.slot && (
        <div className={preview.delta < 0 ? 'good' : preview.delta > 0 ? 'bad' : 'muted'}>
          Swap: {fmtDelta(preview.delta)} over the past 3 weeks
        </div>
      )}
      {selected === null && <div className="muted">Click to select</div>}
    </div>
  );
}

export function Toast() {
  const toast = useStore(s => s.toast);
  return toast ? <div className="toast" key={toast.id}>{toast.text}</div> : null;
}

export function ResultCard() {
  const { mode, submitted } = useStore();
  // Result unmounts when the round resets, so a closed card comes back for the next submission
  return mode === 'challenge' && submitted ? <Result /> : null;
}

function Result() {
  const { yours, ref, history, reset, saveResult, savedRound } = useStore();
  const [closed, setClosed] = useState(false);
  const [name, setName] = useState('');
  if (closed || !yours || !ref) return null;
  const vsBase = yours.test.totalDist / ref.test.baseline.totalDist - 1;
  const vsOrig = yours.test.totalDist / ref.test.original.totalDist - 1;
  const won = vsBase < 0;
  return (
    <div className="result">
      <h2>{won ? 'You beat the Baseline' : 'The Baseline wins this time'}</h2>
      <p className="muted">Scored on the unseen test week, {history.length} swap{history.length === 1 ? '' : 's'} used</p>
      <div className="row spread">
        <div><span className="caption">Your walking</span><b className="num">{fmtM(yours.test.totalDist)}</b></div>
        <div><span className="caption">vs Baseline</span><b className={`num ${won ? 'good' : 'bad'}`}>{fmtPct(vsBase)}</b></div>
        <div><span className="caption">vs Original</span><b className={`num ${vsOrig < 0 ? 'good' : 'bad'}`}>{fmtPct(vsOrig)}</b></div>
      </div>
      <form className="row" onSubmit={e => { e.preventDefault(); saveResult(name); }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
               maxLength={24} disabled={savedRound} aria-label="Name for the leaderboard" />
        <button type="submit" disabled={savedRound}>{savedRound ? 'Saved' : 'Save to leaderboard'}</button>
      </form>
      <div className="row">
        <button className="primary" onClick={reset}>Play again</button>
        <button onClick={() => setClosed(true)}>View layout</button>
      </div>
    </div>
  );
}
