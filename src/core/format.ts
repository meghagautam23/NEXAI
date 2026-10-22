export const m = (d: number) => `${d.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m`;
export const m1 = (d: number) => `${d.toFixed(1)} m`;
export const pct = (f: number) => `${f > 0 ? '+' : f < 0 ? '−' : '±'}${Math.abs(f * 100).toFixed(1)}%`;
export const secs = (s: number) => {
  const mm = Math.floor(s / 60), ss = Math.round(s % 60);
  return mm ? `${mm}m ${ss.toString().padStart(2, '0')}s` : `${ss}s`;
};
export const signed = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(1)} m`;
