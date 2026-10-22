import { useGame } from '../gameStore';
import { Stars } from './Stars';

export function HighScores({ onBack }: { onBack: () => void }) {
  const { scores, loadLayout } = useGame();
  return (
    <div className="box-body">
      <h2>Leaderboard</h2>
      {scores.length === 0
        ? <p className="empty">No scores yet. Submit a challenge to set the first one.</p>
        : (
          <ol className="scores">
            {scores.map((s, i) => (
              <li key={`${s.at}-${i}`}>
                <span className="who">{s.name}{s.swaps ? <small className="muted"> · {s.swaps} swaps</small> : null}</span>
                <Stars n={s.stars} small />
                <span className="pts">{s.points.toLocaleString()}</span>
                {s.assign && <button className="link" onClick={() => loadLayout(s.assign!)}>Load</button>}
              </li>
            ))}
          </ol>
        )}
      <p className="note">Saved in this browser only. Load opens a layout in Sandbox.</p>
      <button className="primary" onClick={onBack}>Back</button>
    </div>
  );
}
