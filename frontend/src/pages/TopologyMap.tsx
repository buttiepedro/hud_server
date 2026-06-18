import { useEffect } from 'react'
import ReactFlow, {
  type Node,
  type Edge,
  type NodeProps,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useSnapshotStore } from '../store/snapshotStore'
import type {
  DashboardSnapshot,
  LXCModel,
  VMModel,
  DockerHost,
  CloudflareTunnel,
} from '../types'

// ── Custom node components ─────────────────────────────────────────────────────

function NodeProxmox({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 px-4 py-3 min-w-[165px] shadow-lg">
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b' }} />
      <div className="text-yellow-400 text-[10px] font-bold tracking-widest mb-1">PROXMOX</div>
      <div className="text-white text-sm font-medium font-mono">{data.label}</div>
      <div className="text-slate-500 text-[11px] mt-1 font-mono">
        CPU {Math.round(data.cpu * 100)}% · RAM {data.ramPct}%
      </div>
    </div>
  )
}

function NodeGuest({ data }: NodeProps) {
  const isLXC = data.guestType === 'lxc'
  const running = data.status === 'running'
  return (
    <div className={`rounded-lg border px-3 py-2.5 min-w-[160px] shadow-lg ${
      isLXC ? 'border-sky-500/50 bg-sky-500/5' : 'border-violet-500/50 bg-violet-500/5'
    }`}>
      <Handle type="target" position={Position.Top} style={{ background: running ? '#22c55e' : '#ef4444' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569' }} />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${running ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className={`text-[10px] font-bold tracking-widest ${isLXC ? 'text-sky-400' : 'text-violet-400'}`}>
          {isLXC ? 'LXC' : 'VM'} {data.vmid}
        </span>
      </div>
      <div className="text-white text-sm font-medium font-mono truncate max-w-[145px]">{data.label}</div>
      {data.ip && (
        <div className="text-slate-500 text-[11px] mt-0.5 font-mono">{data.ip}</div>
      )}
      {!running && (
        <div className="text-red-400/70 text-[11px] mt-0.5">{data.status}</div>
      )}
    </div>
  )
}

function NodeContainer({ data }: NodeProps) {
  const running = data.state === 'running'
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-[155px] shadow-lg ${
      running ? 'border-green-500/40 bg-green-500/5' : 'border-slate-700/60 bg-slate-900/40'
    }`}>
      <Handle type="target" position={Position.Top} style={{ background: '#475569' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569' }} />
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-green-400' : 'bg-slate-500'}`} />
        <span className="text-[10px] font-bold tracking-widest text-slate-500">CONTAINER</span>
      </div>
      <div className="text-white text-xs font-medium font-mono truncate max-w-[135px]">{data.label}</div>
      <div className="text-slate-600 text-[11px] font-mono truncate max-w-[135px]">{data.image}</div>
    </div>
  )
}

