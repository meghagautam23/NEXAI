// Module 3 — Slotting challenge state. assign[productId] = slotId.
//
// The player plans on history and is judged on the future, exactly like the optimiser: swap previews and the
// live planning score use the train weeks (1–21 Nov); the score is the unseen test week (22–30 Nov), which in
// Challenge stays hidden until the player submits. (Approach ported from Megha Gautam's branch.)
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { GameData } from '../../core/data';
import { partnersOf, samePickPoint } from '../../core/engine/layouts';
import { NO_RULES, swapProblem, type RuleOptions } from '../../core/engine/rules';
import { makeEngine, scoreLayout, type Engine, type Stats } from '../../core/engine/sim';
import { useReplay } from '../twin/replayStore';
import { DEFAULT_ASSUMPTIONS, explainMoves, pickingDays, type Assumptions, type Move } from './insights';
import { addScore, readScores, type HighScore } from './leaderboard';
import type { NewItemPlan } from './newItem';
import { optimize, type OptimizeResult } from './optimizer';
import type { WorkerMessage, WorkerRequest } from './optimizer.worker';
import { pointsFor, starsFor } from './scoring';

export type Mode = 'challenge' | 'sandbox';
export type View = 'menu' | 'play';
export type Panel = 'how' | 'scores' | null;
export type Side = 'ai' | 'newItem' | null;
export const MAX_SWAPS = 10;

// AI Suggest plans: train-week seconds charged per product moved (re-slotting effort)
export type AiPlan = 'max' | 'balanced' | 'few';
export const AI_PLANS: Record<AiPlan, { label: string; penalty: number }> = {
  max: { label: 'Max saving', penalty: 0 },
  balanced: { label: 'Balanced', penalty: 300 },
  few: { label: 'Fewer moves', penalty: 450 },
};
// A fixed number of swaps, so every run searches equally hard on any laptop; the time cap is a safety net
export const AI_ITERATIONS = 45000;
export const AI_MAX_MS = 15000;
export type AiResult = {
  assign: number[]; train: Stats; test: Stats; moves: Move[]; iterations: number;
  plan: AiPlan; abcZones: boolean; trainDays: number; testDays: number;
};
type AiState = { status: 'idle' | 'running' | 'done'; plan: AiPlan; progress: number; trainGain: number; result: AiResult | null };
type Ref = { original: Stats; baseline: Stats };

type State = {
  data: GameData | null;
  ref: { train: Ref; test: Ref } | null;
  view: View; panel: Panel; side: Side; mode: Mode;
  abcZones: boolean;                 // Challenge option: products stay in their velocity zone
  assign: number[]; at: number[];
  yours: { train: Stats; test: Stats } | null;
  history: [number, number][];       // swapped slot pairs, for undo
  submitted: boolean;                // Challenge: test-week result revealed
  savedScore: boolean;               // this result is already on the leaderboard
  selected: number | null; hovered: number | null;
  preview: number | null;            // train-week seconds if `selected` swaps with `hovered`
  blocked: string | null;            // why `selected` may not swap with `hovered`
  toast: { text: string; id: number } | null;
  feedback: { delta: number; id: number } | null;   // last swap (train-week seconds), for the pop-up
  scores: HighScore[];
  realData: GameData | null;         // the real data while a what-if (new product) copy is loaded
  whatIf: { name: string; retired: string; slot: number } | null;
  ai: AiState;
  assumptions: Assumptions;

  init: (data: GameData) => void;
  play: (m: Mode) => void;
  openMenu: () => void;
  setPanel: (p: Panel) => void;
  setSide: (s: Side) => void;
  setMode: (m: Mode) => void;
  reset: () => void;
  loadBaseline: () => void;
  loadLayout: (assign: readonly number[]) => void;
  clickSlot: (s: number) => void;
  hoverSlot: (s: number | null) => void;
  deselect: () => void;
  undo: () => void;
  submit: () => void;
  saveScore: (name: string) => void;
  setAbcZones: (on: boolean) => void;
  runAI: () => void;
  setAiPlan: (plan: AiPlan) => void;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  placeNewItem: (plan: NewItemPlan, option: number) => void;
  exitWhatIf: () => void;
  showToast: (text: string) => void;
};

// Engines are mutable and hot, so they live outside React state
let train: Engine | null = null, test: Engine | null = null;
let worker: Worker | null = null;
let toastId = 0;

const rulesFor = (s: Pick<State, 'mode' | 'abcZones'>): RuleOptions => (s.mode === 'challenge' && s.abcZones ? { abcZones: true } : NO_RULES);
const startLayout = (d: GameData, m: Mode) => (m === 'challenge' ? d.baselineAssign : d.originalAssign);

