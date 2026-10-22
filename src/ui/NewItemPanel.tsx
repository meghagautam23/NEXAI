// ui/NewItemPanel.tsx — "A new product arrives": estimate it, make room, recommend a slot, place it
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { planNewItem, type NewItemPlan } from '../engine/newItem';
import { pickingDays } from '../engine/insights';
import { useStore } from '../store';
import { fmtM } from './format';

const EXAMPLES = ['Jumbo Bag Woodland Animals', 'Hot Water Bottle Winter Fox', 'Regency Cakestand 2 Tier', 'Lunch Bag Retrospot Green'];
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7];
const SHOW = 3;

export function NewItemPanel() {
  const { data, assign, placeNewItem, whatIf, exitWhatIf } = useStore(useShallow(s => ({
    data: s.realData ?? s.data, assign: s.realData ? null : s.assign,
    placeNewItem: s.placeNewItem, whatIf: s.whatIf, exitWhatIf: s.exitWhatIf,
  })));
  const [name, setName] = useState('');
  const [level, setLevel] = useState<string>('auto');
  const [plan, setPlan] = useState<NewItemPlan | null>(null);

  if (!data) return null;
  if (whatIf) return (
    <>
      <p className="intro">
        The warehouse now holds <b>{whatIf.symbol} {whatIf.name}</b> in slot {whatIf.slot}; <b>{whatIf.retired}</b> went to
        reserve. You are in Sandbox: the scoreboard, AI Suggest and Batch picking all include the new item.
      </p>
      <button className="primary block" onClick={exitWhatIf}>Back to the real warehouse</button>
    </>
  );

  const run = (n = name) => {
    if (!n.trim() || !assign) return;
    setName(n);
    setPlan(planNewItem(data, assign, { name: n, fl: level === 'auto' ? undefined : Number(level) }, pickingDays(data.orders.train)));
  };
  const p = data.products;

  return (
    <>
      <p className="intro">
        A new product has no pick history. We estimate it from look-alike products, make room by sending the slowest
        mover to reserve, and test every slot on the real orders to find where it walks least.
      </p>

      <form className="newitem" onSubmit={e => { e.preventDefault(); run(); }}>
        <label className="label" htmlFor="ni-name">Product name</label>
        <input id="ni-name" value={name} onChange={e => { setName(e.target.value); setPlan(null); }}
               placeholder="e.g. Jumbo Bag Woodland Animals" maxLength={60} />
        <div className="chips">
          {EXAMPLES.map(x => <button type="button" key={x} className="chip" onClick={() => run(x)}>{x}</button>)}
        </div>
        <label className="label" htmlFor="ni-fl">Handling level</label>
        <select id="ni-fl" value={level} onChange={e => { setLevel(e.target.value); setPlan(null); }}>
          <option value="auto">Auto: like its look-alikes</option>
          {LEVELS.map(l => <option key={l} value={l}>FL{l}{l === 0 ? ' (by hand)' : l >= 6 ? ' (bulk)' : ''}</option>)}
        </select>
        <button className="primary block" type="submit" disabled={!name.trim()}>Find the best slot</button>
      </form>

      {plan && (
        <>
          <section>
            <div className="newitem-head">
              <span className="sym">{plan.symbol}</span>
              <div><b>{plan.name}</b><span className="muted"> · {plan.family}</span></div>
            </div>
            <div className="kpis">
              <div><span className="label">Expected picks</span><b>{plan.predictedPicks}</b><span className="muted">per 3 weeks</span></div>
              <div><span className="label">Velocity class</span><b>{plan.velocity}</b><span className="muted">from look-alikes</span></div>
              <div><span className="label">Handling</span><b>FL{plan.fl}</b>
                <span className="muted">{plan.flEstimated ? `~${plan.unitsPerLine} units a line` : 'set by you'}{plan.bulk ? ' · bulk: front bays' : ''}</span></div>
              <div><span className="label">Makes room</span><b className="small-b">{p[plan.retire].name}</b>
                <span className="muted">slowest ({p[plan.retire].picksTrain} picks) → reserve</span></div>
            </div>
          </section>

          <section>
            <h3>Looks like</h3>
            {plan.analogues.length ? (
              <ul className="alike">
                {plan.analogues.map(a => (
                  <li key={a.product}><span>{p[a.product].name}</span>
                    <span className="muted">{Math.round(a.similarity * 100)}% · {p[a.product].picksTrain} picks</span></li>
                ))}
              </ul>
            ) : <p className="muted">No close match: using a typical product's demand.</p>}
          </section>

          <section>
            <h3>Best slots <span className="muted">· all {plan.options.length} allowed slots tested</span></h3>
            <ol className="moves">
              {plan.options.slice(0, SHOW).map((o, i) => {
                const base = plan.options.find(x => x.moved === null);
                const vsFreed = base ? (base.delta - o.delta) / plan.trainDays : 0;
                return (
                  <li key={o.slot}>
                    <div className="move-head">
                      <b>Slot {o.slot} · aisle {o.aisle}, bay {o.bay} · zone {o.zone}</b>
                      <button className={i === 0 ? 'primary' : ''} onClick={() => placeNewItem(plan, plan.options.indexOf(o))}>Place</button>
                    </div>
                    <div className="muted small">
                      {o.moved === null ? 'Straight into the freed slot, nothing else moves. '
                        : `${p[o.moved].name} moves to the freed slot. `}
                      {vsFreed > 0.05 && <span className="good">{fmtM(vsFreed, 1)} less walking per day than the freed slot. </span>}
                      {o.near && `${fmtM(o.near.metres, 1)} from ${p[o.near.product].name}.`}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
