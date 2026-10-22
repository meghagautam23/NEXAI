import { useEffect, useState } from 'react'
import { loadData } from './engine/data'
import { Scene } from './scene/Scene'
import { useStore } from './store'
import { Hud } from './ui/Hud'

function App() {
  const ready = useStore(s => s.data !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData().then(useStore.getState().init).catch(e => setError(String(e)))
  }, [])

  return (
    <div className="app">
      <Scene />
      {ready ? <Hud /> : <div className="loading">{error ?? 'Loading orders…'}</div>}
    </div>
  )
}

export default App
