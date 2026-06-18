import { useState } from 'react'
import type { LXCModel, VMModel, DockerHost } from '../../types'
import { StatusDot } from './StatusDot'
import { ResourceBar } from './ResourceBar'
import { ContainerTable } from '../docker/ContainerTable'

interface Props {
  guest: LXCModel | VMModel
  type: 'lxc' | 'vm'
  dockerHost?: DockerHost
}

function fmtUptime(s: number): string {
  if (!s) return '—'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function GuestRow({ guest, type, dockerHost }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = guest.status === 'running'
  const hasDocker = dockerHost?.available && (dockerHost?.containers.length ?? 0) > 0

  return (
    <div className="border-b border-hud-border/50 last:border-0">
      <div
        className={`flex items-center gap-3 px-3 py-2 text-xs hover:bg-white/5 cursor-pointer transition-colors ${expanded ? 'bg-white/5' : ''}`}
        onClick={() => hasDocker && setExpanded(!expanded)}
      >
        <StatusDot status={guest.status} pulse />
        <span className="w-5 text-hud-muted text-center">{type === 'lxc' ? 'LX' : 'VM'}</span>
        <span className="text-hud-muted tabular-nums w-12">{guest.vmid}</span>
        <span className={`flex-1 truncate ${isRunning ? 'text-hud-text' : 'text-hud-muted'}`}>
          {guest.name}
        </span>

        {isRunning ? (
          <div className="flex items-center gap-4 w-52">
            <ResourceBar value={guest.cpu} label="CPU" />
            <ResourceBar value={guest.mem} max={guest.maxmem} label="RAM" />
          </div>
        ) : (
          <span className="text-hud-muted text-xs w-52 text-right">{guest.status.toUpperCase()}</span>
        )}

        <span className="text-hud-muted w-8 text-right">{isRunning ? fmtUptime(guest.uptime) : '—'}</span>

        {hasDocker && (
          <span className="text-hud-blue/70 text-xs w-16 text-right">
            {dockerHost!.containers.filter(c => c.state === 'running').length}⬡
            {expanded ? ' ▲' : ' ▼'}
          </span>
        )}
        {!hasDocker && <span className="w-16" />}
      </div>

      {expanded && dockerHost && (
        <div className="border-t border-hud-blue/20 bg-hud-bg/50 px-3 py-2 animate-fade-in">
          <ContainerTable containers={dockerHost.containers} compact />
        </div>
      )}
    </div>
  )
}
