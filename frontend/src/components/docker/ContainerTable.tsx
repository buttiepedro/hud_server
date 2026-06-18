import type { DockerContainer } from '../../types'
import { StatusDot } from '../dashboard/StatusDot'

interface Props {
  containers: DockerContainer[]
  compact?: boolean
}

function truncateImage(image: string) {
  const tag = image.split(':')[1] ?? 'latest'
  const name = image.split('/').pop()?.split(':')[0] ?? image
  return `${name}:${tag}`
}

export function ContainerTable({ containers, compact = false }: Props) {
  if (containers.length === 0) {
    return <p className="text-hud-muted text-xs py-2 text-center">No containers</p>
  }

  const sorted = [...containers].sort((a, b) => {
    if (a.state === b.state) return a.name.localeCompare(b.name)
    return a.state === 'running' ? -1 : 1
  })

  return (
    <div className={`overflow-x-auto ${compact ? 'text-xs' : 'text-sm'}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-hud-muted border-b border-hud-border/60">
            <th className="text-left py-1 pr-3 font-normal w-2" />
            <th className="text-left py-1 pr-3 font-normal">NAME</th>
            {!compact && <th className="text-left py-1 pr-3 font-normal">IMAGE</th>}
            <th className="text-left py-1 pr-3 font-normal">STATUS</th>
            <th className="text-left py-1 pr-3 font-normal">UPTIME</th>
            {!compact && <th className="text-left py-1 pr-3 font-normal">PORTS</th>}
            {!compact && <th className="text-left py-1 font-normal">NETWORK</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-hud-border/30 last:border-0 hover:bg-white/5">
              <td className="py-1.5 pr-3">
                <StatusDot status={c.state} />
              </td>
              <td className="py-1.5 pr-3 text-hud-text font-medium">{c.name}</td>
              {!compact && (
                <td className="py-1.5 pr-3 text-hud-muted">{truncateImage(c.image)}</td>
              )}
              <td className="py-1.5 pr-3">
                <span
                  className={`hud-badge text-xs ${
                    c.state === 'running'
                      ? 'bg-hud-green/10 text-hud-green border border-hud-green/30'
                      : 'bg-hud-muted/10 text-hud-muted border border-hud-border'
                  }`}
                >
                  {c.state}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-hud-muted tabular-nums">{c.uptime ?? '—'}</td>
              {!compact && (
                <td className="py-1.5 pr-3 text-hud-muted">
                  {c.ports.map((p) => `${p.host_port ?? '*'}:${p.container_port}/${p.protocol}`).join(', ') || '—'}
                </td>
              )}
              {!compact && (
                <td className="py-1.5 text-hud-blue/70">
                  {c.networks.join(', ') || '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
