from datetime import datetime
from pydantic import BaseModel
from .base import CollectorResult
from .proxmox import NodeModel
from .docker import DockerHost
from .connections import TraefikState, CloudflareState, NATRule


class DashboardSnapshot(BaseModel):
    timestamp: datetime
    nodes: CollectorResult[list[NodeModel]]
    docker_hosts: CollectorResult[list[DockerHost]]
    traefik: CollectorResult[TraefikState]
    cloudflare: CollectorResult[CloudflareState]
    nat_rules: CollectorResult[list[NATRule]]
