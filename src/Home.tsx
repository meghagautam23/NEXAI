// Home: the three modules, one per MVP requirement, in the order data flows through them
import { useApp } from './core/appStore';
import { BUSINESS } from './core/categories';

const MODULES = [
  { n: 1, id: 'data', title: 'Order data', body: 'One month of real orders, prepared for simulation: the top 100 products, pick counts, cost classes and handling levels.' },
  { n: 2, id: 'twin', title: 'Warehouse replay', body: 'Watch a picker walk the aisles of the 3D warehouse to fill each order, with live distance and time.' },
  { n: 3, id: 'game', title: 'Slotting challenge', body: 'Re-slot products, replay the same orders, and beat the fast-movers-first baseline on time.' },
] as const;

export function Home() {
  const go = useApp(s => s.go);
  return (
    <div className="home">
      <header className="home-head">
        <p className="home-kicker">{BUSINESS.name} · {BUSINESS.tagline}</p>
        <h1 className="wordmark">Pick &amp; Pack</h1>
        <p className="home-sub">A digital twin of the picking floor. Replay real orders, re-slot the shelves, measure the difference.</p>
      </header>
      <ol className="modules">
        {MODULES.map(m => (
          <li key={m.id}>
            <button className={`module-card m${m.n}`} onClick={() => go(m.id)}>
              <span className={`mod-num m${m.n}`}>{m.n}</span>
              <strong>{m.title}</strong>
              <span>{m.body}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
