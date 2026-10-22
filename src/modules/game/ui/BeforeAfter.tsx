// Before vs after per order: walking distance and pick time. Planning weeks until the score is revealed.
import { m1, secs } from '../../../core/format';
import { useGame, useRevealed } from '../gameStore';

export function BeforeAfter() {
  const { mode, ref, yours } = useGame();
  const revealed = useRevealed();
  if (!ref || !yours) return null;
  const week = revealed ? 'test' : 'train';
  const before = ref[week][mode === 'challenge' ? 'baseline' : 'original'], after = yours[week];
  const dDist = after.meanDist - before.meanDist, dTime = after.avgTime - before.avgTime;
  const tone = (d: number) => (d < -1e-9 ? 'good' : d > 1e-9 ? 'bad' : '');
  const sign = (d: number) => (d < -1e-9 ? '−' : d > 1e-9 ? '+' : '±');
  return (
    <div className="before-after" aria-label="Before and after, per order">
      <div className="ba-head">{revealed ? 'Scored week · 22–30 Nov' : 'Planning weeks · 1–21 Nov'}</div>
      <div>
        <span className="ba-label">Before ({mode === 'challenge' ? 'baseline' : 'as received'})</span>
        <span className="ba-val">{m1(before.meanDist)} · {secs(before.avgTime)}</span>
      </div>
      <div>
        <span className="ba-label">After (your layout)</span>
        <span className="ba-val">{m1(after.meanDist)} · {secs(after.avgTime)}</span>
      </div>
      <div className={tone(dTime)}>
        <span className="ba-label">Change per order</span>
        <span className="ba-val">{sign(dDist)}{m1(Math.abs(dDist))} · {sign(dTime)}{secs(Math.abs(dTime))}</span>
      </div>
    </div>
  );
}
