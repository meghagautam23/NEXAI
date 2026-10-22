// ui/Home.tsx — the start screen: what the twin is, the headline result, and where to go
// (layout idea from Jayesh Pani's version)
import { useStore, type Screen } from '../store';

type Entry = { n: number; title: string; body: string; go: () => void; cta: string };

export function Home() {
  const s = useStore();
  const ready = s.data !== null;
  const open = (screen: Screen, after?: () => void) => () => { s.setScreen(screen); after?.(); };

  const entries: Entry[] = [
    { n: 1, title: 'Order data', cta: 'See the data',
      body: 'One month of real orders from a UK gift wholesaler, cleaned and split: 100 products, pick counts, classes, handling levels and what is bought together.',
      go: open('data') },
    { n: 2, title: 'Slotting challenge', cta: 'Play',
      body: 'Watch the picker walk real orders, then re-slot the shelves in 10 swaps and beat the fast-movers-first baseline on a week you cannot see.',
      go: open('twin', () => s.setMode('challenge')) },
    { n: 3, title: 'AI, batching and new items', cta: 'Explore',
      body: 'Let the AI suggest a layout and explain every move, pick several orders per trip, and find the best slot for a product that has never sold.',
      go: open('twin', () => { s.setMode('sandbox'); s.openPanel('ai'); }) },
    { n: 4, title: 'Peak-day rush', cta: 'Start the shift',
      body: 'Christmas peak: real orders against a courier cut-off. How many ship on time with your pickers, carts and layout?',
      go: open('twin', () => s.openPanel('rush')) },
  ];

  return (
    <div className="home">
      <header className="home-head">
        <p className="kicker">NEXAI 2026 · Track 4 · Warehouse digital twin</p>
        <h1 className="wordmark">Pick &amp; Pack</h1>
        <div className="hazard" aria-hidden />
        <p className="home-sub">A digital twin of a picking floor, driven by real orders. Re-slot the shelves and every
          change is replayed on the same orders: <b>measured, not claimed.</b></p>
      </header>

      <ol className="entries">
        {entries.map(e => (
          <li key={e.n}>
            <button className="entry" onClick={e.go} disabled={!ready}>
              <span className="entry-num">{e.n}</span>
              <strong>{e.title}</strong>
              <span className="entry-body">{e.body}</span>
              <span className="entry-cta">{ready ? `${e.cta} →` : 'Loading orders…'}</span>
            </button>
          </li>
        ))}
      </ol>

      <ul className="headline-strip" aria-label="Results on the unseen test week">
        <li><b>−4%</b><span>textbook rule: fast movers near the dock</span></li>
        <li><b>−9 to −13%</b><span>AI Suggest vs that baseline</span></li>
        <li><b>−60%</b><span>walking with 4-order carts</span></li>
        <li><b>83% → 93%</b><span>orders on time at Christmas peak, same 2 pickers</span></li>
      </ul>
      <p className="home-foot">Online Retail II (UCI, CC BY 4.0) · product photos from Wikimedia Commons (credits on the Order data page)</p>
    </div>
  );
}
