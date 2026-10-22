// store.ts — app state shared by the 3D scene and the HUD (zustand)
import { create } from 'zustand';
import type { Data } from './engine/data';
import { baselineLayout, originalLayout } from './engine/layouts';
import { sampleOrders } from './engine/replay';
import { scoreLayout, type Stats } from './engine/sim';

export type LayoutName = 'original' | 'baseline';
export const SPEEDS = [1, 10, 50] as const;

// Live replay readout, pushed by the scene a few times per second
export type ReplayHud = { index: number; orderId: string; lines: number; dist: number; time: number; done: boolean };

type State = {
  data: Data | null;
  layout: LayoutName;
  assign: number[];
  testScore: Stats | null;    // all test-week orders under the current layout
  sample: number[];           // indices into data.orders.test replayed on screen
  playing: boolean;
  speed: number;
  replayKey: number;          // bump to restart the replay
  routeSlots: number[];       // slots of the order being walked, in visiting order
  picked: number;             // how many of routeSlots are already picked
  hud: ReplayHud;
  init: (data: Data) => void;
  setLayout: (layout: LayoutName) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  restart: () => void;
};

const emptyHud: ReplayHud = { index: 0, orderId: '', lines: 0, dist: 0, time: 0, done: false };

const layoutOf = (data: Data, layout: LayoutName) =>
  layout === 'baseline' ? baselineLayout(data.products) : originalLayout(data.products);

export const useStore = create<State>()((set, get) => ({
  data: null,
  layout: 'baseline',
  assign: [],
  testScore: null,
  sample: [],
  playing: true,
  speed: 10,
  replayKey: 0,
  routeSlots: [],
  picked: 0,
  hud: emptyHud,
  init: data => {
    const assign = layoutOf(data, get().layout);
    set({ data, assign, testScore: scoreLayout(data.orders.test, assign), sample: sampleOrders(data.orders.test) });
  },
  setLayout: layout => {
    const { data, replayKey } = get();
    if (!data) return;
    const assign = layoutOf(data, layout);
    set({ layout, assign, testScore: scoreLayout(data.orders.test, assign), replayKey: replayKey + 1, playing: true });
  },
  setPlaying: playing => set({ playing }),
  setSpeed: speed => set({ speed }),
  restart: () => set(s => ({ replayKey: s.replayKey + 1, playing: true })),
}));
