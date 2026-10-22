// ui/Drawer.tsx — one side drawer for the tools; the top-bar tabs choose what it shows
import { useShallow } from 'zustand/react/shallow';
import { useStore, type Panel } from '../store';
import { AiPanel } from './AiCard';
import { BatchBody } from './BatchPanel';
import { LeaderboardBody } from './Leaderboard';

const TITLES: Record<Panel, string> = { ai: 'AI Suggest', batch: 'Batch picking', board: 'Leaderboard' };

export function Drawer() {
  const { open, openPanel } = useStore(useShallow(s => ({
    open: (s.ai.open ? 'ai' : s.batchOpen ? 'batch' : s.boardOpen ? 'board' : null) as Panel | null,
    openPanel: s.openPanel,
  })));
  if (!open) return null;
  return (
    <aside className="drawer" aria-label={TITLES[open]}>
      <div className="drawer-head">
        <h2>{TITLES[open]}</h2>
        <button className="icon" onClick={() => openPanel(null)} aria-label={`Close ${TITLES[open]}`}>✕</button>
      </div>
      <div className="drawer-body">
        {open === 'ai' && <AiPanel />}
        {open === 'batch' && <BatchBody />}
        {open === 'board' && <LeaderboardBody />}
      </div>
    </aside>
  );
}
