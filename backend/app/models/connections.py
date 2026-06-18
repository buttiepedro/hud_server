from pydantic import BaseModel


class TraefikRouter(BaseModel):
    name: str
    rule: str
    entrypoints: list[str] = []
    service: str
    tls: bool = False
    status: str = "enabled"
    provider: str | None = None


class TraefikService(BaseModel):
    name: str
    type: str = "loadbalancer"
    servers: list[str] = []
    status: str = "enabled"


class TraefikState(BaseModel):
    routers: list[TraefikRouter] = []
    services: list[TraefikService] = []


class CloudflareTunnel(BaseModel):
    id: str
    name: str
    status: str
    created_at: str | None = None
    connections: int = 0


class CloudflareRoute(BaseModel):
    hostname: str
    service: str
    path: str | None = None


class CloudflareMetrics(BaseModel):
    active_streams: int = 0
    total_requests: int = 0


class CloudflareState(BaseModel):
    tunnels: list[CloudflareTunnel] = []
    routes: list[CloudflareRoute] = []
    metrics: CloudflareMetrics = CloudflareMetrics()


class NATRule(BaseModel):
    chain: str
    protocol: str | None = None
    source: str | None = None
    destination: str | None = None
    target: str
    extra: str | None = None
