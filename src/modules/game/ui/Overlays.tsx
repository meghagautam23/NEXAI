// Tooltip with swap preview, swap pop-up, toast and the Challenge result screen
import { useState } from 'react';
import { samePickPoint } from '../../../core/engine/layouts';
import { ShelfTooltip } from '../../twin/TwinModule';
import { qualifies } from '../leaderboard';
import { duration, pointsFor, starsFor, swapVerdict } from '../scoring';
import { MAX_SWAPS, useGame, useSaved } from '../gameStore';
import { Stars } from './Stars';

export function SwapTooltip({ x, y }: { x: number; y: number }) {
  const { hovered, selected, preview, blocked, at, mode, history, submitted } = useGame();
  if (hovered === null || submitted) return null;
  const twin = selected !== null && hovered !== selected && samePickPoint(selected, hovered);
  const outOfSwaps = mode === 'challenge' && history.length >= MAX_SWAPS;
  const pts = preview === null ? null : pointsFor(-preview);
  return (
    <ShelfTooltip slot={hovered} product={at[hovered]} x={x} y={y}>
      {twin && <div className="tt-hint">Same pick point, no change</div>}
      {blocked && <div className="tt-points bad">{blocked}</div>}
      {pts !== null && !outOfSwaps && (
        <div className={`tt-points ${pts > 0 ? 'good' : pts < 0 ? 'bad' : ''}`}>
          Swap: {pts > 0 ? 'saves' : pts < 0 ? 'costs' : 'changes'} {Math.abs(pts).toLocaleString()} s on 1–21 Nov
        </div>
      )}
      {selected === null && <div className="tt-hint">Click to select</div>}
      {selected === hovered && <div className="tt-hint">Click again to deselect</div>}
    </ShelfTooltip>
  );
}

export function SwapFeedback() {
  const feedback = useGame(s => s.feedback);
  if (!feedback) return null;
  const v = swapVerdict(feedback.delta);
  const s = pointsFor(-feedback.delta);
  return (
    <div className={`pop ${v.tone}`} key={feedback.id} role="status">
      <b>{s > 0 ? '+' : ''}{s.toLocaleString()} s</b> {v.text}
    </div>
  );
}

export function Toast() {
  const toast = useGame(s => s.toast);
  return toast ? <div className="toast" key={toast.id} role="status">{toast.text}</div> : null;
}

export function EndScreen() {
  const { submitted, mode, reset, openMenu, setPanel, history, saveScore, savedScore, ai, ref, yours } = useGame();
  const { score } = useSaved();
  const [name, setName] = useState('');
  if (!submitted || mode !== 'challenge' || !ref || !yours) return null;
  const points = pointsFor(score);
  const stars = starsFor(score);
  const aiSaved = ai.result ? ref.test.baseline.totalTime - ai.result.test.totalTime : null;
  const title = ['No improvement', 'Bronze rating', 'Silver rating', 'Gold rating'][stars];
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-labelledby="end-title">
        <Stars n={stars} animate />
        <h2 id="end-title">{title}</h2>
        <p className="end-points"><b>{points.toLocaleString()}</b> pts</p>
        <p className="end-copy">
          {score > 0
            ? `${history.length} swaps save ${duration(score)} of picking on 22–30 Nov, a week your layout was never tuned on.`
            : 'Slower than the baseline on the unseen week. Try pairing products ordered together near the dock, and forklift items at aisle ends.'}
          {aiSaved !== null && ` AI Suggest saves ${duration(aiSaved)} with ${ai.result!.moves.length} moves.`}
        </p>
        {stars < 3 && <p className="next-star">{['Bronze', 'Silver', 'Gold'][stars]} at {[1, 1500, 4000][stars].toLocaleString()} points</p>}
        {qualifies(points) && !savedScore && (
          <form className="save" onSubmit={e => { e.preventDefault(); saveScore(name); }}>
            <label htmlFor="nick">Save to the leaderboard</label>
            <div>
              <input id="nick" maxLength={14} value={name} onChange={e => setName(e.target.value)} placeholder="Name" autoComplete="off" />
              <button className="primary" type="submit">Save</button>
            </div>
          </form>
        )}
        {savedScore && <p className="saved-msg">Saved. <button className="link" onClick={() => { openMenu(); setPanel('scores'); }}>View leaderboard</button></p>}
        <div className="modal-actions">
          <button className="primary" onClick={() => { setName(''); reset(); }}>Play again</button>
          <button onClick={openMenu}>Challenge menu</button>
        </div>
      </div>
    </div>
  );
}
