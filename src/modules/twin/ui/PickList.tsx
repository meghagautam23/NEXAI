// The current order as a pick list: items in visiting order, ticked off as they are picked
import { useMemo } from 'react';
import { productImage } from '../../../core/productImages';
import { CategoryIcon } from '../../../core/ui/CategoryIcon';
import { useData } from '../../../core/appStore';
import { routeOrder, slotsOf } from '../../../core/engine/sim';
import type { Order } from '../../../core/engine/types';
import { useReplay } from '../replayStore';

export function PickList({ assign, orders, label = 'Order' }: { assign: readonly number[]; orders: (Order & { members?: string[] })[]; label?: string }) {
  const data = useData();
  const live = useReplay(s => s.live);
  const order = live ? orders[live.order - 1] : orders[0];
  const visits = useMemo(() => {
    const at: number[] = []; assign.forEach((s, p) => (at[s] = p));
    const qty = new Map<number, number>();   // a cart can hold the same product for several orders
    for (const l of order.lines) qty.set(l.p, (qty.get(l.p) ?? 0) + l.q);
    return routeOrder(slotsOf(order, assign)).path.slice(1, -1)
      .map(slot => ({ slot, p: at[slot], q: qty.get(at[slot]) ?? 0,
        secs: data.pick[at[slot]][slot] * order.lines.filter(l => l.p === at[slot]).length }));
  }, [order, assign, data]);
  const done = live ? (live.done ? visits.length : live.stop + 1) : 0;
  return (
    <aside className="picklist">
      <h3>{order.members ? `Cart of ${order.members.length}` : `${label} ${order.id}`}</h3>
      <p className="note">{new Date(order.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {visits.length} items</p>
      <ol>
        {visits.map((v, i) => (
          <li key={v.slot} className={i < done ? 'picked' : i === done && live && !live.done ? 'next' : ''}>
            <span className="check" aria-hidden="true">{i < done ? '✓' : ''}</span>
            <img className="thumb" src={productImage(data.products[v.p])} alt="" />
            <span className="pname"><CategoryIcon category={data.products[v.p].category} /> {data.products[v.p].name}
              <small> ×{v.q} · <b className={`abc-${data.products[v.p].abc}`}>{data.products[v.p].abc}</b> · FL{data.products[v.p].fl}</small></span>
            <span className="qty">{Math.round(v.secs)} s</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
