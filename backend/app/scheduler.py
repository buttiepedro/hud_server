import asyncio
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.cache import cache
from app.collectors import proxmox, docker_ssh, traefik, cloudflare, nat
from app.collectors.discovery import build_host_list
from app.models.base import CollectorResult
from app.models.proxmox import NodeModel
from app.models.docker import DockerHost
from app.models.connections import TraefikState, CloudflareState, NATRule
from app.models.snapshot import DashboardSnapshot

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _poll_proxmox():
    result = await proxmox.collect()
    cache.set("proxmox", result, ttl=settings.poll_interval_proxmox * 2)
    log.debug("Proxmox poll done: available=%s, nodes=%d", result.available, len(result.data))


async def _poll_docker():
    proxmox_result = cache.get_stale("proxmox")
    nodes = proxmox_result.data if proxmox_result and proxmox_result.available else []
    host_list = build_host_list(nodes)
    result = await docker_ssh.collect(host_list)
    cache.set("docker", result, ttl=settings.poll_interval_docker * 2)
    log.debug("Docker poll done: %d hosts", len(result.data))


async def _poll_traefik():
    result = await traefik.collect()
    cache.set("traefik", result, ttl=settings.poll_interval_traefik * 2)
    log.debug("Traefik poll done: available=%s", result.available)


async def _poll_cloudflare():
    result = await cloudflare.collect()
    cache.set("cloudflare", result, ttl=settings.poll_interval_cloudflare * 2)
    log.debug("Cloudflare poll done: available=%s", result.available)


async def _poll_nat():
    result = await nat.collect()
    cache.set("nat", result, ttl=settings.poll_interval_proxmox * 2)
    log.debug("NAT poll done: available=%s, rules=%d", result.available, len(result.data))


def _default(key: str, fallback):
    result = cache.get_stale(key)
    return result if result is not None else fallback


def build_snapshot() -> DashboardSnapshot:
    return DashboardSnapshot(
        timestamp=datetime.now(timezone.utc),
        nodes=_default("proxmox", CollectorResult(available=False, error="No data yet", data=[])),
        docker_hosts=_default("docker", CollectorResult(available=False, error="No data yet", data=[])),
        traefik=_default("traefik", CollectorResult(available=False, error="No data yet", data=TraefikState())),
        cloudflare=_default("cloudflare", CollectorResult(available=False, error="No data yet", data=CloudflareState())),
        nat_rules=_default("nat", CollectorResult(available=False, error="No data yet", data=[])),
    )


async def run_initial_polls():
    """Run all polls once on startup so the cache isn't empty."""
    await _poll_proxmox()
    await asyncio.gather(_poll_docker(), _poll_traefik(), _poll_cloudflare(), _poll_nat())


def start_scheduler():
    scheduler.add_job(_poll_proxmox, "interval", seconds=settings.poll_interval_proxmox, id="proxmox")
    scheduler.add_job(_poll_docker, "interval", seconds=settings.poll_interval_docker, id="docker")
    scheduler.add_job(_poll_traefik, "interval", seconds=settings.poll_interval_traefik, id="traefik")
    scheduler.add_job(_poll_cloudflare, "interval", seconds=settings.poll_interval_cloudflare, id="cloudflare")
    scheduler.add_job(_poll_nat, "interval", seconds=settings.poll_interval_proxmox, id="nat")
    scheduler.start()
