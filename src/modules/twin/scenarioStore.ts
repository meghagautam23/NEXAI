// Twin module: which scenario the replay shows, on which reference layout, and the peak-shift playback
import { create } from 'zustand';
import { DEFAULT_BATCH, type BatchOptions } from '../../core/engine/batching';
import { DEFAULT_SHIFT, type ShiftOptions, type ShiftResult } from '../../core/engine/shift';
import type { Order } from '../../core/engine/types';

export type Scenario = 'orders' | 'batch' | 'shift';
export type RefLayout = 'original' | 'baseline';
export type ShiftSettings = { days: number; pickers: number; cart: number; cutoffHour: number; congestion: boolean };
export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = { days: 3, pickers: 3, cart: 1, cutoffHour: 17, congestion: true };
export const shiftOptions = (s: ShiftSettings): ShiftOptions =>
  ({ ...DEFAULT_SHIFT, pickers: s.pickers, cart: s.cart, cutoff: s.cutoffHour * 3600, congestion: s.congestion });
export const SHIFT_SPEEDS = [120, 300, 900] as const;

type State = {
  scenario: Scenario; layout: RefLayout; batch: BatchOptions;
  shift: {
    settings: ShiftSettings; orders: Order[] | null; result: ShiftResult | null;
    free: { onTime: number; lastDone: number } | null;   // the same shift without congestion, for comparison
    clock: number; end: number; playing: boolean; speed: number;
  };
  setScenario: (s: Scenario) => void;
  setLayout: (l: RefLayout) => void;
  setBatch: (patch: Partial<BatchOptions>) => void;
  setShiftSettings: (patch: Partial<ShiftSettings>) => void;
  setShift: (patch: Partial<State['shift']>) => void;
};

export const useScenario = create<State>((set) => ({
  scenario: 'orders', layout: 'original', batch: DEFAULT_BATCH,
  shift: { settings: DEFAULT_SHIFT_SETTINGS, orders: null, result: null, free: null, clock: 0, end: 0, playing: false, speed: 300 },
  setScenario: scenario => set({ scenario }),
  setLayout: layout => set(s => ({ layout, shift: { ...s.shift, result: null, playing: false } })),
  setBatch: patch => set(s => ({ batch: { ...s.batch, ...patch } })),
  setShiftSettings: patch => set(s => ({ shift: { ...s.shift, settings: { ...s.shift.settings, ...patch }, result: null, playing: false } })),
  setShift: patch => set(s => ({ shift: { ...s.shift, ...patch } })),
}));

/** Hi-vis colour per picker in the peak shift */
export const PICKER_COLOURS = ['#f2b705', '#3a57c9', '#c73e2b', '#23875a', '#8a5cc2', '#1f9aa8'];
