// "A new product arrives": estimate it from look-alikes, make room, recommend a slot, place it
// (ported from Megha Gautam's NewItemPanel; seconds of picking time, FL from look-alikes).
import { useState } from 'react';
import { productImage } from '../../../core/productImages';
import { useGame } from '../gameStore';
import { pickingDays } from '../insights';
import { planNewItem, type NewItemPlan } from '../newItem';

const EXAMPLES = ['Jumbo Bag Woodland Animals', 'Hot Water Bottle Winter Fox', 'Regency Cakestand 2 Tier', 'Lunch Bag Retrospot Green'];
const SHOW = 3;

export function NewItemPanel() {
  const { data, realData, assign, placeNewItem, whatIf, exitWhatIf, setSide } = useGame();
  const [name, setName] = useState('');
  const [fl, setFl] = useState<string>('auto');
  const [plan, setPlan] = useState<NewItemPlan | null>(null);
  const base = realData ?? data;
  if (!base) return null;
  const head = (
    <div className="side-head"><h3>New product</h3><button className="link" onClick={() => setSide(null)}>Close</button></div>
  );
  if (whatIf) return (
    <aside className="side">
      {head}
      <p className="note">The warehouse now holds <b>{whatIf.name}</b> on shelf {whatIf.slot}; <b>{whatIf.retired}</b> went to reserve.
        You are in Sandbox: scores, AI Suggest and the replay all include the new product.</p>
      <button className="primary block" onClick={exitWhatIf}>Back to the real warehouse</button>
    </aside>
  );
  const run = (n = name) => {
    if (!n.trim()) return;
    setName(n);
    setPlan(planNewItem(base, assign, n, fl === 'auto' ? undefined : Number(fl)));
  };
  const p = base.products;
  const days = pickingDays(base.orders.train);
  return (
    <aside className="side">
      {head}
      <p className="note">A new product has no pick history. We estimate it from look-alike products, send the slowest mover to
        reserve, and test every shelf on the real orders to find where it costs least time.</p>
      <form className="newitem" onSubmit={e => { e.preventDefault(); run(); }}>
        <input value={name} onChange={e => { setName(e.target.value); setPlan(null); }} placeholder="Product name, e.g. Jumbo Bag Woodland Animals" maxLength={60} aria-label="Product name" />
        <div className="chips">{EXAMPLES.map(x => <button type="button" key={x} className="chip" onClick={() => run(x)}>{x}</button>)}</div>
        <label className="field"><span>Handling level</span>
          <select value={fl} onChange={e => { setFl(e.target.value); setPlan(null); }}>
            <option value="auto">Auto, from look-alikes</option>
            {Array.from({ length: 8 }, (_, k) => <option key={k} value={k}>FL{k}</option>)}
          </select>
        </label>
        <button className="primary block" type="submit" disabled={!name.trim()}>Find the best shelf</button>
      </form>
      {plan && (<>
        <div className="newitem-card">
          <img className="thumb big" src={productImage(plan.item)} alt="" />
          <div>
            <b>{plan.name}</b>
            <div className="note">{plan.item.category} · class {plan.item.abc} · FL{plan.item.fl}{plan.flEstimated ? ' (from look-alikes)' : ''}</div>
            <div className="note">Expect about <b>{plan.predictedPicks}</b> picks in 3 weeks (rank {plan.velocityRank} of 100)</div>
          </div>
        </div>
        <h4>Look-alikes</h4>
        <ul className="lookalikes">
          {plan.analogues.map(a => <li key={a.product}><img className="thumb" src={productImage(p[a.product])} alt="" />{p[a.product].name}<small className="muted"> · {p[a.product].picksTrain} picks · {Math.round(a.similarity * 100)}% match</small></li>)}
          {!plan.analogues.length && <li className="muted">No look-alikes: using the median product.</li>}
        </ul>
        <p className="note">To reserve: <b>{p[plan.retire].name}</b> ({p[plan.retire].picksTrain} picks, the slowest mover).</p>
        <h4>Best shelves</h4>
        <ol className="moves">
          {plan.options.slice(0, SHOW).map((o, k) => (
            <li key={o.slot}>
              <div className="move-head"><b>Shelf {o.slot} · aisle {o.aisle}, bay {o.bay}</b>
                <span className={o.delta < 0 ? 'good' : ''}>{o.delta < 0 ? `−${Math.round(-o.delta / days)} s/day` : 'freed shelf'}</span></div>
              <div className="note">{o.moved !== null ? `${p[o.moved].name} moves to the freed shelf. ` : 'Uses the freed shelf. '}
                {o.near ? `${o.near.metres.toFixed(1)} m from ${p[o.near.product].name}.` : ''}</div>
              <button className="link" onClick={() => placeNewItem(plan, k)}>Place it here</button>
            </li>
          ))}
        </ol>
        <p className="note">Saving per day vs simply using the freed shelf, on the planning weeks ({days} picking days).</p>
      </>)}
    </aside>
  );
}
