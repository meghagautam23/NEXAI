// ui/ReplayBar.tsx — replay controls and live counters (bottom left), with the colour legend above
import { useShallow } from 'zustand/react/shallow';
import { SPEEDS, useStore } from '../store';
import { fmtM, fmtTime } from './format';
import { BULK_FLOOR, COST, FL, VELOCITY } from './palette';

export function ReplayBar() {
  const s = useStore(useShallow(s => ({
    playing: s.playing, setPlaying: s.setPlaying, restart: s.restart, speed: s.speed, setSpeed: s.setSpeed,
    hud: s.hud, batches: s.replayBatches, cart: s.batch.size, focus: s.focus, setFocus: s.setFocus,
  })));
  const { hud } = s;
  return (
    <div className="bottom-left">
      <div className="legend-row">
        <div className="seg small camera" role="group" aria-label="Camera">
          <button className={s.focus === null ? 'on' : ''} onClick={() => s.setFocus(null)} aria-pressed={s.focus === null}>All aisles</button>
          {[0, 1, 2, 3, 4].map(a => (
            <button key={a} className={s.focus === a ? 'on' : ''} onClick={() => s.setFocus(a)} aria-pressed={s.focus === a}>{a + 1}</button>
          ))}
        </div>
        <Legend />
      </div>
      <div className="card replay">
        <button className="icon" onClick={() => s.setPlaying(!s.playing)} aria-label={s.playing ? 'Pause' : 'Play'}>
          {s.playing && !hud.done ? '❚❚' : '▶'}
        </button>
        <button className="icon" onClick={s.restart} aria-label="Restart replay" title="Restart replay">↺</button>
        <div className="seg small" role="group" aria-label="Replay speed">
          {SPEEDS.map(v => (
            <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => s.setSpeed(v)}>{v}×</button>
          ))}
        </div>
        <div className="readout">
          <span className="label">{s.batches ? `Sample cart (≤${s.cart} orders)` : 'Sample order'}</span>
          <b>{hud.index + 1}<span className="muted">/{hud.count}</span></b>
        </div>
        <div className="readout">
          <span className="label">{s.batches ? `${hud.orders} orders · lines` : 'Lines'}</span><b>{hud.lines}</b>
        </div>
        <div className="readout"><span className="label">Walked</span><b>{fmtM(hud.dist)}</b></div>
        <div className="readout"><span className="label">Time</span><b>{fmtTime(hud.time)}</b></div>
      </div>
    </div>
  );
}

function Legend() {
  const view = useStore(s => s.rackColor);
  const chip = (bg: string, text: string) => <span key={text}><i style={{ background: bg }} />{text}</span>;
  return (
    <div className="legend">
      {view === 'popularity' && <>
        {chip('linear-gradient(90deg,#c9d3df,#1f5fa8)', 'picked less → more')}
        {chip('#f28c28', 'to pick')}
        {chip('#3fa34d', 'picked')}
      </>}
      {view === 'visits' && <>
        {chip('#d7dbe0', 'not visited')}
        {chip('linear-gradient(90deg,#ffd166,#c8102e)', 'visits this replay: few → most')}
      </>}
      {view === 'velocity' && <>
        {(['A', 'B', 'C'] as const).map(k => chip(VELOCITY[k], `class ${k}`))}
        <span>floor shows zones A / B / C</span>
      </>}
      {view === 'cost' && (['A', 'B', 'C'] as const).map(k => chip(COST[k], `cost ${k}`))}
      {view === 'weight' && <>
        {chip(`linear-gradient(90deg,${FL.join(',')})`, 'FL0 by hand → FL7 pallet')}
        {chip(BULK_FLOOR, 'bulk zone (FL6–7)')}
      </>}
      {chip('#8b3fd9', 'selected')}
    </div>
  );
}
