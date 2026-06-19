import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { TokenGate } from './components/layout/TokenGate'
import { Dashboard } from './pages/Dashboard'
import { Containers } from './pages/Containers'
import { Connections } from './pages/Connections'
import { TopologyMap } from './pages/TopologyMap'
import { SetupWizard } from './pages/SetupWizard'
import { useSSE } from './hooks/useSSE'
import { useToken } from './hooks/useToken'

function HUD({ token }: { token: string }) {
  useSSE(token)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/containers" element={<Containers />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/topology" element={<TopologyMap />} />
            <Route path="/settings" element={<SetupWizard reconfigure />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { token, saveToken } = useToken()
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(true)) // if check fails, assume configured
  }, [])

  if (configured === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-hud-bg">
        <span className="text-hud-muted font-mono text-sm animate-pulse">Connecting…</span>
      </div>
    )
  }

  if (!configured) {
    return <SetupWizard onComplete={() => setConfigured(true)} />
  }

  if (!token) {
    return <TokenGate onSubmit={saveToken} />
  }

  return <HUD token={token} />
}
