// ui/AiCard.tsx — AI Suggest drawer tab: run the optimizer, explain its moves, show the business case
import { impact } from '../engine/insights';
import { useShallow } from 'zustand/react/shallow';
import { AI_ITERATIONS, AI_PLANS, useStore, type AiPlan } from '../store';
import { fmtM, fmtPct } from './format';

const fmtGBP = (x: number) => `£${Math.round(x).toLocaleString('en-GB')}`;
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
const TOP_MOVES = 5;

function Assumption({ label, value, unit, onChange, step = 1 }:
  { label: string; value: number; unit: string; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="assume">
      <span>{label}</span>
      <input type="number" min={step} step={step} value={value}
             onChange={e => { const v = Number(e.target.value); if (v > 0) onChange(v); }} />
      <span className="muted">{unit}</span>
    </label>
  );
}

export function AiPanel() {
  // Narrow subscription: the replay updates the store ~10 times a second
  const { ai, setAi, runAI, ref, data, assumptions, setAssumptions, loadLayout } = useStore(useShallow(s => ({
    ai: s.ai, setAi: s.setAi, runAI: s.runAI, ref: s.ref, data: s.data,
    assumptions: s.assumptions, setAssumptions: s.setAssumptions, loadLayout: s.loadLayout,
  })));
  if (!ref || !data) return null;
  const r = ai.result;
  const base = ref.test.baseline;

  return (
    <>
      <p className="intro">
        Tries {AI_ITERATIONS.toLocaleString('en-GB')} swaps from the Baseline (a few seconds), learning only from 1–21 Nov, then is scored on
        22–30 Nov, which it never saw. Bought-together products are drawn next to each other; heavy items stay in
        front.
      </p>

      <div className="field">
        <span className="label">Plan</span>
        <div className="seg">
          {(Object.keys(AI_PLANS) as AiPlan[]).map(k => (
            <button key={k} className={ai.plan === k ? 'on' : ''} disabled={ai.status === 'running'}
                    onClick={() => setAi({ plan: k })}>{AI_PLANS[k].label}</button>
          ))}
        </div>
      </div>
      <button className="primary block" onClick={runAI} disabled={ai.status === 'running'}>
        {ai.status === 'running' ? 'Searching…' : r ? 'Run again' : 'Run AI Suggest'}
      </button>

      {ai.status === 'running' && (
        <div>
          <div className="bar"><i style={{ width: `${Math.min(100, ai.progress * 100)}%` }} /></div>
          <div className="caption">Improving… {fmtPct(ai.trainGain)} on the train weeks so far</div>
        </div>
      )}

      {r && ai.status !== 'running' && result()}
    </>
  );

  // A render helper, not a component, so it is not remounted on every render
  function result() {
    const res = r!;
    const saved = base.totalDist - res.test.totalDist;
    const moves = res.moves.length;
    const imp = impact(saved, res.testDays, moves, assumptions);
    return (
      <>
        <section>
          <div className="headline">
            <b className={saved > 0 ? 'good' : 'bad'}>{fmtPct(res.test.totalDist / base.totalDist - 1)}</b>
            <span>walking vs Baseline<br />on the unseen test week</span>
          </div>
          <div className="caption">
            {fmtM(saved)} less over {res.testDays} picking days · train weeks {fmtPct(res.train.totalDist / ref!.train.baseline.totalDist - 1)}
            {' '}· {res.iterations.toLocaleString('en-GB')} swaps tried · {AI_PLANS[res.plan].label}
            {res.abcZones ? ' · ABC zones kept' : ''}
          </div>
        </section>

        <section>
          <h3>Why these moves <span className="muted">· {moves} products move; top {Math.min(TOP_MOVES, moves)} shown</span></h3>
          <ol className="moves">
            {res.moves.slice(0, TOP_MOVES).map(m => (
              <li key={m.product}>
                <div className="move-head">
                  <b>{data!.products[m.product].name}</b>
                  <span className="good">−{fmtM(Math.max(0, m.saving))}</span>
                </div>
                <div className="muted small">Slot {m.from} → {m.to}. {m.reason}</div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3>Business case <span className="muted">· this pick zone, walking time only</span></h3>
          <div className="kpis">
            <div><span className="label">Saved per day</span><b>{fmtH(imp.hoursPerDay)}</b></div>
            <div><span className="label">Saved per year</span><b>{fmtH(imp.hoursPerYear)}</b><span className="muted">{fmtGBP(imp.poundsPerYear)}</span></div>
            <div><span className="label">Re-slotting effort</span><b>{fmtH(imp.reslotHours)}</b><span className="muted">{fmtGBP(imp.reslotCost)}</span></div>
            <div><span className="label">Pays back in</span>
              <b>{Number.isFinite(imp.paybackDays) ? `${Math.ceil(imp.paybackDays)} days` : 'never'}</b>
              <span className="muted">picking days</span></div>
          </div>
          <details>
            <summary>Assumptions (edit)</summary>
            <Assumption label="Picker cost" value={assumptions.costPerHour} unit="£ / hour"
                        onChange={v => setAssumptions({ costPerHour: v })} step={0.5} />
            <Assumption label="Re-slot one product" value={assumptions.minutesPerMove} unit="minutes"
                        onChange={v => setAssumptions({ minutesPerMove: v })} />
            <Assumption label="Picking days" value={assumptions.daysPerYear} unit="per year"
                        onChange={v => setAssumptions({ daysPerYear: v })} />
            <p className="muted small">Daily saving = test-week saving ÷ {res.testDays} picking days, walking at 1 m/s.
              Covers the 100-product zone modelled here, not the whole catalogue.</p>
          </details>
        </section>

        <button className="block" onClick={() => loadLayout(res.assign)}>Open AI layout in Sandbox</button>
      </>
    );
  }
}
