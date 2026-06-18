import type { CollectorResult, CloudflareState } from '../../types'
import { CollectorBadge } from '../layout/CollectorBadge'
import { StatusDot } from '../dashboard/StatusDot'

interface Props {
  result: CollectorResult<CloudflareState>
}

export function TunnelPanel({ result }: Props) {
  const tunnels = result.data?.tunnels ?? []
  const routes = result.data?.routes ?? []
  const metrics = result.data?.metrics

  return (
    <div className="hud-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-hud-blue font-semibold tracking-wider text-sm">☁ CLOUDFLARE TUNNEL</span>
        {metrics && metrics.active_streams > 0 && (
          <span className="text-hud-green text-xs">{metrics.active_streams} active streams</span>
        )}
      </div>

      <CollectorBadge available={result.available} error={result.error} label="Cloudflare" />

      {/* Tunnels */}
      <div className="flex flex-col gap-1">
        {tunnels.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-xs">
            <StatusDot status={t.status === 'active' ? 'running' : 'stopped'} pulse />
            <span className="text-hud-text font-medium">{t.name}</span>
            <span className={`hud-badge text-xs ml-auto ${t.status === 'active' ? 'bg-hud-green/10 text-hud-green border border-hud-green/30' : 'bg-hud-red/10 text-hud-red border border-hud-red/30'}`}>
              {t.status}
            </span>
            <span className="text-hud-muted">{t.connections} conn</span>
          </div>
        ))}
        {tunnels.length === 0 && result.available && (
          <p className="text-hud-muted text-xs text-center py-2">No tunnels found</p>
        )}
      </div>

      {/* Routes */}
      {routes.length > 0 && (
        <>
          <div className="border-t border-hud-border/60 pt-2">
            <p className="text-hud-muted text-xs mb-1.5">INGRESS ROUTES</p>
            <div className="flex flex-col gap-1">
              {routes.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-hud-green/70">{r.hostname}</span>
                  <span className="text-hud-muted">→</span>
                  <span className="text-hud-muted">{r.service}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
