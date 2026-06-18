import logging
import httpx
from app.config import settings
from app.models.connections import TraefikState, TraefikRouter, TraefikService
from app.models.base import CollectorResult

log = logging.getLogger(__name__)


async def collect() -> CollectorResult[TraefikState]:
    if not settings.traefik_api_url:
        return CollectorResult(available=False, error="TRAEFIK_API_URL not configured", data=TraefikState())

    auth = None
    if settings.traefik_api_user and settings.traefik_api_password:
        auth = (settings.traefik_api_user, settings.traefik_api_password)

    try:
        async with httpx.AsyncClient(auth=auth, timeout=10.0) as client:
            routers_resp = await client.get(f"{settings.traefik_api_url}/api/http/routers")
            services_resp = await client.get(f"{settings.traefik_api_url}/api/http/services")
            routers_resp.raise_for_status()
            services_resp.raise_for_status()

        routers: list[TraefikRouter] = []
        for r in routers_resp.json():
            routers.append(TraefikRouter(
                name=r.get("name", ""),
                rule=r.get("rule", ""),
                entrypoints=r.get("entryPoints", []),
                service=r.get("service", ""),
                tls="tls" in r,
                status=r.get("status", "enabled"),
                provider=r.get("provider"),
            ))

        services: list[TraefikService] = []
        for s in services_resp.json():
            lb = s.get("loadBalancer", {})
            servers = [srv.get("url", "") for srv in lb.get("servers", [])]
            services.append(TraefikService(
                name=s.get("name", ""),
                type=s.get("type", "loadbalancer"),
                servers=servers,
                status=s.get("status", "enabled"),
            ))

        return CollectorResult(available=True, data=TraefikState(routers=routers, services=services))

    except Exception as e:
        log.error("Traefik collection failed: %s", e)
        return CollectorResult(available=False, error=str(e), data=TraefikState())
