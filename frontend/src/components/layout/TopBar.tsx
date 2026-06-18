import { useSnapshotStore } from '../../store/snapshotStore'

export function TopBar() {
  const { lastUpdated, connected, snapshot } = useSnapshotStore()

  const fmt = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--'

  const nodeCount = snapshot?.nodes.data.length ?? 0
  const lxcCount = snapshot?.nodes.data.reduce((a, n) => a + n.lxc.length, 0) ?? 0
  const vmCount = snapshot?.nodes.data.reduce((a, n) => a + n.vms.length, 0) ?? 0
  const containerCount = snapshot?.docker_hosts.data.reduce((a, h) => a + h.containers.filter(c => c.state === 'running').length, 0) ?? 0

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-hud-border bg-hud-card">
      <div className="flex items-center gap-3">
        <span className="text-hud-blue text-lg font-semibold tracking-widest uppercase">
          ◈ SERVER HUD
        </span>
        <span className="text-hud-muted text-xs">
          {nodeCount}N · {lxcCount}LXC · {vmCount}VM · {containerCount} containers
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-hud-muted">
        <span>{fmt}</span>
        <span className={`flex items-center gap-1.5 ${connected ? 'text-hud-green' : 'text-hud-red'}`}>
          <span className={`status-dot ${connected ? 'bg-hud-green animate-pulse' : 'bg-hud-red'}`} />
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
      </div>
    </header>
  )
}
