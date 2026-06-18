import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { TokenGate } from './components/layout/TokenGate'
import { Dashboard } from './pages/Dashboard'
import { Containers } from './pages/Containers'
import { Connections } from './pages/Connections'
import { TopologyMap } from './pages/TopologyMap'
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
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { token, saveToken } = useToken()

  if (!token) {
    return <TokenGate onSubmit={saveToken} />
  }

  return <HUD token={token} />
}
