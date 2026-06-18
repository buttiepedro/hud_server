from fastapi import APIRouter
from app.cache import cache
from app.models.base import CollectorResult
from app.models.proxmox import NodeModel

router = APIRouter(prefix="/proxmox", tags=["proxmox"])


def _nodes_result() -> CollectorResult[list[NodeModel]]:
    r = cache.get_stale("proxmox")
    if r is None:
        return CollectorResult(available=False, error="No data yet", data=[])
    return r


@router.get("/nodes")
async def get_nodes() -> CollectorResult[list[NodeModel]]:
    return _nodes_result()


@router.get("/summary")
async def get_summary():
    result = _nodes_result()
    lxc_total = sum(len(n.lxc) for n in result.data)
    vm_total = sum(len(n.vms) for n in result.data)
    lxc_running = sum(1 for n in result.data for c in n.lxc if c.status == "running")
    vm_running = sum(1 for n in result.data for v in n.vms if v.status == "running")
    return {
        "available": result.available,
        "node_count": len(result.data),
        "lxc_total": lxc_total,
        "lxc_running": lxc_running,
        "vm_total": vm_total,
        "vm_running": vm_running,
    }
