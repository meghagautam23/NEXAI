// ui/Scoreboard.tsx — Original, Baseline and the player's layout on all test-week orders
import type { Stats } from '../engine/sim';
import { useStore } from '../store';
import { fmtM, fmtPct, fmtTime } from './format';

function Row({ name, s, original, note }: { name: string; s: Stats | null; original: Stats; note?: string }) {
  if (!s) return (
    <tr><th>{name}</th><td colSpan={6} className="muted">{note}</td></tr>
  );
  const change = s.totalDist / original.totalDist - 1;
  return (
    <tr>
      <th>{name}</th>
      <td>{fmtM(s.totalDist)}</td>
      <td>{fmtM(s.meanDist, 1)}</td>
      <td>{fmtM(s.medianDist, 1)}</td>
      <td>{fmtM(s.p90Dist, 1)}</td>
      <td>{fmtTime(s.avgTime)}</td>
      <td className={change < 0 ? 'good' : change > 0 ? 'bad' : ''}>{name === 'Original' ? '—' : fmtPct(change)}</td>
    </tr>
  );
}

export function Scoreboard() {
  const { ref, yours, mode, submitted, data, ai, setAi } = useStore();
  if (!ref || !yours || !data) return null;
  const hidden = mode === 'challenge' && !submitted;
  return (
    <div className="board">
      <div className="caption">Score: all {data.orders.test.length} test-week orders (22–30 Nov)</div>
      <table>
        <thead>
          <tr><th />
            <th>Total</th><th>Mean</th><th>Median</th><th>p90</th><th>Avg time</th><th>vs Original</th></tr>
        </thead>
        <tbody>
          <Row name="Original" s={ref.test.original} original={ref.test.original} />
          <Row name="Baseline" s={ref.test.baseline} original={ref.test.original} />
          <Row name="Yours" s={hidden ? null : yours.test} original={ref.test.original}
               note="Hidden until you submit: the test week is unseen" />
          {ai.result
            ? <Row name="AI Suggest" s={ai.result.test} original={ref.test.original} />
            : <tr><th>AI Suggest</th><td colSpan={6}>
                <button className="link" onClick={() => setAi({ open: true })}>Run AI Suggest</button></td></tr>}
        </tbody>
      </table>
      <div className="caption">Distance per order except Total. Avg time = walking at 1 m/s + 10 s per line.</div>
    </div>
  );
}
