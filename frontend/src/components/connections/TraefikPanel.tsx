import type { CollectorResult, TraefikState } from '../../types'
import { CollectorBadge } from '../layout/CollectorBadge'

interface Props {
  result: CollectorResult<TraefikState>
}

export function TraefikPanel({ result }: Props) {
  const routers = result.data?.routers ?? []

  return (
    <div className="hud-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-hud-blue font-semibold tracking-wider text-sm">⌁ TRAEFIK</span>
        <span className="text-hud-muted text-xs">{routers.length} routers</span>
      </div>

      <CollectorBadge available={result.available} error={result.error} label="Traefik" />

      {routers.length === 0 ? (
        <p className="text-hud-muted text-xs text-center py-4">
          {result.available ? 'No routers configured' : 'Traefik unavailable'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-hud-muted border-b border-hud-border/60">
                <th className="text-left py-1 pr-3 font-normal">ROUTER</th>
                <th className="text-left py-1 pr-3 font-normal">RULE</th>
                <th className="text-left py-1 pr-3 font-normal">TLS</th>
                <th className="text-left py-1 font-normal">SERVICE</th>
              </tr>
            </thead>
            <tbody>
              {routers.map((r) => (
                <tr key={r.name} className="border-b border-hud-border/30 last:border-0 hover:bg-white/5">
                  <td className="py-1.5 pr-3 text-hud-text font-medium truncate max-w-[10rem]">{r.name}</td>
                  <td className="py-1.5 pr-3 text-hud-muted font-mono text-xs truncate max-w-[18rem]">{r.rule}</td>
                  <td className="py-1.5 pr-3">
                    {r.tls ? (
                      <span className="hud-badge bg-hud-green/10 text-hud-green border border-hud-green/30">TLS</span>
                    ) : (
                      <span className="hud-badge bg-hud-muted/10 text-hud-muted border border-hud-border">plain</span>
                    )}
                  </td>
                  <td className="py-1.5 text-hud-muted truncate max-w-[10rem]">{r.service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
