// Game menu
import { useGame } from '../gameStore';
import { HighScores } from './HighScores';
import { HowToPlay } from './HowToPlay';

export function Menu() {
  const { play, panel, setPanel, data } = useGame();
  return (
    <div className="menu-backdrop">
      <div className="box">
        {panel === null && (
          <div className="box-body">
            <h1 className="menu-title">Slotting challenge</h1>
            <p className="menu-intro">
              Re-slot the shelves so orders are faster to pick. Every layout is scored on the same real orders.
            </p>
            <div className="menu-actions">
              <button className="big primary" onClick={() => play('challenge')}>
                Challenge
                <small>Beat the baseline (fast movers nearest the dock) with 10 swaps</small>
              </button>
              <button className="big" onClick={() => play('sandbox')}>
                Sandbox
                <small>Start from the as-received layout with unlimited swaps</small>
              </button>
              <div className="menu-row">
                <button onClick={() => setPanel('how')}>How to play</button>
                <button onClick={() => setPanel('scores')}>High scores</button>
              </div>
            </div>
            <p className="menu-foot">{data ? `Scored on ${data.orders.test.length} real orders from 22–30 Nov 2011` : ''}</p>
          </div>
        )}
        {panel === 'how' && <HowToPlay onBack={() => setPanel(null)} />}
        {panel === 'scores' && <HighScores onBack={() => setPanel(null)} />}
      </div>
    </div>
  );
}
