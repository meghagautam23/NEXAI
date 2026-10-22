import { useEffect } from 'react';
import { useApp } from './core/appStore';
import { Home } from './Home';
import { DataModule } from './modules/data/DataModule';
import { GameModule } from './modules/game/GameModule';
import { TwinModule } from './modules/twin/TwinModule';

export default function App() {
  const { data, error, screen, load } = useApp();
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="center-msg">Couldn't load the order data: {error}. Check your connection and reload.</div>;
  if (!data) return <div className="center-msg">Unpacking the boxes…</div>;

  switch (screen) {
    case 'data': return <DataModule />;
    case 'twin': return <TwinModule />;
    case 'game': return <GameModule />;
    default: return <Home />;
  }
}
