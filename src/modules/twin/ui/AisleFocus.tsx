// Camera shortcuts: whole floor or one aisle
import { AISLES } from '../../../core/engine/geometry';
import { useReplay } from '../replayStore';

export function AisleFocus() {
  const { focus, setFocus } = useReplay();
  return (
    <div className="seg aisle-focus" role="group" aria-label="Camera">
      <button className={focus === null ? 'on' : ''} aria-pressed={focus === null} onClick={() => setFocus(null)}>All aisles</button>
      {Array.from({ length: AISLES }, (_, a) => (
        <button key={a} className={focus === a ? 'on' : ''} aria-pressed={focus === a} onClick={() => setFocus(a)}>{a + 1}</button>
      ))}
    </div>
  );
}
