# HUD Server

A self-hosted dark dashboard for Proxmox homelab servers. Discovers and visualizes LXC containers, VMs, Docker containers, Traefik routes, Cloudflare tunnels, and NAT rules — all in real time, from a single `docker compose up`.

![Dashboard showing Proxmox nodes with LXC/VM tree and Docker containers](docs/screenshot-placeholder.png)

---

## Features

- **Live dashboard** — hierarchical tree view of Proxmox nodes → LXC/VMs → Docker containers inside each, updated every 5 seconds via SSE
- **Interactive topology map** — 2D draggable network graph showing all connections: Cloudflare Tunnel → Traefik → containers, with IPs and network bridges
- **Docker discovery via SSH** — automatically discovers Docker containers from all running LXC/VMs using their IPs from Proxmox
- **Traefik integration** — shows active HTTP routers and which containers are exposed
- **Cloudflare Tunnel integration** — shows tunnel status, active connections, and ingress routes
- **NAT rules** — reads iptables/nftables from the Proxmox host via SSH
- **Setup wizard** — guided first-run configuration in the browser: generates SSH keys, injects them into hosts automatically, tests all integrations
- **Settings page** — reconfigure anything without touching the server
- **Graceful degradation** — every integration is optional; unavailable collectors show a badge instead of breaking the UI
- **Token-protected** — simple static token auth on all API endpoints

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI + APScheduler |
| Frontend | React + Vite + Tailwind CSS (dark HUD theme) |
| Topology | React Flow v11 |
| Real-time | Server-Sent Events (SSE) |
| Proxmox | proxmoxer |
| Docker discovery | Docker SDK over SSH |
| Deployment | Docker Compose |

---

## Quick Start (fresh server)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Create the Traefik proxy network (if using Traefik)

```bash
docker network create proxy
```

### 3. Clone the repository

```bash
git clone https://github.com/buttiepedro/hud_server.git /opt/stacks/hud_server
cd /opt/stacks/hud_server
```

### 4. Create a minimal `.env`

```bash
cp .env.example .env
nano .env
```

Only these values are needed before first launch — everything else is configured through the setup wizard:

```env
HUD_DOMAIN=hud.yourdomain.com
HUD_PORT=3000
ALLOWED_ORIGINS=http://YOUR_SERVER_IP:3000,https://hud.yourdomain.com
```

### 5. Create required directories

```bash
mkdir -p certs data
```

### 6. Build and start

```bash
docker compose up -d --build
```

### 7. Open the setup wizard

Navigate to `http://YOUR_SERVER_IP:3000` — the setup wizard appears automatically on first run.

---

## Setup Wizard

The wizard walks through 5 steps:

**Step 1 — Proxmox**
Connect to your Proxmox server using an API token. The wizard tests the connection and discovers all LXC containers and VMs automatically.

To create a Proxmox API token:
> Datacenter → Permissions → API Tokens → Add
> User: `root@pam` · Token ID: `hud` · Role: `Administrator` · Uncheck "Privilege Separation"

**Step 2 — SSH Keys**
Generates a dedicated ed25519 SSH key and injects it into selected hosts via the Proxmox exec API. If automatic injection fails (e.g. no guest agent on a VM), a copy-paste command is shown.

The SSH key is needed for Docker container discovery and NAT rule reading.

**Step 3 — Integrations** *(all optional)*
- **Traefik** — internal API URL (e.g. `http://traefik:8080`); requires `--api.insecure=true` and HUD on the same Docker network
- **Cloudflare** — API token with `Account > Cloudflare Tunnel > Read` scope + Account ID. Use the Tunnel Name filter if you have tunnels from multiple servers in the same account
- **NAT** — SSH host for reading iptables/nftables from the Proxmox node
- **Extra Docker SSH hosts** — comma-separated IPs for machines outside Proxmox (bare-metal, other clusters)

**Step 4 — Security**
Set the HUD access token (pre-generated, or type your own). Also configure CORS allowed origins.

**Step 5 — Apply**
Saves the config to `./data/config.json`, restarts the backend automatically, and redirects to the dashboard. Token is saved in the browser.

---

## Updating

