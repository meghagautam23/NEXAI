// store.ts — game state shared by the 3D scene and the UI (zustand)
//
// The player plans on history and is judged on the future, exactly like the optimizer:
// swap previews use the train weeks (1–21 Nov); the score is the unseen test week (22–30 Nov).
// In Challenge mode the test-week result stays hidden until the player submits.
import { create } from 'zustand';
import { partnersOf, type Data } from './engine/data';
import { baselineLayout, originalLayout, samePickPoint } from './engine/layouts';
import { sampleOrders } from './engine/replay';
import { makeEngine, scoreLayout, type Engine, type Stats } from './engine/sim';
import { addEntry, readBoard, type Entry } from './leaderboard';
import { swapProblem } from './engine/rules';

export type Mode = 'challenge' | 'sandbox';
export type RackColor = 'popularity' | 'visits' | 'velocity' | 'cost' | 'weight';
export const CHALLENGE_SWAPS = 10;
export const SPEEDS = [1, 10, 50] as const;

// Live replay readout, pushed by the scene a few times per second
export type ReplayHud = { index: number; orderId: string; lines: number; dist: number; time: number; done: boolean };
type Ref = { original: Stats; baseline: Stats };

type State = {
  data: Data | null;
  partners: number[][];        // top-3 bought-together partners per product
  ref: { train: Ref; test: Ref } | null;

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
  visits: number[];            // picks per slot during the current replay (heatmap)
  board: Entry[];              // leaderboard, this browser only
  boardOpen: boolean;
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
  resetVisits: () => void;
  recordPick: (slot: number) => void;
  saveResult: (name: string) => void;
  loadLayout: (assign: number[]) => void;
  setBoardOpen: (open: boolean) => void;
  setAbcZones: (on: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  restart: () => void;
};

// Engines are mutable and hot, so they live outside React state
let train: Engine | null = null, test: Engine | null = null;

// Heavy items always stay in the front bays; ABC zones apply only in Challenge when switched on
const rulesFor = (s: Pick<State, 'mode' | 'abcZones'>) => ({ abcZones: s.mode === 'challenge' && s.abcZones });

const noVisits = () => Array<number>(100).fill(0);
const emptyHud: ReplayHud = { index: 0, orderId: '', lines: 0, dist: 0, time: 0, done: false };
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
    data: null, partners: [], ref: null,
    mode: 'challenge', assign: [], productAt: [], yours: null, history: [], submitted: false, abcZones: false,
    selected: null, hover: null, preview: null, blocked: null, toast: null,
    rackColor: 'popularity', visits: noVisits(), board: readBoard(), boardOpen: false, savedRound: false,
    sample: [], playing: true, speed: 10, replayKey: 0, routeSlots: [], picked: 0, hud: emptyHud,

    init: data => {
      const o = originalLayout(data.products), b = baselineLayout(data.products);
      const ref = {
        train: { original: scoreLayout(data.orders.train, o), baseline: scoreLayout(data.orders.train, b) },
        test: { original: scoreLayout(data.orders.test, o), baseline: scoreLayout(data.orders.test, b) },
      };
      set({ data, ref, partners: partnersOf(data.affinity, 3), sample: sampleOrders(data.orders.test) });
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
    resetVisits: () => set({ visits: noVisits() }),
    recordPick: slot => set(s => { const visits = [...s.visits]; visits[slot]++; return { visits }; }),

    saveResult: name => {
      const { submitted, savedRound, yours, ref, history, assign, notify } = get();
      if (!submitted || savedRound || !yours || !ref) return;
      const total = yours.test.totalDist;
      const { board, saved } = addEntry({
        id: `${Date.now()}`, name: name.trim().slice(0, 24) || 'Anonymous', total,
        vsBaseline: total / ref.test.baseline.totalDist - 1, swaps: history.length,
        at: new Date().toISOString(), assign: [...assign],
      });
      set({ board, savedRound: true, boardOpen: true });
      if (!saved) notify('Leaderboard storage is unavailable in this browser; kept for this visit only.');
    },

    // Open a saved layout in Sandbox, where every score is shown live
    loadLayout: assign => { if (get().data) load(assign, { mode: 'sandbox', boardOpen: false }); },
    setBoardOpen: boardOpen => set({ boardOpen }),
    // Changing the rules starts a fresh round, so a result is always played under one rule set
    setAbcZones: abcZones => { set({ abcZones }); get().reset(); },

    setPlaying: playing => set({ playing }),
    setSpeed: speed => set({ speed }),
    restart: () => set(s => ({ replayKey: s.replayKey + 1, playing: true })),
  };
});
