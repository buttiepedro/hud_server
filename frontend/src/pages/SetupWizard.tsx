import { useState, useCallback, useEffect } from 'react'
import { useToken } from '../hooks/useToken'

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 'proxmox' | 'ssh' | 'integrations' | 'token' | 'applying'

interface DiscoveredHost {
  vmid: number
  name: string
  type: 'lxc' | 'vm'
  node: string
  ip: string | null
}

interface InjectResult {
  vmid: number
  name: string
  success: boolean
  error?: string
  manual_command?: string
}

interface Config {
  proxmox_host: string
  proxmox_user: string
  proxmox_token_name: string
  proxmox_token_value: string
  proxmox_verify_ssl: boolean
  docker_ssh_extra_hosts: string
  traefik_api_url: string
  traefik_api_user: string
  traefik_api_password: string
  cloudflare_api_token: string
  cloudflare_account_id: string
  cloudflare_tunnel_name: string
  cloudflared_metrics_url: string
  nat_ssh_host: string
  nat_ssh_user: string
  hud_api_token: string
  allowed_origins: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function randomToken() {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

function api(path: string, body?: unknown, token?: string) {
  return fetch(`/api/setup/${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-HUD-Token': token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(r => r.json())
}

// ── Shared UI atoms ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-hud-muted mb-1 font-mono uppercase tracking-wider">{children}</label>
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-hud-bg border border-hud-border rounded px-3 py-2 text-sm font-mono text-hud-text
        placeholder:text-hud-muted/50 focus:outline-none focus:border-hud-blue transition-colors ${className}`}
    />
  )
}

function Btn({
  children, onClick, disabled, variant = 'primary', className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
}) {
  const base = 'px-4 py-2 rounded text-sm font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-hud-blue/20 border border-hud-blue text-hud-blue hover:bg-hud-blue/30',
    ghost: 'border border-hud-border text-hud-muted hover:text-hud-text hover:border-hud-text/40',
    danger: 'bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${ok ? 'text-hud-green border-hud-green/40 bg-hud-green/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function StepHeader({ step, current }: { step: number; current: number }) {
  const steps = ['Proxmox', 'SSH', 'Integrations', 'Token', 'Apply']
  return (
    <div className="flex gap-0 mb-8">
      {steps.map((s, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors
              ${active ? 'text-hud-blue border border-hud-blue bg-hud-blue/10' : done ? 'text-hud-green' : 'text-hud-muted'}`}>
              <span>{done ? '✓' : idx}</span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < steps.length - 1 && <span className="text-hud-border mx-1">›</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Proxmox ────────────────────────────────────────────────────────

function StepProxmox({
  config, onChange, onNext,
}: {
  config: Config
  onChange: (patch: Partial<Config>) => void
  onNext: (hosts: DiscoveredHost[]) => void
}) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [hosts, setHosts] = useState<DiscoveredHost[]>([])

  const test = useCallback(async () => {
    setTesting(true)
    setResult(null)
    const res = await api('test-proxmox', {
      host: config.proxmox_host,
      user: config.proxmox_user,
      token_name: config.proxmox_token_name,
      token_value: config.proxmox_token_value,
      verify_ssl: config.proxmox_verify_ssl,
    })
    setTesting(false)
    setResult({ success: res.success, error: res.error })
    if (res.success) setHosts(res.hosts ?? [])
  }, [config])

  return (
    <div className="space-y-4">
      <div>
        <Label>Proxmox Host / IP</Label>
        <Input value={config.proxmox_host} onChange={e => onChange({ proxmox_host: e.target.value })} placeholder="10.10.10.10" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>User</Label>
          <Input value={config.proxmox_user} onChange={e => onChange({ proxmox_user: e.target.value })} placeholder="root@pam" />
        </div>
        <div>
          <Label>Token Name</Label>
          <Input value={config.proxmox_token_name} onChange={e => onChange({ proxmox_token_name: e.target.value })} placeholder="hud" />
        </div>
      </div>
      <div>
        <Label>Token Value</Label>
        <Input
          type="password"
          value={config.proxmox_token_value}
          onChange={e => onChange({ proxmox_token_value: e.target.value })}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
        <p className="text-xs text-hud-muted mt-1">
          Datacenter → Permissions → API Tokens → Add (role: Administrator)
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-hud-muted cursor-pointer">
        <input
          type="checkbox"
          checked={config.proxmox_verify_ssl}
          onChange={e => onChange({ proxmox_verify_ssl: e.target.checked })}
          className="accent-hud-blue"
        />
        Verify SSL certificate
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Btn onClick={test} disabled={testing || !config.proxmox_host || !config.proxmox_token_value}>
          {testing ? 'Testing…' : 'Test Connection'}
        </Btn>
        {result && <StatusBadge ok={result.success} label={result.success ? `${hosts.length} guests found` : result.error ?? 'Failed'} />}
      </div>

      {hosts.length > 0 && (
        <div className="mt-2 p-3 bg-hud-bg rounded border border-hud-border text-xs font-mono max-h-40 overflow-y-auto space-y-1">
          {hosts.map(h => (
            <div key={h.vmid} className="flex gap-3 text-hud-muted">
              <span className={h.type === 'lxc' ? 'text-hud-blue' : 'text-hud-green'}>{h.type.toUpperCase()}</span>
              <span className="text-hud-text">{h.name}</span>
              <span>{h.ip ?? 'no IP'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Btn onClick={() => onNext(hosts)} disabled={!result?.success}>Next →</Btn>
      </div>
    </div>
  )
}

// ── Step 2: SSH ────────────────────────────────────────────────────────────

function StepSSH({
  config, hosts, onNext, onBack,
}: {
  config: Config
  hosts: DiscoveredHost[]
  onNext: () => void
  onBack: () => void
}) {
  const [pubKey, setPubKey] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set(hosts.map(h => h.vmid)))
  const [injecting, setInjecting] = useState(false)
  const [results, setResults] = useState<InjectResult[]>([])

  useEffect(() => {
    api('ssh-key').then(d => { if (d.public_key) setPubKey(d.public_key) })
  }, [])

  const generate = async () => {
    setGenerating(true)
    const res = await api('generate-ssh-key', {})
    setGenerating(false)
    if (res.success) setPubKey(res.public_key)
  }

  const inject = async () => {
    if (!pubKey) return
    setInjecting(true)
    const targets = hosts.filter(h => selected.has(h.vmid))
    const res = await api('inject-ssh-key', {
      proxmox_creds: {
        host: config.proxmox_host,
        user: config.proxmox_user,
        token_name: config.proxmox_token_name,
        token_value: config.proxmox_token_value,
        verify_ssl: config.proxmox_verify_ssl,
      },
      targets,
    })
    setInjecting(false)
    setResults(res.results ?? [])
  }

  const toggleAll = () => {
    if (selected.size === hosts.length) setSelected(new Set())
    else setSelected(new Set(hosts.map(h => h.vmid)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Btn onClick={generate} disabled={generating}>{generating ? 'Generating…' : pubKey ? '↺ Regenerate Key' : 'Generate SSH Key'}</Btn>
        {pubKey && <StatusBadge ok label="Key ready" />}
      </div>

      {pubKey && (
        <div>
          <Label>Public Key (copy this to authorize manually)</Label>
          <div className="relative">
            <pre className="text-xs font-mono bg-hud-bg border border-hud-border rounded p-3 break-all whitespace-pre-wrap text-hud-muted">{pubKey}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(pubKey)}
              className="absolute top-2 right-2 text-xs text-hud-blue hover:text-hud-blue/70 font-mono"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Inject into hosts</Label>
          <button onClick={toggleAll} className="text-xs text-hud-blue font-mono hover:underline">
            {selected.size === hosts.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {hosts.map(h => {
            const res = results.find(r => r.vmid === h.vmid)
            return (
              <label key={h.vmid} className="flex items-center gap-3 px-3 py-2 rounded border border-hud-border/50 cursor-pointer hover:border-hud-border text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(h.vmid)}
                  onChange={e => {
                    const s = new Set(selected)
                    e.target.checked ? s.add(h.vmid) : s.delete(h.vmid)
                    setSelected(s)
                  }}
                  className="accent-hud-blue"
                />
                <span className={`text-xs font-mono ${h.type === 'lxc' ? 'text-hud-blue' : 'text-hud-green'}`}>{h.type.toUpperCase()}</span>
                <span className="font-mono text-hud-text flex-1">{h.name}</span>
                <span className="text-hud-muted text-xs">{h.ip ?? '—'}</span>
                {res && (
                  res.success
                    ? <span className="text-hud-green text-xs">✓</span>
                    : <span className="text-red-400 text-xs" title={res.manual_command ?? res.error}>✗ manual</span>
                )}
              </label>
            )
          })}
        </div>
      </div>

      {results.some(r => !r.success) && (
        <div className="space-y-2">
          {results.filter(r => !r.success).map(r => (
            <div key={r.vmid} className="text-xs font-mono bg-hud-bg border border-red-500/30 rounded p-3">
              <div className="text-red-400 mb-1">{r.name}: {r.error}</div>
              {r.manual_command && (
                <div className="flex items-center gap-2">
                  <code className="text-hud-muted break-all flex-1">{r.manual_command}</code>
                  <button onClick={() => navigator.clipboard.writeText(r.manual_command!)} className="text-hud-blue hover:underline shrink-0">Copy</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Btn variant="ghost" onClick={onBack}>← Back</Btn>
        <div className="flex gap-2">
          {pubKey && selected.size > 0 && (
            <Btn onClick={inject} disabled={injecting}>{injecting ? 'Injecting…' : 'Inject Key'}</Btn>
          )}
          <Btn onClick={onNext}>Next →</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Integrations ───────────────────────────────────────────────────

function IntegrationRow({
  title, children, testType, testBody, token,
}: {
  title: string
  children: React.ReactNode
  testType: string
  testBody: Record<string, unknown>
  token?: string
}) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; detail: string } | null>(null)

  const test = async () => {
    setTesting(true)
    const res = await api('test-integration', { type: testType, ...testBody }, token)
    setTesting(false)
    setResult(res)
  }

  return (
    <div className="border border-hud-border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-hud-text">{title}</span>
        <span className="text-xs text-hud-muted font-mono bg-hud-bg px-2 py-0.5 rounded border border-hud-border/50">optional</span>
      </div>
      {children}
      <div className="flex items-center gap-3">
        <Btn onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test'}</Btn>
        {result && <StatusBadge ok={result.success} label={result.detail} />}
      </div>
    </div>
  )
}

function StepIntegrations({
  config, onChange, onNext, onBack, token,
}: {
  config: Config
  onChange: (patch: Partial<Config>) => void
  onNext: () => void
  onBack: () => void
  token?: string
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-hud-muted font-mono">All integrations are optional. Skip any you don't use.</p>

      <IntegrationRow
        title="Traefik"
        testType="traefik"
        testBody={{ traefik_api_url: config.traefik_api_url, traefik_api_user: config.traefik_api_user, traefik_api_password: config.traefik_api_password }}
        token={token}
      >
        <div>
          <Label>API URL</Label>
          <Input value={config.traefik_api_url} onChange={e => onChange({ traefik_api_url: e.target.value })} placeholder="http://traefik:8080" />
        </div>
      </IntegrationRow>

      <IntegrationRow
        title="Cloudflare Tunnel"
        testType="cloudflare"
        testBody={{ cloudflare_api_token: config.cloudflare_api_token, cloudflare_account_id: config.cloudflare_account_id }}
        token={token}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>API Token</Label>
            <Input type="password" value={config.cloudflare_api_token} onChange={e => onChange({ cloudflare_api_token: e.target.value })} placeholder="CF API token" />
          </div>
          <div>
            <Label>Account ID</Label>
            <Input value={config.cloudflare_account_id} onChange={e => onChange({ cloudflare_account_id: e.target.value })} placeholder="Account ID" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tunnel Name (filter)</Label>
            <Input value={config.cloudflare_tunnel_name} onChange={e => onChange({ cloudflare_tunnel_name: e.target.value })} placeholder="traefik" />
          </div>
          <div>
            <Label>Cloudflared Metrics URL</Label>
            <Input value={config.cloudflared_metrics_url} onChange={e => onChange({ cloudflared_metrics_url: e.target.value })} placeholder="http://cloudflared:20241" />
          </div>
        </div>
      </IntegrationRow>

      <IntegrationRow
        title="NAT (SSH to Proxmox host)"
        testType="nat"
        testBody={{ nat_ssh_host: config.nat_ssh_host, nat_ssh_user: config.nat_ssh_user }}
        token={token}
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>SSH Host</Label>
            <Input value={config.nat_ssh_host} onChange={e => onChange({ nat_ssh_host: e.target.value })} placeholder="10.10.10.10" />
          </div>
          <div>
            <Label>SSH User</Label>
            <Input value={config.nat_ssh_user} onChange={e => onChange({ nat_ssh_user: e.target.value })} placeholder="root" />
          </div>
        </div>
      </IntegrationRow>

      <div>
        <Label>Extra Docker SSH Hosts (comma-separated IPs)</Label>
        <Input value={config.docker_ssh_extra_hosts} onChange={e => onChange({ docker_ssh_extra_hosts: e.target.value })} placeholder="10.10.10.30,10.10.10.40" />
      </div>

      <div className="flex justify-between pt-2">
        <Btn variant="ghost" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Next →</Btn>
      </div>
    </div>
  )
}

// ── Step 4: Token ──────────────────────────────────────────────────────────

function StepToken({
  config, onChange, onNext, onBack,
}: {
  config: Config
  onChange: (patch: Partial<Config>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>HUD API Token</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={config.hud_api_token}
            onChange={e => onChange({ hud_api_token: e.target.value })}
            placeholder="Your secret access token"
            className="flex-1"
          />
          <Btn onClick={() => onChange({ hud_api_token: randomToken() })}>Generate</Btn>
        </div>
        <p className="text-xs text-hud-muted mt-1">This token is required to access the dashboard. Keep it secret.</p>
      </div>

      <div>
        <Label>Allowed Origins (comma-separated)</Label>
        <Input
          value={config.allowed_origins}
          onChange={e => onChange({ allowed_origins: e.target.value })}
          placeholder="http://10.10.10.10:3000,https://hud.yourdomain.com"
        />
      </div>

      <div className="flex justify-between pt-2">
        <Btn variant="ghost" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!config.hud_api_token}>Save & Apply →</Btn>
      </div>
    </div>
  )
}

// ── Step 5: Applying ───────────────────────────────────────────────────────

function StepApplying({ config, onComplete }: { config: Config; onComplete?: () => void }) {
  const { saveToken } = useToken()
  const [phase, setPhase] = useState<'saving' | 'restarting' | 'ready' | 'error'>('saving')
  const [error, setError] = useState<string | null>(null)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        setPhase('saving')
        await api('save', config)
        setPhase('restarting')
        // Poll /api/health until it responds again
        await new Promise<void>((resolve, reject) => {
          let attempts = 0
          const poll = setInterval(async () => {
            attempts++
            if (attempts > 30) { clearInterval(poll); reject(new Error('Timeout waiting for restart')); return }
            try {
              const r = await fetch('/api/health', { signal: AbortSignal.timeout(2000) })
              if (r.ok) { clearInterval(poll); resolve() }
            } catch { /* still restarting */ }
          }, 2000)
        })
        setPhase('ready')
        saveToken(config.hud_api_token)
        setTimeout(() => onComplete?.(), 1500)
      } catch (e) {
        setPhase('error')
        setError(String(e))
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      {phase === 'saving' && (
        <>
          <div className="text-3xl">💾</div>
          <p className="font-mono text-hud-text">Saving configuration{dots}</p>
        </>
      )}
      {phase === 'restarting' && (
        <>
          <div className="w-8 h-8 border-2 border-hud-blue border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-hud-text">Restarting backend{dots}</p>
          <p className="text-xs text-hud-muted">This takes 5–10 seconds</p>
        </>
      )}
      {phase === 'ready' && (
        <>
          <div className="text-4xl">✓</div>
          <p className="font-mono text-hud-green">HUD is ready!</p>
          <p className="text-xs text-hud-muted">Redirecting to dashboard…</p>
        </>
      )}
      {phase === 'error' && (
        <>
          <div className="text-3xl">✗</div>
          <p className="font-mono text-red-400">Something went wrong</p>
          <p className="text-xs text-hud-muted">{error}</p>
        </>
      )}
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  proxmox_host: '',
  proxmox_user: 'root@pam',
  proxmox_token_name: 'hud',
  proxmox_token_value: '',
  proxmox_verify_ssl: false,
  docker_ssh_extra_hosts: '',
  traefik_api_url: '',
  traefik_api_user: '',
  traefik_api_password: '',
  cloudflare_api_token: '',
  cloudflare_account_id: '',
  cloudflare_tunnel_name: '',
  cloudflared_metrics_url: '',
  nat_ssh_host: '',
  nat_ssh_user: 'root',
  hud_api_token: randomToken(),
  allowed_origins: 'http://localhost:3000',
}

export function SetupWizard({ onComplete, reconfigure }: { onComplete?: () => void; reconfigure?: boolean }) {
  const { token } = useToken()
  const [step, setStep] = useState<Step>('proxmox')
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredHost[]>([])

  // In reconfigure mode, pre-load current status values
  useEffect(() => {
    if (reconfigure) {
      api('status', undefined, token ?? undefined).then(s => {
        if (s.proxmox_host) setConfig(c => ({ ...c, proxmox_host: s.proxmox_host }))
      }).catch(() => {})
    }
  }, [reconfigure, token])

  const patch = useCallback((p: Partial<Config>) => setConfig(c => ({ ...c, ...p })), [])

  const stepNum = { proxmox: 1, ssh: 2, integrations: 3, token: 4, applying: 5 }[step]

  return (
    <div className="min-h-screen bg-hud-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-mono text-hud-text tracking-wide">
            {reconfigure ? '⚙ Settings' : '◈ HUD Setup'}
          </h1>
          {!reconfigure && <p className="text-xs text-hud-muted mt-1 font-mono">Configure your server HUD in a few steps</p>}
        </div>

        <div className="bg-hud-card border border-hud-border rounded-lg p-6">
          {step !== 'applying' && <StepHeader step={stepNum} current={stepNum} />}

          {step === 'proxmox' && (
            <StepProxmox
              config={config}
              onChange={patch}
              onNext={hosts => { setDiscoveredHosts(hosts); setStep('ssh') }}
            />
          )}
          {step === 'ssh' && (
            <StepSSH
              config={config}
              hosts={discoveredHosts}
              onNext={() => setStep('integrations')}
              onBack={() => setStep('proxmox')}
            />
          )}
          {step === 'integrations' && (
            <StepIntegrations
              config={config}
              onChange={patch}
              onNext={() => setStep('token')}
              onBack={() => setStep('ssh')}
              token={token ?? undefined}
            />
          )}
          {step === 'token' && (
            <StepToken
              config={config}
              onChange={patch}
              onNext={() => setStep('applying')}
              onBack={() => setStep('integrations')}
            />
          )}
          {step === 'applying' && (
            <StepApplying config={config} onComplete={onComplete} />
          )}
        </div>
      </div>
    </div>
  )
}
