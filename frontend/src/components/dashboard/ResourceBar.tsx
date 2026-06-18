interface Props {
  value: number
  max?: number
  label: string
}

function pct(v: number, m: number) {
  if (!m) return 0
  return Math.min(100, Math.round((v / m) * 100))
}

function fmtBytes(b: number): string {
  if (b === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
}

function barColor(p: number): string {
  if (p >= 90) return 'bg-hud-red'
  if (p >= 75) return 'bg-hud-yellow'
  return 'bg-hud-green'
}

export function ResourceBar({ value, max, label }: Props) {
  const p = max !== undefined ? pct(value, max) : Math.round(value * 100)
  const color = barColor(p)
  const displayText = max !== undefined
    ? `${fmtBytes(value)}/${fmtBytes(max)}`
    : `${p}%`

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-hud-muted">{label}</span>
      <div className="resource-bar-bg flex-1">
        <div className={`resource-bar-fill ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-20 text-right text-hud-muted tabular-nums">{displayText}</span>
    </div>
  )
}

