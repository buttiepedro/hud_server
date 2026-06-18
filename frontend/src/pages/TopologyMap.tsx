import { useEffect, useRef, useCallback } from 'react'
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

const NODE_W = 180   // node card width
const COL_GAP = 60   // gap between sibling columns
const STEP = NODE_W + COL_GAP

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

/**
 * Layout algorithm:
 * Each guest column is wide enough to fit all its Docker containers side-by-side.
 * Guest nodes are centered within their column.
 * Proxmox node is centered over the span of its guests.
 * CF Tunnel panel sits to the right.
 */
function buildGraph(snap: DashboardSnapshot): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  type GuestEntry = { guest: LXCModel | VMModel; guestType: 'lxc' | 'vm'; nodeName: string }

  // Build Docker host lookup
  const hostByVmid = new Map<number, DockerHost>()
  for (const h of snap.docker_hosts.data) {
    if (h.available && h.proxmox_vmid != null) {
      hostByVmid.set(h.proxmox_vmid, h)
    }
  }

  // Collect all guests in order
  const allGuests: GuestEntry[] = []
  for (const n of snap.nodes.data) {
    for (const l of n.lxc) allGuests.push({ guest: l, guestType: 'lxc', nodeName: n.node })
    for (const v of n.vms) allGuests.push({ guest: v, guestType: 'vm', nodeName: n.node })
  }

  // Assign each guest a column: wide enough to not overlap its containers
  type GuestCol = GuestEntry & { colX: number; colW: number; containerCount: number }
  const guestCols: GuestCol[] = []
  let curX = 0

  for (const entry of allGuests) {
    const host = hostByVmid.get(entry.guest.vmid)
    const n = host ? host.containers.length : 0
    // Column must accommodate n containers side-by-side (or at least one node width)
    const colW = n > 0 ? Math.max(NODE_W, n * STEP - COL_GAP) : NODE_W
    guestCols.push({ ...entry, colX: curX, colW, containerCount: n })
    curX += colW + COL_GAP
  }

  const totalGuestW = curX > COL_GAP ? curX - COL_GAP : NODE_W

  // ── Proxmox nodes ─────────────────────────────────────────────────────────

  for (const n of snap.nodes.data) {
    const nodeGuests = guestCols.filter(gc => gc.nodeName === n.node)

    // Center Proxmox over its guests
    const spanStart = nodeGuests.length > 0 ? nodeGuests[0].colX : 0
    const lastGC = nodeGuests[nodeGuests.length - 1]
    const spanEnd = lastGC ? lastGC.colX + lastGC.colW : NODE_W
    const pxX = (spanStart + spanEnd) / 2 - NODE_W / 2

    const pxId = `px-${n.node}`
    nodes.push({
      id: pxId,
      type: 'proxmoxNode',
      position: { x: pxX, y: 0 },
      data: {
        label: n.node,
        cpu: n.cpu,
        ramPct: n.maxmem ? Math.round((n.mem / n.maxmem) * 100) : 0,
      },
    })

    // ── LXC / VMs ───────────────────────────────────────────────────────────

    for (const gc of nodeGuests) {
      const gId = `guest-${gc.guest.vmid}`
      // Center guest card within its column
      const guestX = gc.colX + gc.colW / 2 - NODE_W / 2
      nodes.push({
        id: gId,
        type: 'guestNode',
        position: { x: guestX, y: 210 },
        data: {
          label: gc.guest.name,
          vmid: gc.guest.vmid,
          status: gc.guest.status,
          cpu: gc.guest.cpu,
          ip: gc.guest.ip,
          guestType: gc.guestType,
        },
      })
      edges.push({
        id: `e-${pxId}-${gId}`,
        source: pxId,
        target: gId,
        type: 'smoothstep',
        label: 'vmbr0',
        ...edgeStyle('#1d4ed8'),
      })
    }
  }

  // ── Docker containers ──────────────────────────────────────────────────────

  let traefikNodeId: string | null = null

  for (const gc of guestCols) {
    const host = hostByVmid.get(gc.guest.vmid)
    if (!host || !host.available || host.containers.length === 0) continue

    const parentId = `guest-${gc.guest.vmid}`
    // Spread containers evenly across the column, centered
    const totalContW = host.containers.length * STEP - COL_GAP
    const contStartX = gc.colX + gc.colW / 2 - totalContW / 2

    host.containers.forEach((c, ci) => {
      const cId = `docker-${host.host_id}-${c.id}`
      if (!traefikNodeId && (c.name === 'traefik' || c.image.startsWith('traefik'))) {
        traefikNodeId = cId
      }
      nodes.push({
        id: cId,
        type: 'containerNode',
        position: { x: contStartX + ci * STEP, y: 430 },
        data: { label: c.name, image: c.image, state: c.state },
      })
      edges.push({
        id: `e-${parentId}-${cId}`,
        source: parentId,
        target: cId,
        type: 'smoothstep',
        ...edgeStyle('#22c55e', true),
      })
    })

    // Same-network edges between containers
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

  // ── Cloudflare + Internet (right panel) ───────────────────────────────────

  const cfX = totalGuestW + 120
  nodes.push({
    id: 'internet',
    type: 'internetNode',
    position: { x: cfX + 20, y: 0 },
    data: {},
  })

  const cfTunnels: CloudflareTunnel[] = snap.cloudflare.available
    ? (snap.cloudflare.data?.tunnels ?? [])
    : []

  cfTunnels.forEach((tunnel, i) => {
    const id = `cf-${tunnel.id}`
    nodes.push({
      id,
      type: 'cfNode',
      position: { x: cfX, y: 110 + i * 160 },
      data: { label: tunnel.name, status: tunnel.status, connections: tunnel.connections },
    })
    edges.push({
      id: `e-internet-${id}`,
      source: 'internet',
      target: id,
      label: 'tunnel',
      ...edgeStyle('#f97316', false, true),
    })
  })

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

  // Persist manual drag positions across snapshot refreshes
  const pinnedPositions = useRef(new Map<string, { x: number; y: number }>())

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    pinnedPositions.current.set(node.id, { x: node.position.x, y: node.position.y })
  }, [])

  useEffect(() => {
    if (!snapshot) return
    const { nodes: freshNodes, edges: e } = buildGraph(snapshot)
    // Restore any manually dragged positions
    const merged = freshNodes.map(n => ({
      ...n,
      position: pinnedPositions.current.get(n.id) ?? n.position,
    }))
    setNodes(merged)
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
        onNodeDragStop={onNodeDragStop}
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
