export const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};

export const fmtM = (m: number, digits = 0) =>
  `${m.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })} m`;

export const fmtPct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)}%`;

export const fmtDelta = (m: number) => `${m > 0 ? '+' : m < 0 ? '−' : '±'}${Math.abs(m).toFixed(1)} m`;
