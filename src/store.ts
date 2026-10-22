// store.ts — game state shared by the 3D scene and the UI (zustand)
//
// The player plans on history and is judged on the future, exactly like the optimizer:
// swap previews use the train weeks (1–21 Nov); the score is the unseen test week (22–30 Nov).
// In Challenge mode the test-week result stays hidden until the player submits.
import { create } from 'zustand';
import { partnersOf, type Data } from './engine/data';
import { baselineLayout, originalLayout, samePickPoint } from './engine/layouts';
import { sampleOrders } from './engine/replay';
import { DEFAULT_BATCH, type BatchOptions } from './engine/batching';
import type { NewItemPlan } from './engine/newItem';
import { makeEngine, scoreLayout, type Engine, type Stats } from './engine/sim';
import { addEntry, readBoard, type Entry } from './leaderboard';
import { swapProblem } from './engine/rules';
import { DEFAULT_ASSUMPTIONS, explainMoves, pickingDays, type Assumptions, type Move } from './engine/insights';
import { optimize, type OptimizeResult } from './engine/optimizer';
import type { WorkerMessage, WorkerRequest } from './engine/optimizer.worker';

export type Mode = 'challenge' | 'sandbox';
// AI Suggest plans: metres of train-week walking charged per product moved (re-slotting effort)
export type AiPlan = 'max' | 'balanced' | 'few';
export const AI_PLANS: Record<AiPlan, { label: string; penalty: number }> = {
  max: { label: 'Max saving', penalty: 0 },
  balanced: { label: 'Balanced', penalty: 100 },
  few: { label: 'Fewer moves', penalty: 200 },
};
// A fixed number of swaps, so every run searches equally hard whatever the laptop; the time cap is a safety net
export const AI_ITERATIONS = 45000;
export const AI_MAX_MS = 15000;
export type AiResult = {
  assign: number[]; train: Stats; test: Stats; moves: Move[]; iterations: number;
  plan: AiPlan; abcZones: boolean; trainDays: number; testDays: number;
};
export type AiState = { status: 'idle' | 'running' | 'done'; plan: AiPlan; open: boolean; progress: number; trainGain: number; result: AiResult | null };

// Challenge rating: one star for beating the Baseline, two at 1% better, three at 2.5% better or for
// beating AI Suggest's layout (when it has been run) on the unseen week
export const STAR_STEPS = [0, -0.01, -0.025];
export function starsFor(vsBaseline: number, beatAi: boolean): number {
  if (vsBaseline >= 0) return 0;
  if (beatAi) return 3;
  return STAR_STEPS.filter(t => vsBaseline < t).length;
}

export type RackColor = 'popularity' | 'visits' | 'velocity' | 'cost' | 'weight';
export const CHALLENGE_SWAPS = 10;
export const SPEEDS = [1, 10, 50] as const;

// Live replay readout, pushed by the scene a few times per second
export type ReplayHud = {
  index: number; count: number; orders: number; orderId: string; lines: number; dist: number; time: number; done: boolean;
};
export type Panel = 'ai' | 'board' | 'batch' | 'newItem';
type Ref = { original: Stats; baseline: Stats };

