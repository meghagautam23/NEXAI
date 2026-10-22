// ui/BatchPanel.tsx — batch picking: single-order vs cart batching, per layout, on the test week
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { scoreBatching, type BatchPolicy, type BatchStats } from '../engine/batching';
import { useStore } from '../store';
import { fmtM, fmtPct, fmtTime } from './format';

const SIZES = [2, 3, 4, 5];
const POLICIES: [BatchPolicy, string][] = [['fcfs', 'First come'], ['proximity', 'Proximity']];

export function BatchBody() {
  const { batch, setBatch, replayBatches, setReplayBatches, ref, data, assign, ai, mode, submitted, layouts } =
    useStore(useShallow(s => ({
      batch: s.batch, setBatch: s.setBatch,
      replayBatches: s.replayBatches, setReplayBatches: s.setReplayBatches,
      ref: s.ref, data: s.data, assign: s.assign, ai: s.ai.result, mode: s.mode, submitted: s.submitted,
      layouts: s.refLayouts,
    })));

  // Every layout, single-order picking and both batching policies (about 20 ms each)
  const rows = useMemo(() => {
    if (!data || !layouts) return [];
    const test = data.orders.test;
    const list: [string, number[]][] = [['Original', layouts.original], ['Baseline', layouts.baseline]];
    if (mode === 'sandbox' || submitted) list.push(['Yours', assign]);
    if (ai) list.push(['AI Suggest', ai.assign]);
    return list.map(([name, a]) => {
      const single = scoreBatching(test, a, { size: 1, maxLines: Infinity, policy: 'fcfs' });
      const by = (policy: BatchPolicy): BatchStats => scoreBatching(test, a, { ...batch, policy });
      return { name, single, fcfs: by('fcfs'), proximity: by('proximity') };
    });
  }, [data, layouts, mode, submitted, assign, ai, batch]);

  if (!ref || !data) return null;
  const orig = rows[0]?.single.totalDist ?? 1;

  return (
    <>
      <p className="intro">
        One trip serves several orders on a cart: the picker visits every slot of the batch once, then sorts at
        the dock. Batches stay within a picking day and the cart's line capacity; a bigger order goes alone.
        <b> Proximity</b> seeds a cart with the earliest order, then adds the orders that add the least walking.
      </p>

      <div className="field">
        <span className="label">Cart</span>
        <div className="seg">
          {SIZES.map(k => (
            <button key={k} className={batch.size === k ? 'on' : ''} onClick={() => setBatch({ size: k })}>{k} orders</button>
          ))}
        </div>
      </div>
      <label className="assume">
        <span>Max lines per cart</span>
        <input type="number" min={5} step={5} value={batch.maxLines}
               onChange={e => { const v = Number(e.target.value); if (v >= 5) setBatch({ maxLines: v }); }} />
      </label>

      <table className="data">
        <thead>
          <tr><th /><th>Single order</th>{POLICIES.map(([k, l]) => <th key={k}>{l}</th>)}<th>Trips</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <th>{r.name}</th>
              <td>{fmtM(r.single.totalDist)}<div className="muted small">{fmtPct(r.single.totalDist / orig - 1)}</div></td>
              {POLICIES.map(([k]) => (
                <td key={k}>{fmtM(r[k].totalDist)}
                  <div className="good small">{fmtPct(r[k].totalDist / r.single.totalDist - 1)}</div></td>
              ))}
              <td>{r.single.trips} → {r.proximity.trips}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="caption">
        All {data.orders.test.length} test-week orders. Percent under batching is vs single-order picking of the same
        layout; under Single order, vs Original.
        {mode === 'challenge' && !submitted && ' Yours appears after you submit.'}
        {rows[1] && ` Avg time per order (Baseline, proximity): ${fmtTime(rows[1].proximity.avgTime)} vs ${fmtTime(rows[1].single.avgTime)}.`}
        {' '}Sorting time at the dock is not included.
      </div>

      <label className="check">
        <input type="checkbox" checked={replayBatches} onChange={e => setReplayBatches(e.target.checked)} />
        Replay batches in 3D ({batch.size}-order carts, proximity)
      </label>
    </>
  );
}
