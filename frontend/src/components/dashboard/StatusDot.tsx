interface Props {
  status: string
  pulse?: boolean
}

function dotClass(status: string): string {
  switch (status) {
    case 'running':
    case 'online':
      return 'bg-hud-green'
    case 'stopped':
    case 'offline':
      return 'bg-hud-red'
    case 'paused':
    case 'suspended':
      return 'bg-hud-yellow'
    default:
      return 'bg-hud-muted'
  }
}

export function StatusDot({ status, pulse = false }: Props) {
  return (
    <span
      className={`status-dot ${dotClass(status)} ${pulse && status === 'running' ? 'animate-pulse_slow' : ''}`}
      title={status}
    />
  )
}