function NodeCloudflare({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-orange-500/50 bg-orange-500/5 px-4 py-3 min-w-[165px] shadow-lg">
      <Handle type="target" position={Position.Top} style={{ background: '#f97316' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#f97316' }} />
      <div className="text-orange-400 text-[10px] font-bold tracking-widest mb-1">☁ CF TUNNEL</div>
      <div className="text-white text-sm font-medium font-mono truncate max-w-[145px]">{data.label}</div>
      <div className={`text-[11px] mt-0.5 font-mono ${data.status === 'healthy' ? 'text-green-400' : 'text-slate-500'}`}>
        {data.connections > 0 ? `${data.connections} conn` : data.status}
      </div>
    </div>
  )
}

function NodeInternet() {
  return (
    <div className="rounded-lg border border-slate-600/40 bg-slate-900/50 px-4 py-2.5 shadow-lg">
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569' }} />
      <div className="text-slate-400 text-[10px] font-bold tracking-widest">⬡ INTERNET</div>
    </div>
  )
}

const NODE_TYPES = {
  proxmoxNode: NodeProxmox,
  guestNode: NodeGuest,
  containerNode: NodeContainer,
  cfNode: NodeCloudflare,
  internetNode: NodeInternet,
}

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_W = 180
const COL_GAP = 55
const STEP = COL_W + COL_GAP

// ── Graph builder ──────────────────────────────────────────────────────────────

function edgeStyle(color: string, dashed = false, animated = false): Partial<Edge> {
  return {
    animated,
    style: {
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: dashed ? '5 4' : undefined,
    },
    labelStyle: { fill: color, fontSize: 9, fontFamily: 'monospace' },
    labelBgStyle: { fill: '#0a0e1a', fillOpacity: 0.85 },
    labelBgPadding: [3, 5] as [number, number],
    labelBgBorderRadius: 3,
  }
}

function buildGraph(snap: DashboardSnapshot): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  type GuestEntry = { guest: LXCModel | VMModel; guestType: 'lxc' | 'vm'; nodeName: string }
  const allGuests: GuestEntry[] = []
  for (const n of snap.nodes.data) {
    for (const l of n.lxc) allGuests.push({ guest: l, guestType: 'lxc', nodeName: n.node })
    for (const v of n.vms) allGuests.push({ guest: v, guestType: 'vm', nodeName: n.node })
  }

  const guestCount = Math.max(allGuests.length, 1)
  const totalGuestW = guestCount * STEP - COL_GAP
  const proxX = totalGuestW / 2 - COL_W / 2

  // Internet (top-right)
  const cfAreaX = totalGuestW + 180
  nodes.push({
    id: 'internet',
    type: 'internetNode',
    position: { x: cfAreaX + 20, y: 20 },
    data: {},
    draggable: true,
  })

  // Cloudflare tunnels
  const cfTunnels: CloudflareTunnel[] = snap.cloudflare.available
    ? (snap.cloudflare.data?.tunnels ?? [])
    : []

  cfTunnels.forEach((tunnel, i) => {
    const id = `cf-${tunnel.id}`
    nodes.push({
      id,
      type: 'cfNode',
      position: { x: cfAreaX, y: 110 + i * 150 },
      data: { label: tunnel.name, status: tunnel.status, connections: tunnel.connections },
      draggable: true,
    })
    edges.push({
      id: `e-internet-${id}`,
      source: 'internet',
      target: id,
      label: 'tunnel',
      ...edgeStyle('#f97316', false, true),
    })
  })

  // Proxmox nodes (centered over guests)
  for (const n of snap.nodes.data) {
    const pxId = `px-${n.node}`
    nodes.push({
      id: pxId,
      type: 'proxmoxNode',
      position: { x: proxX, y: 110 },
      data: {
        label: n.node,
        cpu: n.cpu,
        ramPct: n.maxmem ? Math.round((n.mem / n.maxmem) * 100) : 0,
      },
      draggable: true,
    })

    const nodeGuests = allGuests.filter(g => g.nodeName === n.node)
    nodeGuests.forEach(({ guest, guestType }, idx) => {
      const gId = `guest-${guest.vmid}`
      nodes.push({
        id: gId,
        type: 'guestNode',
        position: { x: idx * STEP, y: 300 },
        data: {
          label: guest.name,
          vmid: guest.vmid,
          status: guest.status,
          cpu: guest.cpu,
          ip: guest.ip,
          guestType,
        },
        draggable: true,
      })
      edges.push({
        id: `e-${pxId}-${gId}`,
        source: pxId,
        target: gId,
        type: 'smoothstep',
        label: 'vmbr0',
        ...edgeStyle('#1d4ed8'),
      })
    })
  }

  // Docker hosts → containers
  let traefikNodeId: string | null = null

  const activeHosts = snap.docker_hosts.data.filter(
    (h: DockerHost) => h.available && h.containers.length > 0,
  )

  for (const host of activeHosts) {
    const parentId = host.proxmox_vmid ? `guest-${host.proxmox_vmid}` : null
    const parentNode = nodes.find(n => n.id === parentId)
    const baseX = parentNode ? parentNode.position.x : 0
    const totalCW = host.containers.length * STEP - COL_GAP
    const startX = baseX + COL_W / 2 - totalCW / 2

    host.containers.forEach((c, ci) => {
      const cId = `docker-${host.host_id}-${c.id}`

      if (!traefikNodeId && (c.name === 'traefik' || c.image.startsWith('traefik'))) {
        traefikNodeId = cId
      }

      nodes.push({
        id: cId,
        type: 'containerNode',
        position: { x: startX + ci * STEP, y: 510 },
        data: { label: c.name, image: c.image, state: c.state },
        draggable: true,
      })

      if (parentId) {
        edges.push({
          id: `e-${parentId}-${cId}`,
          source: parentId,
          target: cId,
          type: 'smoothstep',
          ...edgeStyle('#22c55e', true),
        })
      }
    })

    // Docker network edges (containers sharing a custom network)
    const netMap = new Map<string, string[]>()
    for (const c of host.containers) {
      for (const net of c.networks) {
        if (['bridge', 'host', 'none'].includes(net)) continue
        if (!netMap.has(net)) netMap.set(net, [])
        netMap.get(net)!.push(`docker-${host.host_id}-${c.id}`)
      }
    }
    for (const [net, ids] of netMap) {
      if (ids.length < 2) continue
      for (let i = 0; i < ids.length - 1; i++) {
        edges.push({
          id: `e-net-${host.host_id}-${net}-${i}`,
          source: ids[i],
          target: ids[i + 1],
          type: 'straight',
          label: net,
          ...edgeStyle('#0ea5e9', true),
        })
      }
    }
  }

  // CF Tunnel → Traefik
  if (traefikNodeId && cfTunnels.length > 0) {
    edges.push({
      id: 'e-cf-traefik',
      source: `cf-${cfTunnels[0].id}`,
      target: traefikNodeId,
      label: 'routes',
      ...edgeStyle('#f97316', false, true),
    })
  }

  return { nodes, edges }
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: '#f59e0b', label: 'Proxmox node' },
    { color: '#0ea5e9', label: 'LXC container' },
    { color: '#a855f7', label: 'Virtual Machine' },
    { color: '#22c55e', label: 'Docker container' },
    { color: '#f97316', label: 'Cloudflare Tunnel' },
    { color: '#1d4ed8', label: 'Bridge (vmbr0)' },
    { color: '#0ea5e9', label: 'Docker network', dashed: true },
  ]
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-700/60 rounded-lg px-3 py-2.5 shadow-xl">
      <div className="text-slate-500 text-[10px] font-bold tracking-widest mb-2">LEGEND</div>
      <div className="flex flex-col gap-1">
        {items.map(({ color, label, dashed }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-6 h-px flex-shrink-0"
              style={{
                background: color,
                borderTop: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
              }}
            />
            <span className="text-[11px] text-slate-400 font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function TopologyMap() {
  const snapshot = useSnapshotStore(s => s.snapshot)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!snapshot) return
    const { nodes: n, edges: e } = buildGraph(snapshot)
    setNodes(n)
    setEdges(e)
  }, [snapshot?.timestamp, setNodes, setEdges])

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2" />
        Building topology...
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e3a5f" gap={22} size={1} />
        <Controls
          showInteractive={false}
          style={{
            background: '#111827',
            border: '1px solid #1e3a5f',
            borderRadius: '8px',
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'proxmoxNode') return '#f59e0b'
            if (n.type === 'guestNode') return n.data.guestType === 'lxc' ? '#0ea5e9' : '#a855f7'
            if (n.type === 'containerNode') return n.data.state === 'running' ? '#22c55e' : '#475569'
            if (n.type === 'cfNode') return '#f97316'
            return '#334155'
          }}
          maskColor="rgba(10,14,26,0.75)"
          style={{
            background: '#0a0e1a',
            border: '1px solid #1e3a5f',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
      <Legend />
    </div>
  )
}
