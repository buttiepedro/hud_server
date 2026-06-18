import asyncio
import logging
import os
from datetime import datetime, timezone

import docker
import docker.errors
from docker.tls import TLSConfig

from app.config import settings
from app.models.docker import DockerHost, DockerContainer, DockerNetwork, ContainerPort
from app.models.base import CollectorResult

log = logging.getLogger(__name__)


def _human_uptime(started_at: str | None) -> str | None:
    if not started_at:
        return None
    try:
        # Docker returns ISO8601 with nanoseconds — truncate to seconds
        dt = datetime.fromisoformat(started_at[:19]).replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        s = int(delta.total_seconds())
        if s < 60:
            return f"{s}s"
        if s < 3600:
            return f"{s // 60}m"
        if s < 86400:
            return f"{s // 3600}h {(s % 3600) // 60}m"
        return f"{s // 86400}d {(s % 86400) // 3600}h"
    except Exception:
        return None


def _probe_host_sync(ip: str, vmid: int | None, vtype: str | None, name: str | None) -> DockerHost:
    host_id = ip.replace(".", "_")
    key_path = settings.docker_ssh_key_path

    if not os.path.exists(key_path):
        return DockerHost(
            host_id=host_id, ip=ip,
            ssh_user=settings.docker_ssh_user,
            available=False,
            error=f"SSH key not found: {key_path}",
            proxmox_vmid=vmid, proxmox_type=vtype, proxmox_name=name,
        )

    try:
        client = docker.DockerClient(
            base_url=f"ssh://{settings.docker_ssh_user}@{ip}",
            use_ssh_client=True,
        )
        info = client.info()
        docker_version = info.get("ServerVersion")

        containers: list[DockerContainer] = []
        for c in client.containers.list(all=True):
            attrs = c.attrs
            ports: list[ContainerPort] = []
            for container_port, bindings in (attrs.get("HostConfig", {}).get("PortBindings") or {}).items():
                proto = "tcp"
                cp = container_port
                if "/" in container_port:
                    cp, proto = container_port.split("/", 1)
                if bindings:
                    for b in bindings:
                        ports.append(ContainerPort(
                            host_port=int(b["HostPort"]) if b.get("HostPort") else None,
                            container_port=int(cp),
                            protocol=proto,
                        ))
                else:
                    ports.append(ContainerPort(container_port=int(cp), protocol=proto))

            networks = list((attrs.get("NetworkSettings") or {}).get("Networks", {}).keys())
            state = attrs.get("State", {})
            containers.append(DockerContainer(
                id=c.id[:12],
                name=c.name.lstrip("/"),
                image=c.image.tags[0] if c.image.tags else c.image.short_id,
                status=c.status,
                state=state.get("Status", c.status),
                created=int(c.attrs.get("Created", 0)) if isinstance(c.attrs.get("Created"), (int, float)) else 0,
                uptime=_human_uptime(state.get("StartedAt")),
                ports=ports,
                networks=networks,
                labels=dict(c.labels or {}),
            ))

        networks_list: list[DockerNetwork] = []
        for net in client.networks.list():
            ipam = (net.attrs.get("IPAM") or {}).get("Config") or []
            subnet = ipam[0].get("Subnet") if ipam else None
            gateway = ipam[0].get("Gateway") if ipam else None
            networks_list.append(DockerNetwork(
                name=net.name,
                driver=net.attrs.get("Driver", "bridge"),
                subnet=subnet,
                gateway=gateway,
                internal=net.attrs.get("Internal", False),
                container_count=len(net.attrs.get("Containers") or {}),
            ))

        client.close()
        return DockerHost(
            host_id=host_id, ip=ip,
            ssh_user=settings.docker_ssh_user,
            available=True,
            docker_version=docker_version,
            containers=containers,
            networks=networks_list,
            proxmox_vmid=vmid, proxmox_type=vtype, proxmox_name=name,
        )

    except Exception as e:
        log.debug("Docker probe failed for %s: %s", ip, e)
        return DockerHost(
            host_id=host_id, ip=ip,
            ssh_user=settings.docker_ssh_user,
            available=False,
            error=str(e),
            proxmox_vmid=vmid, proxmox_type=vtype, proxmox_name=name,
        )


async def collect(discovered_hosts: list[tuple[str, int | None, str | None, str | None]]) -> CollectorResult[list[DockerHost]]:
    """
    discovered_hosts: list of (ip, vmid, type, name) from Proxmox discovery + extra hosts.
    """
    if not discovered_hosts:
        return CollectorResult(available=True, data=[], error="No hosts to probe")

    tasks = [
        asyncio.to_thread(_probe_host_sync, ip, vmid, vtype, name)
        for ip, vmid, vtype, name in discovered_hosts
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    hosts: list[DockerHost] = []
    for r in results:
        if isinstance(r, Exception):
            log.error("Unexpected error probing Docker host: %s", r)
        else:
            hosts.append(r)

    return CollectorResult(available=True, data=hosts)
