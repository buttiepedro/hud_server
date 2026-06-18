export interface CollectorResult<T> {
  available: boolean
  error: string | null
  data: T
}

// ── Proxmox ───────────────────────────────────────────────────────────────────

export interface BridgeInfo {
  name: string
  type: string
  address: string | null
  netmask: string | null
  active: boolean
  bridge_ports: string | null
}

export interface LXCModel {
  vmid: number
  name: string
  status: string
  cpu: number
  maxcpu: number
  mem: number
  maxmem: number
  disk: number
  maxdisk: number
  uptime: number
  ip: string | null
  tags: string | null
}

export interface VMModel {
  vmid: number
  name: string
  status: string
  cpu: number
  maxcpu: number
  mem: number
  maxmem: number
  disk: number
  maxdisk: number
  uptime: number
  ip: string | null
  tags: string | null
}

export interface NodeModel {
  node: string
  status: string
  cpu: number
  maxcpu: number
  mem: number
  maxmem: number
  uptime: number
  lxc: LXCModel[]
  vms: VMModel[]
  bridges: BridgeInfo[]
}

// ── Docker ────────────────────────────────────────────────────────────────────

export interface ContainerPort {
  host_port: number | null
  container_port: number
  protocol: string
}

export interface DockerNetwork {
  name: string
  driver: string
  subnet: string | null
  gateway: string | null
  internal: boolean
  container_count: number
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: number
  uptime: string | null
  ports: ContainerPort[]
  networks: string[]
  labels: Record<string, string>
}

export interface DockerHost {
  host_id: string
  ip: string
  ssh_user: string
  available: boolean
  error: string | null
  docker_version: string | null
  containers: DockerContainer[]
  networks: DockerNetwork[]
  proxmox_vmid: number | null
  proxmox_type: string | null
  proxmox_name: string | null
}

// ── Connections ───────────────────────────────────────────────────────────────

export interface TraefikRouter {
  name: string
  rule: string
  entrypoints: string[]
  service: string
  tls: boolean
  status: string
  provider: string | null
}

export interface TraefikService {
  name: string
  type: string
  servers: string[]
  status: string
}

export interface TraefikState {
  routers: TraefikRouter[]
  services: TraefikService[]
}

export interface CloudflareTunnel {
  id: string
  name: string
  status: string
  created_at: string | null
  connections: number
}

export interface CloudflareRoute {
  hostname: string
  service: string
  path: string | null
}

export interface CloudflareMetrics {
  active_streams: number
  total_requests: number
}

export interface CloudflareState {
  tunnels: CloudflareTunnel[]
  routes: CloudflareRoute[]
  metrics: CloudflareMetrics
}

export interface NATRule {
  chain: string
  protocol: string | null
  source: string | null
  destination: string | null
  target: string
  extra: string | null
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  timestamp: string
  nodes: CollectorResult<NodeModel[]>
  docker_hosts: CollectorResult<DockerHost[]>
  traefik: CollectorResult<TraefikState>
  cloudflare: CollectorResult<CloudflareState>
  nat_rules: CollectorResult<NATRule[]>
}
