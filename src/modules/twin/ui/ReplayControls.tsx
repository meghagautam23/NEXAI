// Play/pause and speed for the picker replay (used by the twin and the game)
import { SPEEDS, useReplay } from '../replayStore';


export function ReplayControls() {
  const r = useReplay();
  return (
    <div className="group">
      <button className="primary" onClick={r.togglePlay}>
        {r.playing ? 'Pause' : r.live && !r.live.done ? 'Resume' : r.live?.done ? 'Replay again' : 'Play replay'}
      </button>
      <div className="seg" role="group" aria-label="Speed">
        {SPEEDS.map(n => (
          <button key={n} className={r.speed === n ? 'on' : ''} aria-pressed={r.speed === n} onClick={() => r.setSpeed(n)}>
            {n}×
          </button>
        ))}
      </div>
    </div>
  );
}
