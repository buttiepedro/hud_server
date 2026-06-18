import logging
import re
import httpx
from app.config import settings
from app.models.connections import CloudflareState, CloudflareTunnel, CloudflareRoute, CloudflareMetrics
from app.models.base import CollectorResult

log = logging.getLogger(__name__)

CF_API = "https://api.cloudflare.com/client/v4"


async def _fetch_tunnels(client: httpx.AsyncClient) -> list[CloudflareTunnel]:
    url = f"{CF_API}/accounts/{settings.cloudflare_account_id}/cfd_tunnel"
    resp = await client.get(url, params={"is_deleted": "false"})
    resp.raise_for_status()
    tunnels = []
    for t in resp.json().get("result", []):
        connections = len(t.get("connections", []))
        tunnels.append(CloudflareTunnel(
            id=t["id"],
            name=t.get("name", ""),
            status=t.get("status", "inactive"),
            created_at=t.get("created_at"),
            connections=connections,
        ))
    return tunnels


async def _fetch_routes(client: httpx.AsyncClient, tunnel_id: str) -> list[CloudflareRoute]:
    url = f"{CF_API}/accounts/{settings.cloudflare_account_id}/cfd_tunnel/{tunnel_id}/configurations"
    resp = await client.get(url)
    resp.raise_for_status()
    config = resp.json().get("result", {}).get("config", {})
    routes = []
    for rule in config.get("ingress", []):
        hostname = rule.get("hostname", "")
        service = rule.get("service", "")
        if hostname:
            routes.append(CloudflareRoute(
                hostname=hostname,
                service=service,
                path=rule.get("path"),
            ))
    return routes


async def _fetch_metrics() -> CloudflareMetrics:
    if not settings.cloudflared_metrics_url:
        return CloudflareMetrics()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.cloudflared_metrics_url}/metrics")
            resp.raise_for_status()
            text = resp.text
            active = 0
            total = 0
            for line in text.splitlines():
                if line.startswith("cloudflared_tunnel_active_streams"):
                    m = re.search(r"(\d+(?:\.\d+)?)\s*$", line)
                    if m:
                        active = int(float(m.group(1)))
                elif line.startswith("cloudflared_tunnel_total_requests"):
                    m = re.search(r"(\d+(?:\.\d+)?)\s*$", line)
                    if m:
                        total = int(float(m.group(1)))
            return CloudflareMetrics(active_streams=active, total_requests=total)
    except Exception as e:
        log.debug("cloudflared metrics unavailable: %s", e)
        return CloudflareMetrics()


async def collect() -> CollectorResult[CloudflareState]:
    if not settings.cloudflare_api_token or not settings.cloudflare_account_id:
        return CollectorResult(available=False, error="Cloudflare credentials not configured", data=CloudflareState())

    headers = {"Authorization": f"Bearer {settings.cloudflare_api_token}"}
    try:
        async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
            tunnels = await _fetch_tunnels(client)

            routes: list[CloudflareRoute] = []
            for tunnel in tunnels:
                try:
                    routes.extend(await _fetch_routes(client, tunnel.id))
                except Exception as e:
                    log.warning("Could not fetch routes for tunnel %s: %s", tunnel.id, e)

        metrics = await _fetch_metrics()
        return CollectorResult(available=True, data=CloudflareState(
            tunnels=tunnels, routes=routes, metrics=metrics,
        ))

    except Exception as e:
        log.error("Cloudflare collection failed: %s", e)
        return CollectorResult(available=False, error=str(e), data=CloudflareState())
