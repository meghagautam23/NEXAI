// AI Suggest side panel: run the optimiser, explain its moves, show the business case
// (ported from Megha Gautam's AiCard; savings in seconds of picking time).
import { pct } from '../../../core/format';
import { AI_ITERATIONS, AI_PLANS, useGame, type AiPlan } from '../gameStore';
import { impact } from '../insights';

const fmtGBP = (x: number) => `£${Math.round(x).toLocaleString('en-GB')}`;
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
const fmtS = (s: number) => (Math.abs(s) >= 600 ? `${(s / 60).toFixed(0)} min` : `${Math.round(s)} s`);
const TOP_MOVES = 5;

function Assumption({ label, value, unit, onChange, step = 1 }: { label: string; value: number; unit: string; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="assume">
      <span>{label}</span>
      <input type="number" min={step} step={step} value={value} onChange={e => { const v = Number(e.target.value); if (v > 0) onChange(v); }} />
      <span className="muted">{unit}</span>
    </label>
  );
}

export function AiPanel() {
  const { ai, setAiPlan, runAI, ref, data, assumptions, setAssumptions, loadLayout, setSide } = useGame();
  if (!ref || !data) return null;
  const r = ai.result;
  const base = ref.test.baseline;
  return (
    <aside className="side">
      <div className="side-head">
        <h3>AI Suggest</h3>
        <button className="link" onClick={() => setSide(null)}>Close</button>
      </div>
      <p className="note">
        Tries {AI_ITERATIONS.toLocaleString('en-GB')} swaps from the baseline, learning only from 1–21 Nov, then is scored on 22–30 Nov,
        which it never saw. It pulls bought-together products next to each other and forklift items to the aisle ends.
      </p>
      <div className="seg" role="group" aria-label="Plan">
        {(Object.keys(AI_PLANS) as AiPlan[]).map(k => (
          <button key={k} className={ai.plan === k ? 'on' : ''} disabled={ai.status === 'running'} onClick={() => setAiPlan(k)}>{AI_PLANS[k].label}</button>
        ))}
      </div>
      <button className="primary block" onClick={runAI} disabled={ai.status === 'running'}>
        {ai.status === 'running' ? 'Searching…' : r ? 'Run again' : 'Run AI Suggest'}
      </button>
      {ai.status === 'running' && (
        <div>
          <div className="progress wide"><div style={{ width: `${Math.min(100, ai.progress * 100)}%` }} /></div>
          <div className="note">{pct(ai.trainGain)} on the planning weeks so far</div>
        </div>
      )}
      {r && ai.status !== 'running' && (() => {
        const saved = base.totalTime - r.test.totalTime;
        const moves = r.moves.length;
        const imp = impact(saved, r.testDays, moves, assumptions);
        return (<>
          <div className="headline">
            <b className={saved > 0 ? 'good' : 'bad'}>{pct(r.test.totalTime / base.totalTime - 1)}</b>
            <span>picking time vs baseline on the unseen week</span>
          </div>
          <p className="note">
            {fmtS(saved)} saved over {r.testDays} picking days · planning weeks {pct(r.train.totalTime / ref.train.baseline.totalTime - 1)}
            {' '}· walking {pct(r.test.totalDist / base.totalDist - 1)} · {r.iterations.toLocaleString('en-GB')} swaps · {AI_PLANS[r.plan].label}
            {r.abcZones ? ' · ABC zones kept' : ''}
          </p>
          <h4>Why these moves <span className="muted">· {moves} products move</span></h4>
          <ol className="moves">
            {r.moves.slice(0, TOP_MOVES).map(mv => (
              <li key={mv.product}>
                <div className="move-head"><b>{data.products[mv.product].name}</b><span className="good">−{fmtS(Math.max(0, mv.saving))}</span></div>
                <div className="note">Shelf {mv.from} → {mv.to}. {mv.reason}</div>
              </li>
            ))}
          </ol>
          <h4>Business case <span className="muted">· this pick zone</span></h4>
          <div className="kpis">
            <div><span>Saved per day</span><b>{fmtH(imp.hoursPerDay)}</b></div>
            <div><span>Saved per year</span><b>{fmtH(imp.hoursPerYear)}</b><small>{fmtGBP(imp.poundsPerYear)}</small></div>
            <div><span>Re-slotting effort</span><b>{fmtH(imp.reslotHours)}</b><small>{fmtGBP(imp.reslotCost)}</small></div>
            <div><span>Pays back in</span><b>{Number.isFinite(imp.paybackDays) ? `${Math.ceil(imp.paybackDays)} days` : 'never'}</b><small>picking days</small></div>
          </div>
          <details>
            <summary>Assumptions (edit)</summary>
            <Assumption label="Picker cost" value={assumptions.costPerHour} unit="£ / hour" step={0.5} onChange={v => setAssumptions({ costPerHour: v })} />
            <Assumption label="Re-slot one product" value={assumptions.minutesPerMove} unit="minutes" onChange={v => setAssumptions({ minutesPerMove: v })} />
            <Assumption label="Picking days" value={assumptions.daysPerYear} unit="per year" onChange={v => setAssumptions({ daysPerYear: v })} />
            <p className="note">Daily saving = test-week saving ÷ {r.testDays} picking days. Covers the 100-product zone modelled here.</p>
          </details>
          <button className="block" onClick={() => loadLayout(r.assign)}>Open AI layout in Sandbox</button>
        </>);
      })()}
    </aside>
  );
}
