import { RULES } from '../../../core/engine/rules';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="box-body">
      <h2>How to play</h2>
      <ol className="steps">
        <li><b>Select a shelf.</b> Dashed lines show the products most often ordered with it.</li>
        <li><b>Hover another shelf</b> to preview the time the swap saves on 1–21 Nov, then click to swap. Ctrl/⌘+Z undoes.</li>
        <li><b>Submit</b> after up to 10 swaps. Your score is the seconds saved on 22–30 Nov, a week you never see while planning.</li>
      </ol>
      <ul className="facts">
        <li>Plan on the past, scored on the future: the same hold-out AI Suggest uses, so nobody can tune on the answers.</li>
        <li>Shelves near the packing dock are quickest to walk to; products ordered together save walking side by side.</li>
        <li>Forklift items (FL {RULES.forkliftFrom} and up) are quicker at the ends of an aisle: the forklift drives in less.</li>
        <li><b>Keep ABC zones</b> makes each product stay in its velocity zone (A nearest the dock).</li>
        <li>Shelves facing each other across an aisle share a pick point, so swapping them changes nothing.</li>
        <li>Rating: Bronze for any saving, Silver at 1,500, Gold at 4,000.</li>
      </ul>
      <button className="primary" onClick={onBack}>Back</button>
    </div>
  );
}
