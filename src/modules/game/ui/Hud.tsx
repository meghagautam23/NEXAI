// Game header: planning saving (train weeks), the test-week score once revealed, and swaps left
import { ModuleHeader } from '../../../core/ui/ModuleHeader';
import { MAX_SWAPS, useGame, useRevealed, useSaved } from '../gameStore';
import { pointsFor } from '../scoring';

export function GameHeader() {
  const { mode, history, view, submitted } = useGame();
  const { planning, score } = useSaved();
  const revealed = useRevealed();
  const subtitle = view === 'menu' ? 'Re-slot the shelves so orders are faster to pick'
    : mode === 'challenge' ? (submitted ? 'Challenge submitted: scored on the unseen week' : 'Challenge: beat the baseline in 10 swaps')
    : 'Sandbox: started from the as-received layout';
  const tone = (x: number) => (x > 0.5 ? 'up' : x < -0.5 ? 'down' : '');
  return (
    <ModuleHeader n={3} title="Slotting challenge" subtitle={subtitle}>
      {view === 'play' && (<>
        <div className={`points ${tone(planning)}`} title="Seconds saved on 1–21 Nov, the weeks you plan on">
          <b>{pointsFor(planning).toLocaleString()}</b> s planning
        </div>
        <div className={`points ${revealed ? tone(score) : 'hidden'}`} title="Seconds saved on 22–30 Nov, the unseen week you are scored on">
          {revealed ? <><b>{pointsFor(score).toLocaleString()}</b> pts</> : <><b>?</b> pts until submit</>}
        </div>
        {mode === 'challenge' && (
          <div className="swaps" aria-label={`${MAX_SWAPS - history.length} swaps left`}>
            {Array.from({ length: MAX_SWAPS }, (_, i) => <i key={i} className={i < history.length ? 'used' : ''} />)}
          </div>
        )}
      </>)}
    </ModuleHeader>
  );
}
