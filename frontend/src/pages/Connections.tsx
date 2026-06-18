import { useSnapshotStore } from '../store/snapshotStore'
import { TraefikPanel } from '../components/connections/TraefikPanel'
import { TunnelPanel } from '../components/connections/TunnelPanel'
import { NATPanel } from '../components/connections/NATPanel'

export function Connections() {
  const snapshot = useSnapshotStore((s) => s.snapshot)

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-hud-muted text-sm">
        <div className="w-8 h-8 border-2 border-hud-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <TunnelPanel result={snapshot.cloudflare} />
      <TraefikPanel result={snapshot.traefik} />
      <NATPanel result={snapshot.nat_rules} />
    </div>
  )
}
