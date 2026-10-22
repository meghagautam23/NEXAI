// Twin module: replay state for the picker (play/pause, speed, live counters, rack visits for the heatmap).
// Reused by the game module so the player can replay the same orders on their layout.
import { create } from 'zustand';

export const SPEEDS = [1, 10, 50] as const;
export const COLOUR_BY = ['category', 'class', 'fl', 'picks', 'busy'] as const;
export type ColourBy = typeof COLOUR_BY[number];
export type Live = {
  order: number; orderId: string; lines: number; dist: number; time: number; done: boolean;
  totalDist: number; totalTime: number;   // across all orders replayed so far
  stop: number;                            // index of the current pick within the order, -1 while walking out
};

type ReplayState = {
  playing: boolean; speed: number; replayId: number; live: Live | null;
  colourBy: ColourBy; visits: number[];
  focus: number | null;                    // aisle the camera zooms to, null = whole floor
  togglePlay: () => void;
  restart: () => void;
  reset: () => void;
  setSpeed: (n: number) => void;
  setLive: (l: Live | null) => void;
  visit: (slot: number) => void;
  setColourBy: (c: ColourBy) => void;
  setFocus: (aisle: number | null) => void;
};

const blank = () => Array<number>(100).fill(0);

export const useReplay = create<ReplayState>((set, get) => ({
  playing: false, speed: 10, replayId: 0, live: null, colourBy: 'category', visits: blank(), focus: null,
  togglePlay: () => {
    const { playing, live } = get();
    if (!playing && live?.done) get().restart();
    else set({ playing: !playing });
  },
  restart: () => set({ replayId: get().replayId + 1, live: null, visits: blank(), playing: true }),
  reset: () => set({ replayId: get().replayId + 1, live: null, visits: blank(), playing: false, focus: null }),
  setSpeed: speed => set({ speed }),
  setLive: live => set({ live }),
  visit: slot => { const visits = [...get().visits]; visits[slot]++; set({ visits }); },
  setColourBy: colourBy => set({ colourBy }),
  setFocus: focus => set({ focus }),
}));
