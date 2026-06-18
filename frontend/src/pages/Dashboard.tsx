import { useSnapshotStore } from '../store/snapshotStore'
import { NodeCard } from '../components/dashboard/NodeCard'
import { CollectorBadge } from '../components/layout/CollectorBadge'

export function Dashboard() {
  const snapshot = useSnapshotStore((s) => s.snapshot)

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-hud-muted text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-hud-blue border-t-transparent rounded-full animate-spin" />
          <span>Connecting to server...</span>
        </div>
      </div>
    )
  }

  const { nodes, docker_hosts } = snapshot

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <CollectorBadge available={nodes.available} error={nodes.error} label="Proxmox" />

      {nodes.data.length === 0 && nodes.available && (
        <p className="text-hud-muted text-sm text-center py-8">No nodes found</p>
      )}

      {nodes.data.map((node) => (
        <NodeCard
          key={node.node}
          node={node}
          dockerHosts={docker_hosts.data}
        />
      ))}
    </div>
  )
}