type State = {
  data: Data | null;
  partners: number[][];        // top-3 bought-together partners per product
  ref: { train: Ref; test: Ref } | null;
  refLayouts: { original: number[]; baseline: number[] } | null;

  mode: Mode;
  assign: number[];            // the player's layout, productId -> slotId
  productAt: number[];         // slotId -> productId
  yours: { train: Stats; test: Stats } | null;
  history: [number, number][]; // swapped slot pairs, for undo
  submitted: boolean;          // Challenge: test-week result revealed
  abcZones: boolean;           // Challenge option: products must stay in their velocity zone

  selected: number | null;     // slot
  hover: { slot: number; x: number; y: number } | null;
  preview: { slot: number; delta: number } | null; // train-week change if `selected` swaps with `slot`
  blocked: { slot: number; reason: string } | null; // why `selected` may not swap with `slot`
  toast: { text: string; id: number } | null;

  rackColor: RackColor;
  showIcons: boolean;          // product-family symbols on the racks
  visits: number[];            // picks per slot during the current replay (heatmap)
  board: Entry[];              // leaderboard, this browser only
  boardOpen: boolean;
  batchOpen: boolean;
  newItemOpen: boolean;
  realData: Data | null;       // the real data while a what-if (new item) world is loaded
  whatIf: { name: string; symbol: string; retired: string; slot: number } | null;
  batch: BatchOptions;          // cart for batch picking
  replayBatches: boolean;       // the 3D replay walks batches instead of single orders
  savedRound: boolean;         // this Challenge result is already on the board

  sample: number[];
  playing: boolean;
  speed: number;
  replayKey: number;
  routeSlots: number[];
  picked: number;
  hud: ReplayHud;

  init: (data: Data) => void;
  setMode: (mode: Mode) => void;
  reset: () => void;
  loadBaseline: () => void;
  clickSlot: (slot: number) => void;
  hoverSlot: (slot: number | null, x?: number, y?: number) => void;
  undo: () => void;
  submit: () => void;
  notify: (text: string) => void;
  setRackColor: (c: RackColor) => void;
  setShowIcons: (on: boolean) => void;
  resetVisits: () => void;
  recordPick: (slot: number) => void;
  saveResult: (name: string) => void;
  loadLayout: (assign: number[]) => void;
  setBoardOpen: (open: boolean) => void;
  openPanel: (panel: Panel | null) => void; // the top-right panels share one place
  setBatch: (patch: Partial<BatchOptions>) => void;
  setReplayBatches: (on: boolean) => void;
  placeNewItem: (plan: NewItemPlan, option: number) => void;
  exitWhatIf: () => void;
  setAbcZones: (on: boolean) => void;

  ai: AiState;
  assumptions: Assumptions;
  runAI: () => void;
  finishAI: (r: OptimizeResult, plan: AiPlan, abcZones: boolean) => void;
  setAi: (patch: Partial<AiState>) => void;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  restart: () => void;
};

// Engines are mutable and hot, so they live outside React state
let train: Engine | null = null, test: Engine | null = null;
let worker: Worker | null = null;
// The optimizer draws on the top 5 bought-together partners (the hints show 3)
const partners5 = (data: Data) => partnersOf(data.affinity, 5);

// Heavy items always stay in the front bays; ABC zones apply only in Challenge when switched on
const rulesFor = (s: Pick<State, 'mode' | 'abcZones'>) => ({ abcZones: s.mode === 'challenge' && s.abcZones });

const noVisits = () => Array<number>(100).fill(0);
const emptyHud: ReplayHud = { index: 0, count: 0, orders: 0, orderId: '', lines: 0, dist: 0, time: 0, done: false };
const startLayout = (data: Data, mode: Mode) =>
  mode === 'challenge' ? baselineLayout(data.products) : originalLayout(data.products);

