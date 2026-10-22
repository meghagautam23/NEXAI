// ui/RushPanel.tsx — peak-day rush: set up the shift, compare layouts on orders shipped on time, start it
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_RUSH, fmtClock, rushOrders, rushStars, simulateRush } from '../engine/rush';
import { rushOptions, useStore } from '../store';

const VOLUMES: [number, string][] = [[1, 'Busiest day'], [2, 'Peak ×2'], [3, 'Peak ×3']];
const CARTS: [number, string][] = [[1, 'Single'], [2, '2'], [3, '3'], [4, '4']];
const CUTOFFS = [15, 16, 17];

export const Stars = ({ n }: { n: number }) => (
  <span className="mini-stars" aria-label={`${n} of 3 stars`}>
    {[0, 1, 2].map(i => <span key={i} className={i < n ? 'on' : ''}>★</span>)}
  </span>
);

export function RushPanel() {
  const s = useStore(useShallow(s => ({
    data: s.data, assign: s.assign, layouts: s.refLayouts, ai: s.ai.result, mode: s.mode, submitted: s.submitted,
    settings: s.rush.settings, setRushSettings: s.setRushSettings, startRush: s.startRush, cost: s.assumptions.costPerHour,
  })));
  const { data, settings } = s;

  const { orders, dates } = useMemo(
    () => (data ? rushOrders(data.orders.test, settings.days) : { orders: [], dates: [] }), [data, settings.days]);

  // Every layout under the same shift (a few ms each; carts take longer)
  const rows = useMemo(() => {
    if (!data || !s.layouts) return [];
    const opts = rushOptions(settings);
    const list: [string, number[], boolean][] = [['Original', s.layouts.original, false], ['Baseline', s.layouts.baseline, false]];
    if (s.mode === 'sandbox' || s.submitted) list.push(['Yours', s.assign, true]);
    if (s.ai) list.push(['AI Suggest', s.ai.assign, false]);
    return list.map(([name, a, you]) => ({ name, you, r: simulateRush(orders, a, opts) }));
  }, [data, s.layouts, s.mode, s.submitted, s.assign, s.ai, settings, orders]);

  if (!data) return null;
  const hours = (17.5 - DEFAULT_RUSH.shiftStart / 3600) ; // paid shift 08:00–17:30
  const staffCost = settings.pickers * hours * s.cost;

  const seg = <T extends number>(opts: [T, string][], value: T, on: (v: T) => void) => (
    <div className="seg">{opts.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => on(v)}>{l}</button>)}</div>
  );

  return (
    <>
      <p className="intro">
        Christmas peak: real orders arrive at their real times, and the courier collects at the cut-off. Each picker
        takes the oldest waiting order (or a cart of them), walks, picks (10 s a line) and packs ({settings.packSec} s an
        order). Can your layout ship everything on time with as few pickers as possible?
      </p>

      <div className="field"><span className="label">Volume</span>{seg(VOLUMES, settings.days, v => s.setRushSettings({ days: v }))}</div>
      <div className="caption">
        {orders.length} real orders from {dates.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })).join(' + ')}
        {settings.days > 1 ? ', merged into one shift at their real times of day' : ''}.
      </div>
      <div className="field"><span className="label">Pickers</span>{seg([[1, '1'], [2, '2'], [3, '3']], settings.pickers, v => s.setRushSettings({ pickers: v }))}
        <span className="muted small">≈ £{Math.round(staffCost)} a shift</span></div>
      <div className="field"><span className="label">Cart</span>{seg(CARTS, settings.cart, v => s.setRushSettings({ cart: v }))}</div>
      <div className="field"><span className="label">Cut-off</span>
        {seg(CUTOFFS.map(h => [h, `${h}:00`] as [number, string]), settings.cutoffHour, v => s.setRushSettings({ cutoffHour: v }))}</div>

      <table className="data">
        <thead><tr><th /><th>On time</th><th>Late</th><th>Last packed</th><th /></tr></thead>
        <tbody>
          {rows.map(({ name, you, r }) => {
            const share = r.onTime / r.due;
            return (
              <tr key={name} className={you ? 'you' : ''}>
                <th>{name}</th>
                <td className={share >= 0.97 ? 'good' : share < 0.8 ? 'bad' : ''}><b>{Math.round(share * 100)}%</b>
                  <div className="muted small">{r.onTime}/{r.due}</div></td>
                <td>{r.due - r.onTime}</td>
                <td>{fmtClock(r.lastDone)}</td>
                <td><Stars n={rushStars(share)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="caption">
        Orders arriving after the cut-off ship tomorrow and are not counted. ★ 80% on time, ★★ 90%, ★★★ 97%.
        {s.mode === 'challenge' && !s.submitted && ' Your Challenge layout appears after you submit; Sandbox shows it live.'}
      </div>

      <button className="primary block" onClick={s.startRush}>▶ Watch the shift with the current layout</button>
    </>
  );
}
