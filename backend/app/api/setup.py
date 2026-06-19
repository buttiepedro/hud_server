import asyncio
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import CONFIG_PATH, settings
from app.collectors.discovery import extract_lxc_ip

log = logging.getLogger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])

CERTS_DIR = Path("/app/certs")
KEY_PATH = CERTS_DIR / "id_ed25519"
PUB_PATH = CERTS_DIR / "id_ed25519.pub"


# ── Models ──────────────────────────────────────────────────────────────────


class ProxmoxCreds(BaseModel):
    host: str
    user: str = "root@pam"
    token_name: str = "hud"
    token_value: str
    verify_ssl: bool = False


class DiscoveredHost(BaseModel):
    vmid: int
    name: str
    type: str  # "lxc" | "vm"
    node: str
    ip: str | None = None


class InjectTarget(BaseModel):
    vmid: int
    name: str
    type: str
    node: str


class InjectRequest(BaseModel):
    proxmox_creds: ProxmoxCreds
    targets: list[InjectTarget]


class InjectResult(BaseModel):
    vmid: int
    name: str
    success: bool
    error: str | None = None
    manual_command: str | None = None


class IntegrationTestRequest(BaseModel):
    type: str  # "traefik" | "cloudflare" | "nat"
    traefik_api_url: str | None = None
    traefik_api_user: str | None = None
    traefik_api_password: str | None = None
    cloudflare_api_token: str | None = None
    cloudflare_account_id: str | None = None
    nat_ssh_host: str | None = None
    nat_ssh_user: str = "root"


class SaveConfigRequest(BaseModel):
    proxmox_host: str
    proxmox_user: str = "root@pam"
    proxmox_token_name: str = "hud"
    proxmox_token_value: str
    proxmox_verify_ssl: bool = False
    docker_ssh_extra_hosts: str = ""
    traefik_api_url: str | None = None
    traefik_api_user: str | None = None
    traefik_api_password: str | None = None
    cloudflare_api_token: str | None = None
    cloudflare_account_id: str | None = None
    cloudflare_tunnel_name: str | None = None
    cloudflared_metrics_url: str | None = None
    nat_ssh_host: str | None = None
    nat_ssh_user: str = "root"
    hud_api_token: str
    allowed_origins: str = "http://localhost:3000"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_proxmox(creds: ProxmoxCreds):
    from proxmoxer import ProxmoxAPI
    return ProxmoxAPI(
        host=creds.host,
        user=creds.user,
        token_name=creds.token_name,
        token_value=creds.token_value,
        verify_ssl=creds.verify_ssl,
    )


def _discover_sync(creds: ProxmoxCreds) -> list[DiscoveredHost]:
    px = _make_proxmox(creds)
    hosts: list[DiscoveredHost] = []
    for n in px.nodes.get():
        node = n["node"]
        for c in px.nodes(node).lxc.get():
            ip = None
            if c.get("status") == "running":
                try:
                    cfg = px.nodes(node).lxc(c["vmid"]).config.get()
                    ip = extract_lxc_ip(cfg)
                except Exception:
                    pass
            hosts.append(DiscoveredHost(vmid=int(c["vmid"]), name=c.get("name", f"lxc-{c['vmid']}"), type="lxc", node=node, ip=ip))
        for v in px.nodes(node).qemu.get():
            ip = None
            if v.get("status") == "running":
                try:
                    ifaces = px.nodes(node).qemu(v["vmid"]).agent("network-get-interfaces").get()
                    for iface in (ifaces.get("result") or []):
                        if iface.get("name") == "lo":
                            continue
                        for addr in (iface.get("ip-addresses") or []):
                            if addr.get("ip-address-type") == "ipv4":
                                candidate = addr["ip-address"]
                                if not candidate.startswith("127.") and not candidate.startswith("169.254."):
                                    ip = candidate
                                    break
                        if ip:
                            break
                except Exception:
                    pass
            hosts.append(DiscoveredHost(vmid=int(v["vmid"]), name=v.get("name", f"vm-{v['vmid']}"), type="vm", node=node, ip=ip))
    return hosts