```bash
cd /opt/stacks/hud_server
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Environment Variables

All variables have sensible defaults. Only `HUD_DOMAIN` is required if using Traefik.

### Docker Compose

| Variable | Default | Description |
|---|---|---|
| `HUD_PORT` | `3000` | External port the frontend listens on |
| `HUD_DOMAIN` | — | Domain for the Traefik host rule |
| `TRAEFIK_ENTRYPOINT` | `websecure` | Traefik entrypoint name |

### Application (set via wizard or `.env`)

| Variable | Default | Description |
|---|---|---|
| `PROXMOX_HOST` | — | IP or hostname of your Proxmox node |
| `PROXMOX_USER` | `root@pam` | Proxmox API user |
| `PROXMOX_TOKEN_NAME` | `hud` | API token name |
| `PROXMOX_TOKEN_VALUE` | — | API token secret |
| `PROXMOX_VERIFY_SSL` | `true` | Set to `false` for self-signed certs |
| `DOCKER_SSH_KEY_PATH` | `/app/data/id_ed25519` | Path to the SSH private key inside the container |
| `DOCKER_SSH_EXTRA_HOSTS` | — | Extra IPs to probe for Docker (comma-separated) |
| `TRAEFIK_API_URL` | — | Internal URL to Traefik API (e.g. `http://traefik:8080`) |
| `CLOUDFLARE_API_TOKEN` | — | CF API token with Tunnel:Read scope |
| `CLOUDFLARE_ACCOUNT_ID` | — | Cloudflare account ID |
| `CLOUDFLARE_TUNNEL_NAME` | — | Filter to show only this tunnel (useful with multiple servers) |
| `CLOUDFLARED_METRICS_URL` | — | cloudflared Prometheus metrics endpoint |
| `NAT_SSH_HOST` | — | IP of the host to read NAT rules from |
| `NAT_SSH_USER` | `root` | SSH user for NAT host |
| `HUD_API_TOKEN` | `change_me` | Token required to access the dashboard |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins (comma-separated) |
| `POLL_INTERVAL_PROXMOX` | `30` | Proxmox poll interval in seconds |
| `POLL_INTERVAL_DOCKER` | `15` | Docker poll interval in seconds |
| `POLL_INTERVAL_TRAEFIK` | `60` | Traefik poll interval in seconds |
| `POLL_INTERVAL_CLOUDFLARE` | `120` | Cloudflare poll interval in seconds |

> **Config priority:** `data/config.json` (wizard) overrides `.env`. This means the wizard can update settings without editing files on the server.

---

## Architecture

```
browser
  │  SSE (5s)  +  REST API
  ▼
frontend (nginx :80)
  │  /api/* → proxy
  ▼
backend (FastAPI :8000)
  ├── APScheduler — polls all collectors on configurable intervals
  ├── TTLCache — in-memory last-known-good state per collector
  ├── SSE stream — pushes DashboardSnapshot every 5s
  │
  ├── collectors/proxmox.py    ← proxmoxer API
  ├── collectors/docker_ssh.py ← Docker SDK over SSH (auto-discovered IPs)
  ├── collectors/traefik.py    ← Traefik HTTP API
  ├── collectors/cloudflare.py ← Cloudflare REST API
  └── collectors/nat.py        ← SSH + iptables/nftables (paramiko)
```

Each collector returns a `CollectorResult(available, error, data)`. If a collector is unconfigured or fails, it returns `available=False` — the frontend shows an "UNAVAILABLE" badge instead of crashing.

---

## Project Structure

```
hud_server/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, auth middleware, lifespan
│   │   ├── config.py          # pydantic-settings + JSON config source
│   │   ├── scheduler.py       # APScheduler background polling
│   │   ├── cache.py           # TTLCache per collector
│   │   ├── collectors/        # proxmox, docker_ssh, traefik, cloudflare, nat
│   │   ├── models/            # Pydantic models for all data types
│   │   └── api/               # REST routers (proxmox, docker, connections, stream, setup)
│   ├── Dockerfile
│   └── docker-entrypoint.sh   # Copies SSH key to /root/.ssh/ before start
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Root: setup check → token gate → HUD
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Tree view: nodes → LXC/VMs → containers
│   │   │   ├── TopologyMap.tsx    # React Flow interactive graph
│   │   │   ├── Containers.tsx     # Flat container list
│   │   │   ├── Connections.tsx    # Traefik / CF / NAT panels
│   │   │   └── SetupWizard.tsx    # First-run + settings page
│   │   ├── store/
│   │   │   └── snapshotStore.ts   # Zustand — SSE state
│   │   └── hooks/
│   │       ├── useSSE.ts          # EventSource with auto-reconnect
│   │       └── useToken.ts        # Token persistence (localStorage)
│   └── Dockerfile             # Multi-stage: Vite build → nginx:alpine
│
├── data/                      # Writable runtime data (gitignored)
│   └── config.json            # Written by setup wizard — overrides .env
├── certs/                     # Manual SSH keys / CA certs (gitignored)
├── docker-compose.yml
└── .env.example
```

---

## Security Notes

- The HUD token is the only thing protecting the dashboard — use a long random value (`openssl rand -hex 32`)
- If exposed via Cloudflare Tunnel, add Cloudflare Access (Zero Trust) for an extra auth layer
- The Proxmox API token only needs read permissions — use role `PVEAuditor` if you prefer minimal permissions (note: guest agent IPs require slightly more access)
- SSH keys generated by the wizard are stored in `./data/` which is gitignored
- `data/config.json` contains all credentials — keep the server directory access-controlled
- The `certs/` and `data/` directories are gitignored and never committed

---

## Reconfiguration

Access **Settings** from the sidebar at any time to update credentials, add integrations, or rotate the HUD token. Saving applies changes immediately (backend restarts in ~5 seconds).

To reset to a clean state and re-run the wizard:

```bash
rm /opt/stacks/hud_server/data/config.json
docker compose restart backend
```

Then open the app — the wizard will reappear.
