import type { ReactNode } from 'react';

// Floating card that follows the pointer over the 3D scene
export function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="tooltip" style={{ left: Math.min(x + 16, window.innerWidth - 260), top: y + 16 }}>{children}</div>
  );
}
