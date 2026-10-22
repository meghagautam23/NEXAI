import { useEffect, useState } from 'react'
import { loadData } from './engine/data'
import { Scene } from './scene/Scene'
import { useStore } from './store'
import { Hud } from './ui/Hud'
import { ResultCard, Toast, Tooltip } from './ui/Overlays'
import { AiCard } from './ui/AiCard'
import { BatchPanel } from './ui/BatchPanel'
import { Leaderboard } from './ui/Leaderboard'
import { Scoreboard } from './ui/Scoreboard'

function App() {
  const ready = useStore(s => s.data !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData().then(useStore.getState().init).catch(e => setError(String(e)))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useStore.setState({ selected: null, preview: null })
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') useStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Scene />
      {ready ? (
        <>
          <Hud />
          <Scoreboard />
          <Tooltip />
          <Toast />
          <ResultCard />
          <AiCard />
          <BatchPanel />
          <Leaderboard />
        </>
      ) : <div className="loading">{error ?? 'Loading orders…'}</div>}
    </div>
  )
}

export default App
