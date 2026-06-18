import type { NodeModel, DockerHost } from '../../types'
import { StatusDot } from './StatusDot'
import { ResourceBar } from './ResourceBar'
import { GuestRow } from './GuestRow'

interface Props {
  node: NodeModel
  dockerHosts: DockerHost[]
}

function findDockerHost(dockerHosts: DockerHost[], vmid: number | null): DockerHost | undefined {
  if (!vmid) return undefined
  return dockerHosts.find((h) => h.proxmox_vmid === vmid)
}

export function NodeCard({ node, dockerHosts }: Props) {
  const allGuests = [
    ...node.lxc.map((g) => ({ guest: g, type: 'lxc' as const })),
    ...node.vms.map((g) => ({ guest: g, type: 'vm' as const })),
  ].sort((a, b) => {
    if (a.guest.status === b.guest.status) return a.guest.name.localeCompare(b.guest.name)
    return a.guest.status === 'running' ? -1 : 1
  })

  return (
    <div className="hud-card flex flex-col gap-3 animate-fade-in">
      {/* Node header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={node.status} />
          <span className="text-hud-blue font-semibold tracking-wider uppercase text-sm">
            NODE: {node.node}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-hud-muted">
          <span>{node.lxc.length} LXC</span>
          <span>{node.vms.length} VM</span>
          <span>{node.bridges.length} bridges</span>
        </div>
      </div>

      {/* Node resources */}
      <div className="flex flex-col gap-1.5 px-1">
        <ResourceBar value={node.cpu} label="CPU" />
        <ResourceBar value={node.mem} max={node.maxmem} label="RAM" />
      </div>

      {/* Bridges */}
      {node.bridges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.bridges.map((b) => (
            <span
              key={b.name}
              className={`hud-badge text-xs ${b.active ? 'bg-hud-blue/10 text-hud-blue border border-hud-blue/30' : 'bg-hud-muted/10 text-hud-muted border border-hud-border'}`}
            >
              {b.name}
              {b.address && <span className="opacity-60 ml-1">{b.address}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Guest list */}
      {allGuests.length > 0 ? (
        <div className="border border-hud-border/60 rounded overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-hud-border/20 text-hud-muted text-xs border-b border-hud-border/60">
            <span className="w-2" />
            <span className="w-5" />
            <span className="w-12">VMID</span>
            <span className="flex-1">NAME</span>
            <span className="w-52">RESOURCES</span>
            <span className="w-8 text-right">UP</span>
            <span className="w-16 text-right">CONTAINERS</span>
          </div>
          {allGuests.map(({ guest, type }) => (
            <GuestRow
              key={`${type}-${guest.vmid}`}
              guest={guest}
              type={type}
              dockerHost={findDockerHost(dockerHosts, guest.vmid)}
            />
          ))}
        </div>
      ) : (
        <p className="text-hud-muted text-xs text-center py-4">No LXC or VMs found</p>
      )}
    </div>
  )
}
