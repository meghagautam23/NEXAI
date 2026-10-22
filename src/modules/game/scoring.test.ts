import { describe, expect, it } from 'vitest';
import { duration, pointsFor, starsFor, swapVerdict } from './scoring';

describe('scoring', () => {
  it('gives 1 point per second saved', () => {
    expect(pointsFor(523.4)).toBe(523);
    expect(pointsFor(-80.6)).toBe(-81);
  });
  it('awards stars at 0 / 1,500 / 4,000 seconds saved', () => {
    expect(starsFor(-10)).toBe(0);
    expect(starsFor(0)).toBe(0);
    expect(starsFor(1)).toBe(1);
    expect(starsFor(1499)).toBe(1);
    expect(starsFor(1500)).toBe(2);
    expect(starsFor(4000)).toBe(3);
  });
  it('labels swaps by how much time they save', () => {
    expect(swapVerdict(-400).tone).toBe('great');
    expect(swapVerdict(-20).tone).toBe('good');
    expect(swapVerdict(0).tone).toBe('meh');
    expect(swapVerdict(40).tone).toBe('oops');
  });
  it('formats saved time for the end screen', () => {
    expect(duration(6480)).toBe('1 h 48 min');
    expect(duration(600)).toBe('10 min');
  });
});
