// ui/Scoreboard.tsx — Original, Baseline, the player's layout and AI Suggest on all test-week orders
import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Stats } from '../engine/sim';
import { useStore } from '../store';
import { fmtM, fmtPct, fmtTime } from './format';

type RowProps = { name: string; s: Stats | null; original: Stats; detail: boolean; note?: ReactNode; you?: boolean };

function Row({ name, s, original, detail, note, you }: RowProps) {
  const cols = detail ? 6 : 3;
  if (!s) return <tr className={you ? 'you' : ''}><th>{name}</th><td colSpan={cols} className="note">{note}</td></tr>;
  const change = s.totalDist / original.totalDist - 1;
  return (
    <tr className={you ? 'you' : ''}>
      <th>{name}</th>
      <td>{fmtM(s.totalDist)}</td>
      <td className={change < 0 ? 'good' : change > 0 ? 'bad' : 'muted'}>{name === 'Original' ? '—' : fmtPct(change)}</td>
      {detail && <><td>{fmtM(s.meanDist, 1)}</td><td>{fmtM(s.medianDist, 1)}</td><td>{fmtM(s.p90Dist, 1)}</td></>}
      <td>{fmtTime(s.avgTime)}</td>
    </tr>
  );
}

export function Scoreboard() {
  const { ref, yours, mode, submitted, data, ai, openPanel } = useStore(useShallow(s => ({
    ref: s.ref, yours: s.yours, mode: s.mode, submitted: s.submitted, data: s.data, ai: s.ai.result, openPanel: s.openPanel,
  })));
  const [detail, setDetail] = useState(false);
  if (!ref || !yours || !data) return null;
  const hidden = mode === 'challenge' && !submitted;
  const o = ref.test.original;
  return (
    <section className="card board">
      <div className="card-head">
        <b>Score</b>
        <span className="muted">all {data.orders.test.length} orders of the unseen test week</span>
        <button className="link" onClick={() => setDetail(!detail)}>{detail ? 'Less' : 'Per-order detail'}</button>
      </div>
      <table className="data">
        <thead>
          <tr><th />
            <th>Walking</th><th>vs Original</th>
            {detail && <><th>Mean</th><th>Median</th><th>p90</th></>}
            <th>Time / order</th></tr>
        </thead>
        <tbody>
          <Row name="Original" s={o} original={o} detail={detail} />
          <Row name="Baseline" s={ref.test.baseline} original={o} detail={detail} />
          <Row name="Yours" s={hidden ? null : yours.test} original={o} detail={detail} you
               note="Hidden until you submit" />
          <Row name="AI Suggest" s={ai?.test ?? null} original={o} detail={detail}
               note={<button className="link" onClick={() => openPanel('ai')}>Run AI Suggest →</button>} />
        </tbody>
      </table>
    </section>
  );
}
