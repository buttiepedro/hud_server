import { useState } from 'react'
import { useSnapshotStore } from '../store/snapshotStore'
import { ContainerTable } from '../components/docker/ContainerTable'
import { CollectorBadge } from '../components/layout/CollectorBadge'

export function Containers() {
  const snapshot = useSnapshotStore((s) => s.snapshot)
  const [filterHost, setFilterHost] = useState<string>('all')
  const [filterState, setFilterState] = useState<string>('all')

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-hud-muted text-sm">
        <div className="w-8 h-8 border-2 border-hud-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { docker_hosts } = snapshot
  const availableHosts = docker_hosts.data.filter((h) => h.available)
  const filteredHosts = filterHost === 'all' ? availableHosts : availableHosts.filter((h) => h.host_id === filterHost)

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <CollectorBadge available={docker_hosts.available} error={docker_hosts.error} label="Docker" />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="bg-hud-card border border-hud-border rounded px-2 py-1 text-xs text-hud-text"
          value={filterHost}
          onChange={(e) => setFilterHost(e.target.value)}
        >
          <option value="all">All hosts</option>
          {availableHosts.map((h) => (
            <option key={h.host_id} value={h.host_id}>
              {h.proxmox_name ?? h.ip} ({h.ip})
            </option>
          ))}
        </select>

        <select
          className="bg-hud-card border border-hud-border rounded px-2 py-1 text-xs text-hud-text"
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
        >
          <option value="all">All states</option>
          <option value="running">Running</option>
          <option value="exited">Exited</option>
          <option value="paused">Paused</option>
        </select>

        <span className="text-hud-muted text-xs ml-auto">
          {filteredHosts.reduce((a, h) => a + h.containers.length, 0)} containers
        </span>
      </div>

      {filteredHosts.length === 0 ? (
        <p className="text-hud-muted text-sm text-center py-8">
          {docker_hosts.available ? 'No Docker hosts reachable' : 'Docker collection unavailable'}
        </p>
      ) : (
        filteredHosts.map((host) => {
          const containers = filterState === 'all'
            ? host.containers
            : host.containers.filter((c) => c.state === filterState)

          return (
            <div key={host.host_id} className="hud-card flex flex-col gap-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-hud-blue font-semibold text-sm tracking-wider">
                  ⬡ {host.proxmox_name ?? host.ip}
                </span>
                <div className="flex items-center gap-3 text-xs text-hud-muted">
                  <span>{host.ip}</span>
                  {host.docker_version && <span>Docker {host.docker_version}</span>}
                  <span>{host.containers.filter(c => c.state === 'running').length}/{host.containers.length} running</span>
                </div>
              </div>
              <ContainerTable containers={containers} />
            </div>
          )
        })
      )}
    </div>
  )
}