def _inject_sync(creds: ProxmoxCreds, targets: list[InjectTarget], pubkey: str) -> list[InjectResult]:
    px = _make_proxmox(creds)
    results: list[InjectResult] = []
    cmd = f"mkdir -p /root/.ssh && echo {pubkey!r} >> /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys"

    for t in targets:
        try:
            if t.type == "lxc":
                px.nodes(t.node).lxc(t.vmid).exec.post(command=["bash", "-c", cmd])
                results.append(InjectResult(vmid=t.vmid, name=t.name, success=True))
            else:
                # VM via qemu guest agent
                resp = px.nodes(t.node).qemu(t.vmid).agent.exec.post(**{"command": ["bash", "-c", cmd]})
                pid = resp.get("pid") if resp else None
                if pid:
                    # Poll for completion (max 10s)
                    for _ in range(10):
                        time.sleep(1)
                        status = px.nodes(t.node).qemu(t.vmid).agent("exec-status").get(pid=pid)
                        if status.get("exited"):
                            break
                results.append(InjectResult(vmid=t.vmid, name=t.name, success=True))
        except Exception as e:
            manual = f"echo {pubkey!r} | sudo tee -a /root/.ssh/authorized_keys"
            results.append(InjectResult(vmid=t.vmid, name=t.name, success=False, error=str(e), manual_command=manual))

    return results


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/status")
async def get_status():
    return {
        "configured": settings.is_configured,
        "has_ssh_key": KEY_PATH.exists(),
        "proxmox_host": settings.proxmox_host if settings.is_configured else None,
        "traefik_configured": bool(settings.traefik_api_url),
        "cloudflare_configured": bool(settings.cloudflare_api_token and settings.cloudflare_account_id),
        "nat_configured": bool(settings.nat_ssh_host),
    }


@router.post("/test-proxmox")
async def test_proxmox(creds: ProxmoxCreds):
    try:
        hosts = await asyncio.to_thread(_discover_sync, creds)
        return {"success": True, "hosts": [h.model_dump() for h in hosts]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/ssh-key")
async def get_ssh_key():
    if PUB_PATH.exists():
        return {"public_key": PUB_PATH.read_text().strip()}
    return {"public_key": None}


@router.post("/generate-ssh-key")
async def generate_ssh_key():
    CERTS_DIR.mkdir(parents=True, exist_ok=True)
    if KEY_PATH.exists():
        KEY_PATH.unlink()
    if PUB_PATH.exists():
        PUB_PATH.unlink()
    result = subprocess.run(
        ["ssh-keygen", "-t", "ed25519", "-f", str(KEY_PATH), "-N", ""],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return {"success": False, "error": result.stderr}
    KEY_PATH.chmod(0o600)
    return {"success": True, "public_key": PUB_PATH.read_text().strip()}


@router.post("/inject-ssh-key")
async def inject_ssh_key(req: InjectRequest):
    if not PUB_PATH.exists():
        return {"results": [], "error": "No SSH key generated yet"}
    pubkey = PUB_PATH.read_text().strip()
    results = await asyncio.to_thread(_inject_sync, req.proxmox_creds, req.targets, pubkey)
    return {"results": [r.model_dump() for r in results]}


@router.post("/test-integration")
async def test_integration(req: IntegrationTestRequest):
    try:
        if req.type == "traefik":
            if not req.traefik_api_url:
                return {"success": False, "detail": "URL required"}
            auth = (req.traefik_api_user, req.traefik_api_password) if req.traefik_api_user else None
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{req.traefik_api_url}/api/version", auth=auth)  # type: ignore[arg-type]
                resp.raise_for_status()
            return {"success": True, "detail": f"Traefik {resp.json().get('Version', 'ok')}"}

        elif req.type == "cloudflare":
            if not req.cloudflare_api_token or not req.cloudflare_account_id:
                return {"success": False, "detail": "Token and account ID required"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"https://api.cloudflare.com/client/v4/accounts/{req.cloudflare_account_id}/cfd_tunnel",
                    headers={"Authorization": f"Bearer {req.cloudflare_api_token}"},
                    params={"is_deleted": "false"},
                )
                resp.raise_for_status()
            count = len(resp.json().get("result", []))
            return {"success": True, "detail": f"{count} tunnel(s) found"}

        elif req.type == "nat":
            if not req.nat_ssh_host:
                return {"success": False, "detail": "SSH host required"}
            result = subprocess.run(
                ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5",
                 f"{req.nat_ssh_user}@{req.nat_ssh_host}", "echo ok"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                return {"success": True, "detail": "SSH connection OK"}
            return {"success": False, "detail": result.stderr.strip() or "Connection failed"}

        return {"success": False, "detail": f"Unknown type: {req.type}"}
    except Exception as e:
        return {"success": False, "detail": str(e)}


@router.post("/save")
async def save_config(req: SaveConfigRequest):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {k: v for k, v in req.model_dump().items() if v is not None and v != ""}
    # Always keep these even if empty string
    for key in ("docker_ssh_extra_hosts", "nat_ssh_user", "proxmox_user", "proxmox_token_name"):
        data[key] = getattr(req, key)
    CONFIG_PATH.write_text(json.dumps(data, indent=2))
    log.info("Config saved to %s — restarting", CONFIG_PATH)
    async def _restart():
        await asyncio.sleep(0.8)
        sys.exit(0)  # Docker restart: unless-stopped brings it back with new config
    asyncio.create_task(_restart())
    return {"ok": True}
