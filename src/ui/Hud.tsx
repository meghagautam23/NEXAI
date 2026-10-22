// ui/Hud.tsx — mode, swaps and replay controls (top left)
import { CHALLENGE_SWAPS, SPEEDS, useStore, type Mode, type RackColor } from '../store';
import { fmtM, fmtPct, fmtTime } from './format';
import { COST, HEAVY_FLOOR, VELOCITY, WEIGHT } from './palette';

const MODES: [Mode, string][] = [['challenge', 'Challenge'], ['sandbox', 'Sandbox']];
const COLORS: [RackColor, string][] = [
  ['popularity', 'Popularity (picks)'], ['visits', 'Visit heatmap (this replay)'],
  ['velocity', 'ABC by frequency (zones)'], ['cost', 'ABC by cost (display only)'], ['weight', 'Weight class FL01–FL07 (est.)'],
];

export function Hud() {
  const s = useStore();
  const { mode, history, submitted, yours, ref, hud, sample } = s;
  const used = history.length;
  // Planning score: the player's layout vs Baseline on the train weeks, updated live
  const planning = yours && ref ? yours.train.totalDist / ref.train.baseline.totalDist - 1 : 0;

  return (
    <div className="hud">
      <h1>Warehouse Digital Twin</h1>

      <div className="seg wide">
        {MODES.map(([k, label]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => s.setMode(k)}>{label}</button>
        ))}
      </div>

      {mode === 'challenge' ? (<>
        <p className="muted small">
          Start from the Baseline and beat it with {CHALLENGE_SWAPS} swaps. Plan on the last three weeks;
          you are scored on the next week, which stays hidden until you submit.
        </p>
        <label className="check small">
          <input type="checkbox" checked={s.abcZones} onChange={e => s.setAbcZones(e.target.checked)} />
          Keep ABC zones (class A items stay in zone A, and so on)
        </label>
      </>) : (
        <p className="muted small">Start from the Original layout. Unlimited swaps, every score shown live.</p>
      )}

      <section>
        <div className="row spread">
          <div>
            <span className="caption">Swaps</span>
            <b className="num">{mode === 'challenge' ? `${CHALLENGE_SWAPS - used} left` : used}</b>
          </div>
          <div>
            <span className="caption">Past 3 weeks vs Baseline</span>
            <b className={`num ${planning < 0 ? 'good' : planning > 0 ? 'bad' : ''}`}>{fmtPct(planning)}</b>
          </div>
        </div>
        <div className="row">
          <button onClick={s.undo} disabled={!used || submitted}>Undo</button>
          <button onClick={s.reset}>Reset</button>
          {mode === 'sandbox' && <button onClick={s.loadBaseline}>Load Baseline</button>}
          {mode === 'challenge' && (submitted
            ? <button className="primary" onClick={s.reset}>Play again</button>
            : <button className="primary" onClick={s.submit} disabled={!used}>Submit</button>)}
        </div>
        <p className="hint">Click a rack, then another to swap their products. Purple arcs link products often bought together.
          Heavy items (FL05+, est.) must stay in the front 3 bays.</p>
      </section>

      <section>
        <div className="row">
          <button className="icon" onClick={() => s.setPlaying(!s.playing)} aria-label={s.playing ? 'Pause' : 'Play'}>
            {s.playing && !hud.done ? '❚❚' : '▶'}
          </button>
          <button className="icon" onClick={s.restart} aria-label="Restart replay">↺</button>
          <div className="seg">
            {SPEEDS.map(v => (
              <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => s.setSpeed(v)}>{v}×</button>
            ))}
          </div>
        </div>
        <div className="caption">Replay: {sample.length} sample orders from the test week</div>
        <div className="row spread">
          <div><span className="caption">Order</span><b className="num">{hud.index + 1}/{sample.length}</b></div>
          <div><span className="caption">Lines</span><b className="num">{hud.lines}</b></div>
          <div><span className="caption">Distance</span><b className="num">{fmtM(hud.dist, 1)}</b></div>
          <div><span className="caption">Time</span><b className="num">{fmtTime(hud.time)}</b></div>
        </div>
      </section>

      <section>
        <div className="row">
          <span className="caption">Racks</span>
          <select value={s.rackColor} onChange={e => s.setRackColor(e.target.value as RackColor)} aria-label="Rack colours">
            {COLORS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="legend">
          {s.rackColor === 'popularity' && <>
            <span><i style={{ background: 'linear-gradient(90deg,#c9d3df,#1f5fa8)' }} />picked less → more</span>
            <span><i style={{ background: '#f28c28' }} />to pick</span>
            <span><i style={{ background: '#3fa34d' }} />picked</span>
          </>}
          {s.rackColor === 'visits' && <>
            <span><i style={{ background: '#d7dbe0' }} />not visited</span>
            <span><i style={{ background: 'linear-gradient(90deg,#ffd166,#c8102e)' }} />visits in this replay: few → most</span>
          </>}
          {s.rackColor === 'velocity' && <>
            {(['A', 'B', 'C'] as const).map(k => <span key={k}><i style={{ background: VELOCITY[k] }} />class {k}</span>)}
            <span>floor = zone A / B / C</span>
          </>}
          {s.rackColor === 'cost' && (['A', 'B', 'C'] as const).map(k =>
            <span key={k}><i style={{ background: COST[k] }} />cost {k}</span>)}
          {s.rackColor === 'weight' && <>
            <span><i style={{ background: `linear-gradient(90deg,${WEIGHT.join(',')})` }} />FL01 → FL07</span>
            <span><i style={{ background: HEAVY_FLOOR }} />floor = heavy zone (FL05+)</span>
            <span>weights estimated from descriptions</span>
          </>}
          <span><i style={{ background: '#8b3fd9' }} />selected</span>
        </div>
      </section>

      <div className="row">
        <button className="primary grow" onClick={() => s.setAi({ open: !s.ai.open })}>AI Suggest</button>
        <button className="grow" onClick={() => s.setBoardOpen(!s.boardOpen)}>Leaderboard ({s.board.length})</button>
      </div>
    </div>
  );
}
