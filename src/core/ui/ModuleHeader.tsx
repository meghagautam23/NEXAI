import type { ReactNode } from 'react';
import { useApp } from '../appStore';

// Shared top bar: back to the three modules, module number and name, plus module-specific extras
export function ModuleHeader({ n, title, subtitle, children }: { n: 1 | 2 | 3; title: string; subtitle: string; children?: ReactNode }) {
  const go = useApp(s => s.go);
  return (
    <header className="topbar">
      <button className="menu-btn" onClick={() => go('home')}>All modules</button>
      <div className="title">
        <strong><span className={`mod-num m${n}`}>{n}</span>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {children}
    </header>
  );
}
