// ui/RushClock.tsx — the shift clock and live counters while a rush plays, and the end-of-shift result
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_RUSH, fmtClock, rushStars } from '../engine/rush';
import { RUSH_SPEEDS, rushOptions, useStore } from '../store';
import { Stars } from './RushPanel';

export function RushClock() {
  const r = useStore(useShallow(s => ({
    active: s.rush.active, clock: s.rush.clock, end: s.rush.end, stats: s.rush.stats, settings: s.rush.settings,
    playing: s.rush.playing, speed: s.rush.speed, finished: s.rush.finished, result: s.rush.result,
    setRush: s.setRush, stopRush: s.stopRush, startRush: s.startRush, openPanel: s.openPanel,
  })));
  if (!r.active || !r.result) return null;
  const opts = rushOptions(r.settings);
  const start = DEFAULT_RUSH.shiftStart, span = r.end - start;
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / span) * 100))}%`;
  const st = r.stats;
  const share = r.result.onTime / r.result.due;

  return (
    <>
      <div className="card rushclock">
        <div className="clock-row">
          <b className="clock">{fmtClock(r.clock)}</b>
          <div className="clock-meta">
            <span>Peak-day rush · {r.settings.pickers} picker{r.settings.pickers > 1 ? 's' : ''}
              {r.settings.cart > 1 ? ` · carts of ${r.settings.cart}` : ''}</span>
            <span className="muted">courier cut-off {fmtClock(opts.cutoff)}</span>
          </div>
          <button className="icon" onClick={() => r.setRush({ playing: !r.playing })} aria-label={r.playing ? 'Pause' : 'Play'}>
            {r.playing ? '❚❚' : '▶'}</button>
          <div className="seg small">
            {RUSH_SPEEDS.map(v => <button key={v} className={r.speed === v ? 'on' : ''} onClick={() => r.setRush({ speed: v })}>{v}×</button>)}
          </div>
          <button onClick={r.stopRush}>Exit rush</button>
        </div>
        <div className="timeline">
          <i className="fill" style={{ width: pos(r.clock) }} />
          <i className="cut" style={{ left: pos(opts.cutoff) }} title="Cut-off" />
        </div>
        {st && (
          <div className="rush-stats">
            <div><span className="label">Arrived</span><b>{st.arrived}</b></div>
            <div><span className="label">Waiting</span><b className={st.waiting > 10 ? 'bad' : ''}>{st.waiting}</b></div>
            <div><span className="label">Shipped</span><b>{st.shipped}</b></div>
            <div><span className="label">On time</span><b className="good">{st.onTime}</b></div>
            <div><span className="label">Missed cut-off</span><b className={st.late ? 'bad' : ''}>{st.late}</b></div>
            <div><span className="label">For tomorrow</span><b className="muted">{st.tomorrow}</b></div>
          </div>
        )}
      </div>

      {r.finished && (
        <div className="result">
          <div className="stars big"><Stars n={rushStars(share)} /></div>
          <h2>{Math.round(share * 100)}% shipped on time</h2>
          <p className="muted">
            {r.result.onTime} of {r.result.due} orders made the {fmtClock(opts.cutoff)} courier; last order packed
            at {fmtClock(r.result.lastDone)}. Average wait before picking: {Math.round(r.result.avgWait / 60)} min.
          </p>
          <p className="small">Try carts, AI Suggest or a better layout to ship more with the same pickers.</p>
          <div className="row">
            <button className="primary" onClick={() => { r.stopRush(); r.openPanel('rush'); }}>Change the setup</button>
            <button onClick={r.startRush}>Replay</button>
            <button onClick={r.stopRush}>Exit</button>
          </div>
        </div>
      )}
    </>
  );
}
