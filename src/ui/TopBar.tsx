// ui/TopBar.tsx — title, game mode, rack view and the tool tabs that open the side drawer
import { useShallow } from 'zustand/react/shallow';
import { useStore, type Mode, type Panel, type RackColor, type ShelfLabels } from '../store';

const MODES: [Mode, string][] = [['challenge', 'Challenge'], ['sandbox', 'Sandbox']];
const VIEWS: [RackColor, string][] = [
  ['popularity', 'Popularity'], ['visits', 'Visit heatmap'],
  ['velocity', 'ABC by frequency'], ['cost', 'ABC by cost'], ['weight', 'Handling level (FL)'],
];

export function TopBar() {
  const s = useStore(useShallow(s => ({
    mode: s.mode, setMode: s.setMode, rackColor: s.rackColor, setRackColor: s.setRackColor,
    labels: s.labels, setLabels: s.setLabels, setScreen: s.setScreen,
    open: (s.ai.open ? 'ai' : s.batchOpen ? 'batch' : s.rushOpen ? 'rush' : s.newItemOpen ? 'newItem' : s.boardOpen ? 'board' : null) as Panel | null,
    whatIf: s.whatIf, exitWhatIf: s.exitWhatIf,
    openPanel: s.openPanel, boardCount: s.board.length, aiRunning: s.ai.status === 'running',
  })));
  const tab = (p: Panel, label: string, extra?: string) => (
    <button className={`tab ${s.open === p ? 'on' : ''}`} onClick={() => s.openPanel(s.open === p ? null : p)}
            aria-pressed={s.open === p}>
      {label}{extra && <span className="badge">{extra}</span>}
    </button>
  );
  return (
    <header className="topbar">
      {s.whatIf && (
        <div className="whatif" role="status">
          What-if: {s.whatIf.symbol} {s.whatIf.name} added
          <button className="link" onClick={s.exitWhatIf}>Back to real data</button>
        </div>
      )}
      <button className="brand" onClick={() => s.setScreen('home')} title="Home">
        <span className="logo" aria-hidden>▦</span>
        <span>
          <b>Pick &amp; Pack</b>
          <span className="sub">Warehouse digital twin · real orders, Nov 2011</span>
        </span>
      </button>

      <div className="seg" role="group" aria-label="Game mode">
        {MODES.map(([k, label]) => (
          <button key={k} className={s.mode === k ? 'on' : ''} onClick={() => s.setMode(k)}>{label}</button>
        ))}
      </div>

      <label className="view">
        <span>View</span>
        <select value={s.rackColor} onChange={e => s.setRackColor(e.target.value as RackColor)}>
          {VIEWS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={s.labels} onChange={e => s.setLabels(e.target.value as ShelfLabels)} aria-label="Shelf labels">
          <option value="photos">Photo cards</option>
          <option value="symbols">Symbols</option>
          <option value="off">No labels</option>
        </select>
      </label>

      <nav className="tabs" aria-label="Tools">
        {tab('ai', 'AI Suggest', s.aiRunning ? '…' : undefined)}
        {tab('batch', 'Batch picking')}
        {tab('rush', '⏱ Peak rush')}
        {tab('newItem', '+ New item')}
        {tab('board', 'Leaderboard', s.boardCount ? String(s.boardCount) : undefined)}
      </nav>
    </header>
  );
}
