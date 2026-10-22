// Shift clock with live counters, shown over the 3D scene while a peak shift plays
import { fmtClock, shiftStats } from '../../../core/engine/shift';
import { useScenario } from '../scenarioStore';

export function ShiftClock() {
  const { result, clock, settings } = useScenario(s => s.shift);
  if (!result) return null;
  const cutoff = settings.cutoffHour * 3600;
  const st = shiftStats(result, clock, cutoff);
  return (
    <div className="ticker shift-clock">
      <span className={clock > cutoff ? 'bad' : ''}><b>{fmtClock(clock)}</b> {clock > cutoff ? 'after cut-off' : `cut-off ${settings.cutoffHour}:00`}</span>
      <span>arrived <b>{st.arrived}</b></span>
      <span>waiting <b>{st.waiting}</b></span>
      <span>shipped <b>{st.shipped}</b></span>
      <span className="good">on time <b>{st.onTime}</b></span>
      {st.late > 0 && <span className="bad">late <b>{st.late}</b></span>}
      {st.tomorrow > 0 && <span>next day <b>{st.tomorrow}</b></span>}
    </div>
  );
}
