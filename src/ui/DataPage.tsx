// ui/DataPage.tsx — what the pre-processing produced: facts, products, bought-together pairs, cleaning rules
// and photo credits (structure from Jayesh Pani's "Order data" module)
import { useEffect, useMemo, useState } from 'react';
import { categoryOf } from '../engine/categories';
import { useStore } from '../store';
import { VELOCITY, COST } from './palette';
import { productImage, type Credit } from './productImages';

type Tab = 'products' | 'pairs' | 'rules' | 'credits';

export function DataPage() {
  const data = useStore(s => s.data);
  const setScreen = useStore(s => s.setScreen);
  const [tab, setTab] = useState<Tab>('products');

  const facts = useMemo(() => {
    if (!data) return null;
    const { train, test } = data.orders;
    const sizes = [...train, ...test].map(o => o.lines.length).sort((a, b) => a - b);
    return {
      lines: sizes.reduce((a, b) => a + b, 0), median: sizes[sizes.length >> 1],
      p90: sizes[Math.floor(sizes.length * 0.9)], train: train.length, test: test.length,
    };
  }, [data]);
  if (!data || !facts) return <div className="loading">Loading orders…</div>;

  const tabs: [Tab, string][] = [['products', 'Products'], ['pairs', 'Bought together'], ['rules', 'How it was prepared'], ['credits', 'Photo credits']];
  return (
    <div className="page">
      <header className="page-head">
        <button onClick={() => setScreen('home')}>← Home</button>
        <div><h1>Order data</h1><p className="muted">Online Retail II, November 2011: one month of real order lines, turned into JSON</p></div>
        <button className="primary" onClick={() => setScreen('twin')}>Open the twin →</button>
      </header>

      <section className="facts">
        <Fact big="100" small="top products by picks" />
        <Fact big={(facts.train + facts.test).toLocaleString('en-GB')} small="orders in November 2011" />
        <Fact big={facts.lines.toLocaleString('en-GB')} small="order lines (picks)" />
        <Fact big={`${facts.median} / ${facts.p90}`} small="lines per order, median / p90" />
        <Fact big={`${facts.train.toLocaleString('en-GB')} / ${facts.test}`} small="orders: learn 1–21 Nov / test 22–30 Nov" />
      </section>

      <div className="seg page-tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'products' && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>#</th><th /><th>Product</th><th>Family</th><th>Picks 1–21 Nov</th><th>Frequency</th><th>Cost</th><th>Units / line</th><th>FL</th></tr></thead>
            <tbody>
              {data.products.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td><img className="thumb" src={productImage(p)} alt="" loading="lazy" /></td>
                  <th>{p.name}</th>
                  <td>{categoryOf(p).symbol} {categoryOf(p).label}</td>
                  <td>{p.picksTrain}</td>
                  <td><span className="pill" style={{ background: VELOCITY[p.abcVelocity], color: p.abcVelocity === 'A' ? '#fff' : '#172033' }}>{p.abcVelocity}</span></td>
                  <td><span className="pill" style={{ background: COST[p.abcCost] }}>{p.abcCost}</span></td>
                  <td>{p.unitsPerLine}</td>
                  <td>FL{p.fl}{p.fl >= 6 ? ' · bulk' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pairs' && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>#</th><th>Product</th><th>Bought with</th><th>Orders together (1–21 Nov)</th></tr></thead>
            <tbody>
              {data.affinity.slice(0, 25).map(([a, b, n], i) => (
                <tr key={i}><td>{i + 1}</td><th>{data.products[a].name}</th><td>{data.products[b].name}</td><td>{n}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Top 25 of {data.affinity.length} pairs. AI Suggest puts these next to each other.</p>
        </div>
      )}

      {tab === 'rules' && (
        <ul className="prose">
          <li>Cancelled invoices (number starts with "C") are removed, as are rows with quantity or price of 0 or less.</li>
          <li>Only real products are kept: codes of five digits plus up to two letters (no postage, fees or vouchers). Codes are upper-cased so 85049a and 85049A merge.</li>
          <li>Month: November 2011. <b>Learn</b> on 1–21 Nov, <b>test</b> on 22–30 Nov. The top 100 products, their classes and the bought-together pairs come from the learn weeks only, so the test week stays unseen.</li>
          <li>Lines for other products are dropped, then orders left empty. Large wholesale orders are kept.</li>
          <li><b>Frequency class:</b> pick rank, top 20 = A, next 30 = B, last 50 = C. <b>Cost class:</b> value moved (price × units), Pareto 80 / 95%. <b>Handling level FL0–7:</b> mean units per order line, banded ≤6, ≤8, ≤10, ≤12, ≤14, ≤17, ≤22, more. FL6–7 count as bulk.</li>
          <li>Files: <code>products.json</code>, <code>orders.json</code> (train / test), <code>affinity.json</code> (top 500 pairs), made by <code>preprocess.py</code> and checked by <code>scripts/validate_data.py</code>.</li>
        </ul>
      )}

      {tab === 'credits' && <Credits />}
    </div>
  );
}

function Fact({ big, small }: { big: string; small: string }) {
  return <div className="fact"><b>{big}</b><span>{small}</span></div>;
}

function Credits() {
  const [credits, setCredits] = useState<Record<string, Credit> | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}products/credits.json`).then(r => r.json()).then(setCredits).catch(() => setCredits({}));
  }, []);
  if (!credits) return <p className="muted">Loading credits…</p>;
  return (
    <div className="table-wrap">
      <p className="muted small">The dataset has no images. Each product is matched by name to a product type, shown with one openly
        licensed photo from Wikimedia Commons. Photos show the type of item, not the exact product.</p>
      <table className="data">
        <thead><tr><th>Type</th><th>Photo</th><th>Author</th><th>Licence</th></tr></thead>
        <tbody>
          {Object.entries(credits).map(([type, c]) => (
            <tr key={type}><th>{type.replace(/-/g, ' ')}</th>
              <td><a href={c.source} target="_blank" rel="noreferrer">{c.title}</a></td><td>{c.author}</td><td>{c.license}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
