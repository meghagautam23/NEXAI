// ui/Hud.tsx — replay controls and live counters over the 3D scene
import { SPEEDS, useStore, type LayoutName } from '../store';

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};
const fmtM = (m: number, d = 0) => `${m.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })} m`;

const LAYOUTS: [LayoutName, string][] = [['original', 'Original'], ['baseline', 'Baseline']];

export function Hud() {
  const { layout, setLayout, playing, setPlaying, speed, setSpeed, restart, hud, sample, testScore, data } = useStore();
  const n = data?.orders.test.length ?? 0;
  return (
    <div className="hud">
      <h1>Warehouse Digital Twin</h1>

      <div className="row">
        <span className="caption">Layout</span>
        <div className="seg">
          {LAYOUTS.map(([k, label]) => (
            <button key={k} className={layout === k ? 'on' : ''} onClick={() => setLayout(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="row">
        <button className="icon" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing && !hud.done ? '❚❚' : '▶'}
        </button>
        <button className="icon" onClick={restart} aria-label="Restart">↺</button>
        <div className="seg">
          {SPEEDS.map(v => (
            <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{v}×</button>
          ))}
        </div>
      </div>

      <section>
        <div className="caption">Replay: {sample.length} sample orders from the test week</div>
        <div className="big">Order {hud.index + 1} of {sample.length}{hud.done ? ' · finished' : ''}</div>
        <div className="muted">Invoice {hud.orderId} · {hud.lines} lines</div>
        <div className="counters">
          <div><span className="caption">Distance</span><b>{fmtM(hud.dist, 1)}</b></div>
          <div><span className="caption">Time</span><b>{fmtTime(hud.time)}</b></div>
        </div>
      </section>

      {testScore && (
        <section>
          <div className="caption">Score: all {n} test-week orders</div>
          <div className="counters">
            <div><span className="caption">Total</span><b>{fmtM(testScore.totalDist)}</b></div>
            <div><span className="caption">Mean / order</span><b>{fmtM(testScore.meanDist, 1)}</b></div>
            <div><span className="caption">Avg time</span><b>{fmtTime(testScore.avgTime)}</b></div>
          </div>
        </section>
      )}

      <div className="legend">
        <span><i style={{ background: 'linear-gradient(90deg,#c9d3df,#1f5fa8)' }} />picked less → more</span>
        <span><i style={{ background: '#f28c28' }} />to pick</span>
        <span><i style={{ background: '#3fa34d' }} />picked</span>
      </div>
    </div>
  );
}
