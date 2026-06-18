interface Props {
  available: boolean
  error: string | null
  label: string
}

export function CollectorBadge({ available, error, label }: Props) {
  if (available) return null
  return (
    <div className="hud-badge bg-hud-red/10 text-hud-red border border-hud-red/30 gap-1.5 mb-3">
      <span className="status-dot bg-hud-red" />
      {label}: {error ?? 'UNAVAILABLE'}
    </div>
  )
}
