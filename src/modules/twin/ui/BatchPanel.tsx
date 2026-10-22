// Batch picking: one trip serves several orders. Compares single-order picking with first-come and
// proximity carts on both reference layouts (test week), and sets what the 3D replay walks.
import { useMemo } from 'react';
import { useData } from '../../../core/appStore';
import { scoreBatching } from '../../../core/engine/batching';
import { m, pct, secs } from '../../../core/format';
import { useScenario } from '../scenarioStore';

export function BatchPanel() {
  const data = useData();
  const { batch, setBatch, layout } = useScenario();
  const test = data.orders.test;
  const rows = useMemo(() => (['original', 'baseline'] as const).map(l => {
    const assign = l === 'original' ? data.originalAssign : data.baselineAssign;
    return {
      l, single: scoreBatching(test, assign, data.pick, { size: 1, maxLines: Infinity, policy: 'fcfs' }),
      fcfs: scoreBatching(test, assign, data.pick, { ...batch, policy: 'fcfs' }),
      prox: scoreBatching(test, assign, data.pick, { ...batch, policy: 'proximity' }),
    };
  }), [data, test, batch]);
  const ref = rows[0].single;
  return (
    <section className="ops">
      <h3>Batch picking</h3>
      <p className="note">One trip serves several orders on a cart; every line is still picked on its own. Test week, {test.length} orders.</p>
      <div className="field"><span>Cart</span>
        <div className="seg">{[2, 3, 4, 5].map(n => <button key={n} className={batch.size === n ? 'on' : ''} onClick={() => setBatch({ size: n })}>{n} orders</button>)}</div>
      </div>
      <div className="field"><span>Replay</span>
        <div className="seg">
          <button className={batch.policy === 'fcfs' ? 'on' : ''} onClick={() => setBatch({ policy: 'fcfs' })}>First come</button>
          <button className={batch.policy === 'proximity' ? 'on' : ''} onClick={() => setBatch({ policy: 'proximity' })}>Proximity</button>
        </div>
      </div>
      <table className="ops-table">
        <thead><tr><th /><th>Single</th><th>First come</th><th>Proximity</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.l} className={r.l === layout ? 'current' : ''}>
              <th>{r.l === 'original' ? 'As received' : 'Baseline'}</th>
              {[r.single, r.fcfs, r.prox].map((s, k) => (
                <td key={k} className={r.l === layout && ((k === 1 && batch.policy === 'fcfs') || (k === 2 && batch.policy === 'proximity')) ? 'hl' : ''}>
                  <b>{m(s.totalDist)}</b><small>{secs(s.avgTime)} / order · {s.trips} trips</small>
                  <small className={s.totalDist < ref.totalDist ? 'good' : ''}>{k || r.l !== 'original' ? pct(s.totalDist / ref.totalDist - 1) + ' walk' : 'reference'}</small>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Proximity: the oldest order seeds a cart, then the order adding the least walking joins. Carts stay within one day and {batch.maxLines} lines. Sorting at the dock is not included.</p>
    </section>
  );
}
