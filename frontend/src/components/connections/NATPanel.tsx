import type { CollectorResult, NATRule } from '../../types'
import { CollectorBadge } from '../layout/CollectorBadge'

interface Props {
  result: CollectorResult<NATRule[]>
}

export function NATPanel({ result }: Props) {
  const rules = result.data ?? []
  const meaningful = rules.filter(
    (r) => (r.target !== 'ACCEPT' && r.chain !== 'PREROUTING') || r.source || r.destination,
  )

  return (
    <div className="hud-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-hud-blue font-semibold tracking-wider text-sm">⇄ NAT RULES</span>
        <span className="text-hud-muted text-xs">{rules.length} rules</span>
      </div>

      <CollectorBadge available={result.available} error={result.error} label="NAT" />

      {meaningful.length === 0 ? (
        <p className="text-hud-muted text-xs text-center py-4">
          {result.available ? 'No notable NAT rules' : 'NAT inspection unavailable'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-hud-muted border-b border-hud-border/60">
                <th className="text-left py-1 pr-3 font-normal">CHAIN</th>
                <th className="text-left py-1 pr-3 font-normal">PROTO</th>
                <th className="text-left py-1 pr-3 font-normal">SOURCE</th>
                <th className="text-left py-1 pr-3 font-normal">DEST</th>
                <th className="text-left py-1 font-normal">TARGET</th>
              </tr>
            </thead>
            <tbody>
              {meaningful.map((r, i) => (
                <tr key={i} className="border-b border-hud-border/30 last:border-0 hover:bg-white/5">
                  <td className="py-1.5 pr-3 text-hud-yellow">{r.chain}</td>
                  <td className="py-1.5 pr-3 text-hud-muted">{r.protocol ?? 'all'}</td>
                  <td className="py-1.5 pr-3 text-hud-muted">{r.source ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-hud-muted">{r.destination ?? '—'}</td>
                  <td className="py-1.5 text-hud-green">{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
