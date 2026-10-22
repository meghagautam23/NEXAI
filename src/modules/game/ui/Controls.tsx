// Game controls: replay and camera (from the twin module), undo / submit / reset, rules, and the side panels
import { AisleFocus } from '../../twin/ui/AisleFocus';
import { ColourBySwitch } from '../../twin/ui/ColourBy';
import { ReplayControls } from '../../twin/ui/ReplayControls';
import { MAX_SWAPS, useGame } from '../gameStore';

export function Controls() {
  const g = useGame();
  const challenge = g.mode === 'challenge';
  return (
    <div className="controls">
      <ReplayControls />
      <ColourBySwitch />
      <AisleFocus />
      <div className="group">
        <button onClick={g.undo} disabled={!g.history.length || g.submitted} title="Ctrl/⌘+Z">Undo</button>
        {challenge && !g.submitted && (
          <button className="done-btn" onClick={g.submit} disabled={!g.history.length}
            title="Reveal the score on the unseen week (22–30 Nov)">Submit ({g.history.length}/{MAX_SWAPS})</button>
        )}
        <button onClick={g.reset}>Reset</button>
        {!challenge && <button onClick={g.loadBaseline}>Load baseline</button>}
        <button onClick={g.openMenu}>Menu</button>
      </div>
      {challenge && (
        <label className="check" title="Each product stays in the zone of its velocity class (A nearest the dock)">
          <input type="checkbox" checked={g.abcZones} onChange={e => g.setAbcZones(e.target.checked)} /> Keep ABC zones
        </label>
      )}
      <div className="group ai-group">
        <button className={g.side === 'newItem' ? 'on' : ''} onClick={() => g.setSide(g.side === 'newItem' ? null : 'newItem')}>New product</button>
        <button className={`ai-btn${g.side === 'ai' ? ' on' : ''}`} onClick={() => g.setSide(g.side === 'ai' ? null : 'ai')}>
          AI Suggest{g.ai.status === 'running' ? ' · running' : ''}
        </button>
      </div>
    </div>
  );
}
