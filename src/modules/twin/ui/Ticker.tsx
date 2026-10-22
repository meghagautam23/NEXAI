// Live counters: simulated distance and time, not wall-clock (Section 6.4)
import { REPLAY_ORDERS } from '../../../core/data';
import { m1, secs } from '../../../core/format';
import { useReplay } from '../replayStore';

export function Ticker({ showTotals = false, hideIdle = false }: { showTotals?: boolean; hideIdle?: boolean }) {
  const live = useReplay(s => s.live);
  if (hideIdle && !live) return null;
  return (
    <div className="ticker" aria-live="off">
      <span>Order <b>{live?.order ?? 0}</b> of {REPLAY_ORDERS}</span>
      <span><b>{live?.lines ?? 0}</b> items</span>
      <span>walked <b>{m1(live?.dist ?? 0)}</b></span>
      <span>time <b>{secs(live?.time ?? 0)}</b></span>
      {showTotals && <span className="totals">all orders so far: <b>{m1(live?.totalDist ?? 0)}</b> · <b>{secs(live?.totalTime ?? 0)}</b></span>}
    </div>
  );
}