export const useStore = create<State>()((set, get) => {
  // Rebuild both engines from a layout and publish everything derived from them
  const load = (assign: number[], extra: Partial<State> = {}) => {
    const { data } = get();
    if (!data) return;
    train = makeEngine(data.orders.train, assign);
    test = makeEngine(data.orders.test, assign);
    set(s => ({
      assign: [...test!.assign], productAt: [...test!.productAt],
      yours: { train: train!.stats(), test: test!.stats() },
      history: [], submitted: false, savedRound: false, selected: null, preview: null, blocked: null,
      replayKey: s.replayKey + 1, playing: true, ...extra,
    }));
  };

  const swapSlots = (a: number, b: number) => {
    const pa = test!.productAt[a], pb = test!.productAt[b];
    train!.swap(pa, pb); test!.swap(pa, pb);
    set(s => ({
      assign: [...test!.assign], productAt: [...test!.productAt],
      yours: { train: train!.stats(), test: test!.stats() },
      selected: null, preview: null, replayKey: s.replayKey + 1,
    }));
  };

  return {
    data: null, partners: [], ref: null, refLayouts: null,
    mode: 'challenge', assign: [], productAt: [], yours: null, history: [], submitted: false, abcZones: false,
    selected: null, hover: null, preview: null, blocked: null, toast: null,
    ai: { status: 'idle', plan: 'balanced', open: false, progress: 0, trainGain: 0, result: null },
    assumptions: DEFAULT_ASSUMPTIONS,
    rackColor: 'popularity', showIcons: true, visits: noVisits(), board: readBoard(), boardOpen: false, savedRound: false,
    batchOpen: false, batch: DEFAULT_BATCH, replayBatches: false,
    newItemOpen: false, realData: null, whatIf: null,
    sample: [], playing: true, speed: 10, replayKey: 0, routeSlots: [], picked: 0, hud: emptyHud,

    init: data => {
      const o = originalLayout(data.products), b = baselineLayout(data.products);
      const ref = {
        train: { original: scoreLayout(data.orders.train, o), baseline: scoreLayout(data.orders.train, b) },
        test: { original: scoreLayout(data.orders.test, o), baseline: scoreLayout(data.orders.test, b) },
      };
      set({ data, ref, refLayouts: { original: o, baseline: b }, partners: partnersOf(data.affinity, 3), sample: sampleOrders(data.orders.test) });
      load(startLayout(data, get().mode));
    },

    setMode: mode => { const { data } = get(); if (data) load(startLayout(data, mode), { mode }); },
    reset: () => { const { data, mode } = get(); if (data) load(startLayout(data, mode)); },
    loadBaseline: () => { const { data } = get(); if (data) load(baselineLayout(data.products)); },

    clickSlot: slot => {
      const { selected, submitted, mode, history, notify } = get();
      if (!test) return;
      if (submitted) return notify('Challenge submitted. Press Play again for a new round.');
      if (selected === null) return set({ selected: slot, preview: null });
      if (selected === slot) return set({ selected: null, preview: null });
      if (samePickPoint(selected, slot)) return notify('No change: same pick point');
      const problem = swapProblem(get().data!.products, test.productAt, selected, slot, rulesFor(get()));
      if (problem) return notify(problem);
      if (mode === 'challenge' && history.length >= CHALLENGE_SWAPS)
        return notify('No swaps left. Submit your layout or undo a swap.');
      swapSlots(selected, slot);
      set({ history: [...history, [selected, slot]] });
    },

    hoverSlot: (slot, x = 0, y = 0) => {
      const { selected, hover, preview, blocked, data } = get();
      if (slot === null) { if (hover || preview || blocked) set({ hover: null, preview: null, blocked: null }); return; }
      const next: Partial<State> = { hover: { slot, x, y } };
      const reason = selected !== null && slot !== selected && train && data
        ? swapProblem(data.products, train.productAt, selected, slot, rulesFor(get())) : null;
      if (reason) {
        if (blocked?.slot !== slot) Object.assign(next, { blocked: { slot, reason }, preview: null });
      } else if (selected !== null && slot !== selected && !samePickPoint(selected, slot) && train) {
        if (blocked) next.blocked = null;
        if (preview?.slot !== slot) {
          const delta = train.swapDelta(train.productAt[selected], train.productAt[slot]).delta;
          next.preview = { slot, delta };
        }
      } else if (preview || blocked) Object.assign(next, { preview: null, blocked: null });
      set(next);
    },

    undo: () => {
      const { history, submitted } = get();
      if (!history.length || submitted) return;
      const [a, b] = history[history.length - 1];
      swapSlots(a, b);
      set({ history: history.slice(0, -1) });
    },

    submit: () => { if (get().history.length) set({ submitted: true, selected: null, preview: null }); },

    notify: text => {
      const id = Date.now();
      set({ toast: { text, id } });
      setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 2200);
    },

    setRackColor: rackColor => set({ rackColor }),
    setShowIcons: showIcons => set({ showIcons }),
    resetVisits: () => set({ visits: noVisits() }),
    recordPick: slot => set(s => { const visits = [...s.visits]; visits[slot]++; return { visits }; }),

    saveResult: name => {
      const { submitted, savedRound, yours, ref, history, assign, notify } = get();
      if (!submitted || savedRound || !yours || !ref) return;
      if (get().whatIf) return notify('What-if results are not saved to the leaderboard.');
      const total = yours.test.totalDist;
      const { board, saved } = addEntry({
        id: `${Date.now()}`, name: name.trim().slice(0, 24) || 'Anonymous', total,
        vsBaseline: total / ref.test.baseline.totalDist - 1, swaps: history.length,
        at: new Date().toISOString(), assign: [...assign],
      });
      set({ board, savedRound: true });
      get().openPanel('board');
      if (!saved) notify('Leaderboard storage is unavailable in this browser; kept for this visit only.');
    },

    // Open a saved layout in Sandbox, where every score is shown live
    loadLayout: assign => { if (get().data) load(assign, { mode: 'sandbox', boardOpen: false }); },
    setBoardOpen: boardOpen => get().openPanel(boardOpen ? 'board' : null),
    openPanel: panel => set(s => ({
      boardOpen: panel === 'board', batchOpen: panel === 'batch', newItemOpen: panel === 'newItem',
      ai: { ...s.ai, open: panel === 'ai' },
    })),

    // Load the what-if world (new item in, slowest product to reserve) in Sandbox with the chosen slot
    placeNewItem: (plan, option) => {
      const { data, realData } = get();
      if (!data) return;
      const real = realData ?? data;
      const products = real.products;
      set(s => ({
        realData: real, mode: 'sandbox', ai: { ...s.ai, result: null, status: 'idle' },
        whatIf: { name: plan.name, symbol: plan.symbol, retired: products[plan.retire].name, slot: plan.options[option].slot },
      }));
      get().init(plan.world);
      load(plan.options[option].assign, { mode: 'sandbox' });
    },
    exitWhatIf: () => {
      const { realData } = get();
      if (!realData) return;
      set(s => ({ realData: null, whatIf: null, ai: { ...s.ai, result: null, status: 'idle' } }));
      get().init(realData);
    },
    setBatch: patch => set(s => ({ batch: { ...s.batch, ...patch }, replayKey: s.replayBatches ? s.replayKey + 1 : s.replayKey })),
    setReplayBatches: replayBatches => set(s => ({ replayBatches, replayKey: s.replayKey + 1, playing: true })),
    // Changing the rules starts a fresh round, so a result is always played under one rule set
    setAbcZones: abcZones => { set(s => ({ abcZones, ai: { ...s.ai, result: null, status: 'idle' } })); get().reset(); },

    // AI Suggest: starts from the Baseline, learns on the train weeks only, obeys the current rules.
    // Runs in a Web Worker in the browser; synchronously where workers do not exist (tests).
    runAI: () => {
      const { data, ai } = get();
      if (!data || ai.status === 'running') return;
      const abcZones = rulesFor(get()).abcZones, plan = ai.plan;
      const request: WorkerRequest = {
        products: data.products, orders: data.orders.train, partners: partners5(data), start: baselineLayout(data.products),
        rules: { abcZones }, iterations: AI_ITERATIONS, budgetMs: AI_MAX_MS, movePenalty: AI_PLANS[plan].penalty, seed: Date.now() % 100000,
      };
      set({ ai: { ...ai, status: 'running', progress: 0, trainGain: 0 } });
      get().openPanel('ai');
      if (typeof Worker === 'undefined') return get().finishAI(optimize(request), plan, abcZones);
      worker?.terminate();
      worker = new Worker(new URL('./engine/optimizer.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m.type === 'progress')
          set(s => ({ ai: { ...s.ai, progress: m.progress.iterations / AI_ITERATIONS, trainGain: m.progress.best / m.progress.start - 1 } }));
        else { worker?.terminate(); worker = null; get().finishAI(m.result, plan, abcZones); }
      };
      worker.postMessage(request);
    },

    finishAI: (r, plan, abcZones) => {
      const { data } = get();
      if (!data) return;
      const eng = makeEngine(data.orders.train, r.assign);
      const result: AiResult = {
        assign: r.assign, train: eng.stats(), test: scoreLayout(data.orders.test, r.assign),
        moves: explainMoves(data.products, data.affinity, eng, baselineLayout(data.products)),
        iterations: r.iterations, plan, abcZones,
        trainDays: pickingDays(data.orders.train), testDays: pickingDays(data.orders.test),
      };
      set(s => ({ ai: { ...s.ai, status: 'done', progress: 1, result } }));
    },

    setAi: patch => set(s => ({ ai: { ...s.ai, ...patch } })),
    setAssumptions: patch => set(s => ({ assumptions: { ...s.assumptions, ...patch } })),

    setPlaying: playing => set({ playing }),
    setSpeed: speed => set({ speed }),
    restart: () => set(s => ({ replayKey: s.replayKey + 1, playing: true })),
  };
});
