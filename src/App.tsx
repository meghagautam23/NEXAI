import { useEffect, useState } from 'react'
import { loadData } from './engine/data'
import { Scene } from './scene/Scene'
import { useStore } from './store'
import { Drawer } from './ui/Drawer'
import { ResultCard, Toast, Tooltip } from './ui/Overlays'
import { PlayCard } from './ui/PlayCard'
import { ReplayBar } from './ui/ReplayBar'
import { Scoreboard } from './ui/Scoreboard'
import { TopBar } from './ui/TopBar'
import { Home } from './ui/Home'
import { DataPage } from './ui/DataPage'
import { RushClock } from './ui/RushClock'

function App() {
  const ready = useStore(s => s.data !== null)
  const rush = useStore(s => s.rush.active)
  const screen = useStore(s => s.screen)
  const drawerOpen = useStore(s => s.ai.open || s.batchOpen || s.boardOpen || s.newItemOpen || s.rushOpen)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData().then(useStore.getState().init).catch(e => setError(String(e)))
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') useStore.setState({ selected: null, preview: null, blocked: null })
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') useStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (screen === 'home') return error ? <div className="loading">{error}</div> : <Home />
  if (screen === 'data') return <DataPage />

  return (
    <div className={`app${drawerOpen ? ' drawer-open' : ''}`}>
      <div className="stage"><Scene /></div>
      {ready ? (
        <>
          <TopBar />
          <PlayCard />
          {!rush && <ReplayBar />}
          <RushClock />
          <Scoreboard />
          <Drawer />
          <Tooltip />
          <Toast />
          <ResultCard />
        </>
      ) : <div className="loading">{error ?? 'Loading orders…'}</div>}
    </div>
  )
}

export default App
