// ui/TopBar.tsx — title, game mode, rack view and the tool tabs that open the side drawer
import { useShallow } from 'zustand/react/shallow';
import { useStore, type Mode, type Panel, type RackColor } from '../store';

const MODES: [Mode, string][] = [['challenge', 'Challenge'], ['sandbox', 'Sandbox']];
const VIEWS: [RackColor, string][] = [
  ['popularity', 'Popularity'], ['visits', 'Visit heatmap'],
  ['velocity', 'ABC by frequency'], ['cost', 'ABC by cost'], ['weight', 'Weight class (est.)'],
];

export function TopBar() {
  const s = useStore(useShallow(s => ({
    mode: s.mode, setMode: s.setMode, rackColor: s.rackColor, setRackColor: s.setRackColor,
    open: (s.ai.open ? 'ai' : s.batchOpen ? 'batch' : s.boardOpen ? 'board' : null) as Panel | null,
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
      <div className="brand">
        <span className="logo" aria-hidden>▦</span>
        <div>
          <b>Warehouse Digital Twin</b>
          <span className="sub">Real orders · Nov 2011 · scored on an unseen week</span>
        </div>
      </div>

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
      </label>

      <nav className="tabs" aria-label="Tools">
        {tab('ai', 'AI Suggest', s.aiRunning ? '…' : undefined)}
        {tab('batch', 'Batch picking')}
        {tab('board', 'Leaderboard', s.boardCount ? String(s.boardCount) : undefined)}
      </nav>
    </header>
  );
}
