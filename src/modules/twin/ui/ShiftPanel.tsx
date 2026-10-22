// Peak shift: several pickers against a courier cut-off, with congestion when two meet in an aisle
import { useData } from '../../../core/appStore';
import { fmtClock, rushOrders, shiftStars, simulateShift } from '../../../core/engine/shift';
import { secs } from '../../../core/format';
import { PICKER_COLOURS, SHIFT_SPEEDS, shiftOptions, useScenario } from '../scenarioStore';


const VOLUMES = [[1, 'Busiest day'], [2, 'Peak ×2'], [3, 'Peak ×3']] as const;

export function ShiftPanel({ assign }: { assign: readonly number[] }) {
  const data = useData();
  const { shift, setShiftSettings, setShift } = useScenario();
  const s = shift.settings, r = shift.result;

  const run = () => {
    const { orders } = rushOrders(data.orders.test, s.days);
    const opts = shiftOptions(s);
    const result = simulateShift(orders, assign, data.pick, opts);
    const free = s.congestion ? simulateShift(orders, assign, data.pick, { ...opts, congestion: false }) : result;
    setShift({ orders, result, free: { onTime: free.onTime, lastDone: free.lastDone }, clock: opts.shiftStart,
               end: Math.max(result.lastDone, opts.cutoff) + 300, playing: true });
  };

  return (
    <section className="ops">
      <h3>Peak shift</h3>
      <p className="note">Real test-week orders arrive at their real times from 08:00. Free pickers take the oldest waiting order
        (or a cart), pick, and pack (90 s an order). Orders packed by the cut-off ship today.</p>
      <div className="field"><span>Volume</span>
        <div className="seg">{VOLUMES.map(([d, l]) => <button key={d} className={s.days === d ? 'on' : ''} onClick={() => setShiftSettings({ days: d })}>{l}</button>)}</div>
      </div>
      <div className="field"><span>Pickers</span>
        <div className="seg">{[1, 2, 3, 4].map(n => <button key={n} className={s.pickers === n ? 'on' : ''} onClick={() => setShiftSettings({ pickers: n })}>{n}</button>)}</div>
      </div>
      <div className="field"><span>Cart</span>
        <div className="seg">{[1, 4].map(n => <button key={n} className={s.cart === n ? 'on' : ''} onClick={() => setShiftSettings({ cart: n })}>{n === 1 ? 'Single orders' : '4 orders'}</button>)}</div>
      </div>
      <div className="field"><span>Cut-off</span>
        <div className="seg">{[15, 16, 17].map(h => <button key={h} className={s.cutoffHour === h ? 'on' : ''} onClick={() => setShiftSettings({ cutoffHour: h })}>{h}:00</button>)}</div>
      </div>
      <label className="check"><input type="checkbox" checked={s.congestion} onChange={e => setShiftSettings({ congestion: e.target.checked })} />
        Congestion: pickers slow to 0.35 m/s when two meet in an aisle</label>
      <button className="primary block" onClick={run}>{r ? 'Run again' : 'Run the shift'}</button>

      {r && (<>
        <div className="headline">
          <b className={r.onTime / r.due >= 0.9 ? 'good' : r.onTime / r.due >= 0.8 ? '' : 'bad'}>{Math.round((100 * r.onTime) / r.due)}%</b>
          <span>shipped on time ({r.onTime} of {r.due})<br />{'★'.repeat(shiftStars(r.onTime / r.due))}{'☆'.repeat(3 - shiftStars(r.onTime / r.due))}</span>
        </div>
        <div className="kpis">
          <div><span>Last order packed</span><b>{fmtClock(r.lastDone)}</b></div>
          <div><span>Average wait</span><b>{secs(r.avgWait)}</b></div>
          <div><span>Lost to congestion</span><b>{Math.round(r.congestionDelay / 60)} min</b>
            {s.congestion && shift.free && <small>{Math.round((100 * shift.free.onTime) / r.due)}% on time without it</small>}</div>
          <div><span>Walked</span><b>{(r.walked / 1000).toFixed(1)} km</b><small>{r.trips.length} trips</small></div>
        </div>
        <div className="field"><span>Playback</span>
          <div className="seg">
            <button className={shift.playing ? 'on' : ''} onClick={() => setShift({ playing: !shift.playing, clock: shift.clock >= shift.end ? shiftOptions(s).shiftStart : shift.clock })}>
              {shift.playing ? 'Pause' : shift.clock >= shift.end ? 'Replay' : 'Play'}</button>
            {SHIFT_SPEEDS.map(v => <button key={v} className={shift.speed === v ? 'on' : ''} onClick={() => setShift({ speed: v })}>{v}×</button>)}
          </div>
        </div>
        <p className="legend-inline">{r.tracks.map((_, k) => <span key={k}><i className="sw dot" style={{ background: PICKER_COLOURS[k] }} /> Picker {k + 1}</span>)}</p>
      </>)}
    </section>
  );
}
