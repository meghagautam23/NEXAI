// ui/Leaderboard.tsx — best Challenge layouts saved in this browser
import { useStore } from '../store';
import { fmtM, fmtPct } from './format';

export function Leaderboard() {
  const { board, boardOpen, setBoardOpen, loadLayout } = useStore();
  if (!boardOpen) return null;
  return (
    <div className="leaderboard">
      <div className="row spread">
        <h2>Leaderboard</h2>
        <button className="icon" onClick={() => setBoardOpen(false)} aria-label="Close leaderboard">✕</button>
      </div>
      <div className="caption">Challenge results on the test week · saved in this browser only</div>
      {board.length === 0 ? (
        <p className="muted">No results yet. Finish a Challenge and save your layout.</p>
      ) : (
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Walking</th><th>vs Baseline</th><th>Swaps</th><th /></tr></thead>
          <tbody>
            {board.slice(0, 10).map((e, i) => (
              <tr key={e.id}>
                <td>{i + 1}</td>
                <th>{e.name}</th>
                <td>{fmtM(e.total)}</td>
                <td className={e.vsBaseline < 0 ? 'good' : 'bad'}>{fmtPct(e.vsBaseline)}</td>
                <td>{e.swaps}</td>
                <td><button onClick={() => loadLayout(e.assign)} title="Open this layout in Sandbox">Load</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
