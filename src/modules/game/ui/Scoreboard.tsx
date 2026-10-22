// Detailed stats (Section 6.4): all four layouts on every test-week order, time and walking
import type { Stats } from '../../../core/engine/sim';
import { RULES } from '../../../core/engine/rules';
import { m, m1, pct, secs } from '../../../core/format';
import { useGame, useRevealed } from '../gameStore';

function Row({ name, plan, s, ref0, tone, empty }: { name: string; plan: string; s?: Stats | null; ref0: Stats; tone?: string; empty: string }) {
  return (
    <tr className={tone}>
      <th>{name} <small>{plan}</small></th>
      {s ? (<>
        <td>{secs(s.avgTime)}</td><td>{secs(s.medianTime)}</td><td>{secs(s.p90Time)}</td>
        <td>{m(s.totalDist)}</td><td>{m1(s.meanDist)}</td><td>{m1(s.medianDist)}</td><td>{m1(s.p90Dist)}</td>
        <td className={s.totalTime < ref0.totalTime ? 'good' : s.totalTime > ref0.totalTime ? 'bad' : ''}>
          {pct(s.totalTime / ref0.totalTime - 1)}
        </td>
      </>) : <td colSpan={8} className="muted">{empty}</td>}
    </tr>
  );
}

export function Scoreboard() {
  const { ref, yours, ai, data } = useGame();
  const revealed = useRevealed();
  if (!ref || !data) return null;
  const t = ref.test;
  return (
    <details className="stats">
      <summary>Detailed stats</summary>
      <div className="stats-body">
        <table>
          <thead>
            <tr><th />
              <th>Time / order</th><th>Median</th><th>p90</th>
              <th>Total walk</th><th>Walk / order</th><th>Median</th><th>p90</th><th>Time vs original</th></tr>
          </thead>
          <tbody>
            <Row name="Original" plan="as received" s={t.original} ref0={t.original} empty="" />
            <Row name="Baseline" plan="fast movers first" s={t.baseline} ref0={t.original} empty="" />
            <Row name="Your layout" plan="" s={revealed ? yours?.test : null} ref0={t.original} tone="you" empty="Submit to reveal your score on this week" />
            <Row name="AI Suggest" plan="annealing" s={ai.result?.test} ref0={t.original} tone="ai" empty="Run AI Suggest to fill this row" />
          </tbody>
        </table>
        <p className="note">
          Scored on all {data.orders.test.length} orders from 22–30 Nov 2011, which no layout was built on. Time per order = walking at
          {' '}{RULES.walkSpeed} m/s + handling ({RULES.handlingBase} s + {RULES.handlingPerFl} s per FL level, +{RULES.classCheck.A} s class A,
          {' '}+{RULES.classCheck.B} s class B) + forklift access for FL {RULES.forkliftFrom}+ ({RULES.accessPerMetre} s per metre into the aisle).
        </p>
      </div>
    </details>
  );
}
