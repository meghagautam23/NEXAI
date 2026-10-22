// Module 2 — Warehouse replay (MVP 2 + stretch goals): the digital twin replays real orders on a reference
// layout, as single orders, as batch-picking carts, or as a peak shift with several pickers and congestion.
// Read-only: no swapping, scoring of player layouts or optimiser (those live in the game module).
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../core/appStore';
import { ABC_LABEL, FL_LABEL } from '../../core/categories';
import { batchAsOrder, makeBatches } from '../../core/engine/batching';
import { pts } from '../../core/engine/geometry';
import { productAt } from '../../core/engine/layouts';
import { RULES, accessTime, handlingTime } from '../../core/engine/rules';
import { productImage } from '../../core/productImages';
import { CategoryIcon } from '../../core/ui/CategoryIcon';
import { ModuleHeader } from '../../core/ui/ModuleHeader';
import { Tooltip } from '../../core/ui/Tooltip';
import { useReplay } from './replayStore';
import { useScenario, type Scenario } from './scenarioStore';
import { WarehouseScene } from './scene/Scene';
import { ShiftPickers } from './scene/ShiftPickers';
import { AisleFocus } from './ui/AisleFocus';
import { BatchPanel } from './ui/BatchPanel';
import { ColourBySwitch, ColourLegend } from './ui/ColourBy';
import { PickList } from './ui/PickList';
import { ReplayControls } from './ui/ReplayControls';
import { ShiftClock } from './ui/ShiftClock';
import { ShiftPanel } from './ui/ShiftPanel';
import { Ticker } from './ui/Ticker';

const SCENARIOS: [Scenario, string][] = [['orders', 'Order replay'], ['batch', 'Batch picking'], ['shift', 'Peak shift']];

export function TwinModule() {
  const data = useData();
  const { scenario, setScenario, layout, setLayout, batch } = useScenario();
  const assign = layout === 'original' ? data.originalAssign : data.baselineAssign;
  const at = useMemo(() => productAt(assign), [assign]);
  const { colourBy, visits, reset } = useReplay();
  const [hover, setHover] = useState<{ slot: number; x: number; y: number } | null>(null);

  // What the single-picker replay walks: 25 sample orders, or 25 sample carts spread over the test week
  const replayOrders = useMemo(() => {
    if (scenario !== 'batch') return data.sample;
    const test = data.orders.test, batches = makeBatches(test, assign, batch);
    return Array.from({ length: Math.min(25, batches.length) }, (_, i) => batchAsOrder(test, batches[Math.floor((i * batches.length) / 25)]));
  }, [scenario, data, assign, batch]);
  useEffect(() => { reset(); }, [reset, scenario, layout, batch]);

  return (
    <div className="app twin">
      <ModuleHeader n={2} title="Warehouse replay" subtitle="Real orders walked through the 3D twin, one picker or a whole shift">
        <div className="seg" role="group" aria-label="Scenario">
          {SCENARIOS.map(([k, l]) => <button key={k} className={scenario === k ? 'on' : ''} onClick={() => setScenario(k)}>{l}</button>)}
        </div>
      </ModuleHeader>
      <div className="twin-body">
        <div className="stage">
          <WarehouseScene
            orders={replayOrders} getAssign={() => assign} picker={scenario !== 'shift'}
            racks={{
              at, colourBy, visits, hovered: hover?.slot ?? null,
              onSlotHover: (slot, e) => setHover(slot === null ? null : { slot, x: e?.nativeEvent.clientX ?? 0, y: e?.nativeEvent.clientY ?? 0 }),
            }}
          >
            {scenario === 'shift' && <ShiftPickers />}
          </WarehouseScene>
          {scenario === 'shift' ? <ShiftClock /> : <Ticker showTotals />}
          <ColourLegend />
          {hover && <ShelfTooltip slot={hover.slot} product={at[hover.slot]} x={hover.x} y={hover.y} />}
        </div>
        <aside className="picklist">
          {scenario === 'batch' && <BatchPanel />}
          {scenario === 'shift' && <ShiftPanel assign={assign} />}
          {scenario !== 'shift' && <PickList assign={assign} orders={replayOrders} />}
        </aside>
      </div>
      <div className="controls">
        {scenario !== 'shift' && <ReplayControls />}
        <div className="seg" role="group" aria-label="Layout">
          <button className={layout === 'original' ? 'on' : ''} onClick={() => setLayout('original')}>As received</button>
          <button className={layout === 'baseline' ? 'on' : ''} onClick={() => setLayout('baseline')}>Baseline</button>
        </div>
        <ColourBySwitch />
        <AisleFocus />
        <p className="note controls-note">
          Walking {RULES.walkSpeed} m/s; each pick takes {RULES.handlingBase} s + {RULES.handlingPerFl} s per FL level, +{RULES.classCheck.A} s for class A,
          {' '}and forklift items (FL {RULES.forkliftFrom}+) add {RULES.accessPerMetre} s per metre into the aisle.
        </p>
      </div>
    </div>
  );
}

/** Product card for a hovered shelf: category, class, FL and pick time on this shelf */
export function ShelfTooltip({ slot, product, x, y, children }: { slot: number; product: number; x: number; y: number; children?: React.ReactNode }) {
  const p = useData().products[product];
  const access = accessTime(p, slot);
  return (
    <Tooltip x={x} y={y}>
      <img className="tt-photo" src={productImage(p)} alt="" />
      <div className="tt-name"><CategoryIcon category={p.category} size={18} /> {p.name}</div>
      <div className="tt-meta">{p.category} · £{p.price.toFixed(2)} · shelf {slot}, aisle {pts[slot].aisle + 1}</div>
      <div className="tt-tags">
        <span className={`tag abc-${p.abc}`}>{ABC_LABEL[p.abc]}</span>
        <span className="tag fl">FL{p.fl} · {FL_LABEL(p.fl)}</span>
      </div>
      <div className="tt-meta">
        {handlingTime(p)} s per pick{access ? ` + ${access.toFixed(0)} s forklift access here` : ''} · picked {p.picksTrain}× in 1–21 Nov
      </div>
      {children}
    </Tooltip>
  );
}
