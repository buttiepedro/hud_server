from fastapi import APIRouter, HTTPException
from app.cache import cache
from app.models.base import CollectorResult
from app.models.docker import DockerHost

router = APIRouter(prefix="/docker", tags=["docker"])


def _hosts_result() -> CollectorResult[list[DockerHost]]:
    r = cache.get_stale("docker")
    if r is None:
        return CollectorResult(available=False, error="No data yet", data=[])
    return r


@router.get("/hosts")
async def get_hosts() -> CollectorResult[list[DockerHost]]:
    return _hosts_result()


@router.get("/hosts/{host_id}")
async def get_host(host_id: str) -> DockerHost:
    result = _hosts_result()
    for h in result.data:
        if h.host_id == host_id:
            return h
    raise HTTPException(status_code=404, detail="Host not found")


@router.get("/containers")
async def get_all_containers():
    result = _hosts_result()
    containers = []
    for host in result.data:
        for c in host.containers:
            containers.append({"host_id": host.host_id, "host_ip": host.ip, **c.model_dump()})
    return {"available": result.available, "data": containers}