export const useGame = create<State>((set, get) => {
  // Rebuild both engines from a layout and publish everything derived from them
  const load = (assign: readonly number[], extra: Partial<State> = {}) => {
    const { data } = get();
    if (!data) return;
    train = makeEngine(data.orders.train, assign, data.pick);
    test = makeEngine(data.orders.test, assign, data.pick);
    set({
      assign: [...test.assign], at: [...test.productAt], yours: { train: train.stats(), test: test.stats() },
      history: [], submitted: false, savedScore: false, selected: null, hovered: null, preview: null, blocked: null,
      feedback: null, ...extra,
    });
    useReplay.getState().reset();
  };

  // Swap the products in two slots on both engines; returns the train-week change in seconds
  const swapSlots = (a: number, b: number) => {
    const pa = test!.productAt[a], pb = test!.productAt[b];
    const delta = train!.swapDelta(pa, pb).delta;
    train!.swap(pa, pb); test!.swap(pa, pb);
    set({
      assign: [...test!.assign], at: [...test!.productAt], yours: { train: train!.stats(), test: test!.stats() },
      selected: null, preview: null, blocked: null,
    });
    return delta;
  };

  return {
    data: null, ref: null, view: 'menu', panel: null, side: null, mode: 'challenge', abcZones: false,
    assign: [], at: [], yours: null, history: [], submitted: false, savedScore: false,
    selected: null, hovered: null, preview: null, blocked: null, toast: null, feedback: null,
    scores: readScores(), realData: null, whatIf: null,
    ai: { status: 'idle', plan: 'balanced', progress: 0, trainGain: 0, result: null },
    assumptions: DEFAULT_ASSUMPTIONS,

    init: data => {
      if (get().data === data) return;
      const s = (orders: GameData['orders']['test'], a: number[]) => scoreLayout(orders, a, data.pick);
      set({
        data,
        ref: {
          train: { original: s(data.orders.train, data.originalAssign), baseline: s(data.orders.train, data.baselineAssign) },
          test: { original: s(data.orders.test, data.originalAssign), baseline: s(data.orders.test, data.baselineAssign) },
        },
      });
      load(startLayout(data, get().mode));
    },

    play: mode => { set({ view: 'play', panel: null }); get().setMode(mode); },
    openMenu: () => { set({ view: 'menu', panel: null, side: null, selected: null, preview: null }); useReplay.getState().reset(); },
    setPanel: panel => set({ panel }),
    setSide: side => set({ side }),
    setMode: mode => { const { data } = get(); if (data) load(startLayout(data, mode), { mode }); },
    reset: () => { const { data, mode } = get(); if (data) load(startLayout(data, mode)); },
    loadBaseline: () => { const { data } = get(); if (data) load(data.baselineAssign); },
    // Open a layout (AI or leaderboard) in Sandbox, where every score is shown live
    loadLayout: assign => { set({ view: 'play', panel: null }); load(assign, { mode: 'sandbox' }); },

    clickSlot: slot => {
      const { selected, submitted, mode, history, data, showToast } = get();
      if (!test || !data) return;
      if (submitted) return showToast('Challenge submitted. Press Play again for a new round.');
      if (selected === null) return set({ selected: slot, preview: null });
      if (selected === slot) return set({ selected: null, preview: null, blocked: null });
      if (samePickPoint(selected, slot)) {
        showToast('Same pick point: no change, no swap used.');
        return set({ selected: null, preview: null });
      }
      const problem = swapProblem(data.products, test.productAt, selected, slot, rulesFor(get()));
      if (problem) return showToast(problem);
      if (mode === 'challenge' && history.length >= MAX_SWAPS) return showToast('No swaps left. Submit, or undo a swap (Ctrl+Z).');
      const delta = swapSlots(selected, slot);
      set({ history: [...history, [selected, slot]], feedback: { delta, id: ++toastId } });
    },

    hoverSlot: slot => {
      const { selected, data } = get();
      let preview: number | null = null, blocked: string | null = null;
      if (slot !== null && selected !== null && slot !== selected && train && data && !samePickPoint(selected, slot)) {
        blocked = swapProblem(data.products, train.productAt, selected, slot, rulesFor(get()));
        if (!blocked) preview = train.swapDelta(train.productAt[selected], train.productAt[slot]).delta;
      }
      set({ hovered: slot, preview, blocked });
    },
    deselect: () => set({ selected: null, preview: null, blocked: null }),

    undo: () => {
      const { history, submitted } = get();
      if (!history.length || submitted) return;
      const [a, b] = history[history.length - 1];
      const delta = swapSlots(a, b);
      set({ history: history.slice(0, -1), feedback: { delta, id: ++toastId } });
    },

    submit: () => {
      if (!get().history.length) return;
      set({ submitted: true, selected: null, preview: null });
      useReplay.setState({ playing: false });
    },

    saveScore: name => {
      const { submitted, savedScore, yours, ref, history, assign, whatIf } = get();
      if (!submitted || savedScore || !yours || !ref || whatIf) return;
      const saved = ref.test.baseline.totalTime - yours.test.totalTime;
      const scores = addScore({
        name: name.trim().slice(0, 14) || 'Player', points: pointsFor(saved), stars: starsFor(saved),
        at: new Date().toISOString(), swaps: history.length, assign: [...assign],
      });
      set({ scores, savedScore: true });
    },

    // Changing the rules starts a fresh round, so a result is always played under one rule set
    setAbcZones: abcZones => { set(s => ({ abcZones, ai: { ...s.ai, result: null, status: 'idle' } })); get().reset(); },

    // AI Suggest: starts from the Baseline, learns on the train weeks only, obeys the current rules.
    // Runs in a Web Worker in the browser; synchronously where workers do not exist (tests).
    runAI: () => {
      const { data, ai } = get();
      if (!data || ai.status === 'running') return;
      const rules = rulesFor(get()), plan = ai.plan;
      const request: WorkerRequest = {
        products: data.products, orders: data.orders.train, pick: data.pick, partners: partnersOf(data.affinity, 5),
        start: data.baselineAssign, rules, iterations: AI_ITERATIONS, budgetMs: AI_MAX_MS,
        movePenalty: AI_PLANS[plan].penalty, seed: Date.now() % 100000,
      };
      set({ ai: { ...ai, status: 'running', progress: 0, trainGain: 0 }, side: 'ai' });
      const finish = (r: OptimizeResult) => {
        const eng = makeEngine(data.orders.train, r.assign, data.pick);
        set(s => ({ ai: { ...s.ai, status: 'done', progress: 1, result: {
          assign: r.assign, train: eng.stats(), test: scoreLayout(data.orders.test, r.assign, data.pick),
          moves: explainMoves(data.products, data.affinity, eng, data.baselineAssign), iterations: r.iterations,
          plan, abcZones: rules.abcZones, trainDays: pickingDays(data.orders.train), testDays: pickingDays(data.orders.test),
        } } }));
      };
      if (typeof Worker === 'undefined') return finish(optimize(request));
      worker?.terminate();
      worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m.type === 'progress')
          set(s => ({ ai: { ...s.ai, progress: m.progress.iterations / AI_ITERATIONS, trainGain: m.progress.best / m.progress.start - 1 } }));
        else { worker?.terminate(); worker = null; finish(m.result); }
      };
      worker.postMessage(request);
    },
    setAiPlan: plan => set(s => ({ ai: { ...s.ai, plan } })),
    setAssumptions: patch => set(s => ({ assumptions: { ...s.assumptions, ...patch } })),

    // Load the what-if copy (new product in, slowest mover to reserve) in Sandbox with the chosen slot
    placeNewItem: (plan, option) => {
      const { data, realData } = get();
      if (!data) return;
      const real = realData ?? data;
      set(s => ({
        realData: real, mode: 'sandbox', ai: { ...s.ai, result: null, status: 'idle' },
        whatIf: { name: plan.name, retired: real.products[plan.retire].name, slot: plan.options[option].slot },
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

    showToast: text => {
      const id = ++toastId;
      set({ toast: { text, id } });
      setTimeout(() => get().toast?.id === id && set({ toast: null }), 2600);
    },
  };
});

/** Seconds saved vs the mode's starting layout: on the train weeks (planning) and the test week (score) */
export function useSaved() {
  return useGame(useShallow(s => {
    const start = s.mode === 'challenge' ? 'baseline' : 'original';
    if (!s.ref || !s.yours) return { planning: 0, score: 0 };
    return {
      planning: s.ref.train[start].totalTime - s.yours.train.totalTime,
      score: s.ref.test[start].totalTime - s.yours.test.totalTime,
    };
  }));
}

/** Whether the test-week result may be shown (always in Sandbox; after Submit in Challenge) */
export const useRevealed = () => useGame(s => s.mode === 'sandbox' || s.submitted);

// Dev-only handle for debugging in the browser console
if (import.meta.env.DEV) (globalThis as { game?: typeof useGame }).game = useGame;
