import { useState } from 'react'
import type { NodeModel, DockerHost, LXCModel, VMModel } from '../../types'
import { StatusDot } from './StatusDot'
import { ResourceBar } from './ResourceBar'
import { CollectorBadge } from '../layout/CollectorBadge'
import { useSnapshotStore } from '../../store/snapshotStore'

function fmtMem(b: number): string {
  if (!b) return '0MB'
  const gb = b / 1073741824
  if (gb >= 1) return `${gb.toFixed(1)}GB`
  return `${Math.round(b / 1048576)}MB`
}

function fmtUptime(s: number): string {
  if (!s) return '—'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function truncateImage(image: string) {
  const name = image.split('/').pop()?.split(':')[0] ?? image
  const tag = image.includes(':') ? image.split(':').pop() : 'latest'
  return `${name}:${tag}`
}

interface GuestTreeRowProps {
  guest: LXCModel | VMModel
  type: 'lxc' | 'vm'
  isLast: boolean
  dockerHost?: DockerHost
}

function GuestTreeRow({ guest, type, isLast, dockerHost }: GuestTreeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = guest.status === 'running'
  const containers = dockerHost?.available ? dockerHost.containers : []
  const hasContainers = containers.length > 0

  return (
    <div className="relative">
      <div
        className={`flex items-start gap-1.5 py-1 group cursor-pointer select-none`}
        onClick={() => hasContainers && setExpanded(!expanded)}
      >
        <span className="text-hud-border/50 font-mono text-xs mt-0.5 flex-shrink-0 w-6">
          {isLast ? '└─' : '├─'}
        </span>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <StatusDot status={guest.status} pulse />
            <span className={`font-medium text-sm ${isRunning ? 'text-hud-text' : 'text-hud-muted'}`}>
              {guest.name}
            </span>
            <span className="text-hud-muted/60 text-xs">
              {type.toUpperCase()} {guest.vmid}
            </span>
          </div>

          {isRunning ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-hud-muted">
                CPU <span className="text-hud-green">{Math.round(guest.cpu * 100)}%</span>
              </span>
              <span className="text-hud-muted">
                RAM <span className="text-hud-blue">{fmtMem(guest.mem)}/{fmtMem(guest.maxmem)}</span>
              </span>
              <span className="text-hud-muted/60">{fmtUptime(guest.uptime)}</span>
            </div>
          ) : (
            <span className="text-hud-red/70 text-xs">{guest.status.toUpperCase()}</span>
          )}

          {hasContainers && (
            <span className="text-hud-blue/50 text-xs ml-auto">
              {containers.filter(c => c.state === 'running').length}/{containers.length} containers
              {expanded ? ' ▲' : ' ▼'}
            </span>
          )}
        </div>
      </div>

      {/* Docker containers subtree */}
      {expanded && containers.length > 0 && (
        <div className={`ml-6 ${isLast ? '' : 'border-l border-hud-border/30'} pl-0`}>
          {containers.map((c, ci) => {
            const isLastContainer = ci === containers.length - 1
            return (
              <div key={c.id} className="flex items-center gap-1.5 py-0.5">
                <span className="text-hud-border/30 font-mono text-xs flex-shrink-0 w-6">
                  {isLastContainer ? '└─' : '├─'}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-xs min-w-0">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={c.state} />
                    <span className={c.state === 'running' ? 'text-hud-text' : 'text-hud-muted'}>
                      {c.name}
                    </span>
                  </div>
                  <span className="text-hud-muted/60">{truncateImage(c.image)}</span>
                  <span className={`hud-badge px-1.5 py-0 text-xs ${
                    c.state === 'running'
                      ? 'bg-hud-green/10 text-hud-green border border-hud-green/30'
                      : 'bg-hud-muted/10 text-hud-muted border border-hud-border'
                  }`}>
                    {c.state}
                  </span>
                  {c.uptime && <span className="text-hud-muted/60">{c.uptime}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface NodeTreeProps {
  node: NodeModel
  dockerHosts: DockerHost[]
}

function NodeTree({ node, dockerHosts }: NodeTreeProps) {
  const guests: Array<{ guest: LXCModel | VMModel; type: 'lxc' | 'vm' }> = [
    ...node.lxc.map(g => ({ guest: g, type: 'lxc' as const })),
    ...node.vms.map(g => ({ guest: g, type: 'vm' as const })),
  ].sort((a, b) => {
    if (a.guest.status !== b.guest.status) return a.guest.status === 'running' ? -1 : 1
    return a.guest.name.localeCompare(b.guest.name)
  })

  function findHost(vmid: number) {
    return dockerHosts.find(h => h.proxmox_vmid === vmid)
  }

  return (
    <div className="hud-card animate-fade-in">
      {/* Node header */}
      <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-hud-border/60">
        <div className="flex items-center gap-2">
          <StatusDot status={node.status} />
          <span className="text-hud-blue font-semibold tracking-wider text-sm uppercase">
            {node.node}
          </span>
          <span className="text-hud-muted/60 text-xs">Proxmox Node</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-hud-muted">
          <span>CPU <span className="text-hud-green">{Math.round(node.cpu * 100)}%</span></span>
          <span>RAM <span className="text-hud-blue">{fmtMem(node.mem)}/{fmtMem(node.maxmem)}</span></span>
          <span>{node.lxc.length} LXC · {node.vms.length} VMs</span>
        </div>
        {node.bridges.length > 0 && (
          <div className="flex gap-1.5 ml-auto">
            {node.bridges.filter(b => b.active).map(b => (
              <span key={b.name} className="hud-badge bg-hud-blue/10 text-hud-blue border border-hud-blue/20 text-xs">
                {b.name}{b.address ? ` ${b.address}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Guests tree */}
      {guests.length === 0 ? (
        <p className="text-hud-muted text-xs py-2">No LXC or VMs found</p>
      ) : (
        <div className="border-l border-hud-border/40 ml-1 pl-1">
          {guests.map(({ guest, type }, idx) => (
            <GuestTreeRow
              key={`${type}-${guest.vmid}`}
              guest={guest}
              type={type}
              isLast={idx === guests.length - 1}
              dockerHost={findHost(guest.vmid)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TreeDashboard() {
  const snapshot = useSnapshotStore(s => s.snapshot)

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-hud-muted text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-hud-blue border-t-transparent rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      </div>
    )
  }

  const { nodes, docker_hosts } = snapshot

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <CollectorBadge available={nodes.available} error={nodes.error} label="Proxmox" />
      <CollectorBadge available={docker_hosts.available} error={docker_hosts.error} label="Docker" />

      {nodes.data.length === 0 && nodes.available && (
        <p className="text-hud-muted text-sm text-center py-8">No nodes found</p>
      )}

      {nodes.data.map(node => (
        <NodeTree key={node.node} node={node} dockerHosts={docker_hosts.data} />
      ))}
    </div>
  )
}
