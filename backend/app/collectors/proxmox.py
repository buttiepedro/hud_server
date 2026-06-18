import asyncio
import logging
from proxmoxer import ProxmoxAPI
from app.config import settings
from app.models.proxmox import NodeModel, LXCModel, VMModel, BridgeInfo
from app.models.base import CollectorResult
from app.collectors.discovery import extract_lxc_ip

log = logging.getLogger(__name__)

_client: ProxmoxAPI | None = None


def _get_client() -> ProxmoxAPI:
    global _client
    if _client is None:
        kwargs: dict = dict(
            host=settings.proxmox_host,
            user=settings.proxmox_user,
            token_name=settings.proxmox_token_name,
            token_value=settings.proxmox_token_value,
        )
        if settings.proxmox_ca_cert:
            kwargs["verify_ssl"] = settings.proxmox_ca_cert
        else:
            kwargs["verify_ssl"] = settings.proxmox_verify_ssl
        _client = ProxmoxAPI(**kwargs)
    return _client


def _collect_sync() -> list[NodeModel]:
    px = _get_client()
    raw_nodes = px.nodes.get()
    result: list[NodeModel] = []

    for n in raw_nodes:
        node_name = n["node"]
        lxc_list: list[LXCModel] = []
        vm_list: list[VMModel] = []
        bridges: list[BridgeInfo] = []

        try:
            for c in px.nodes(node_name).lxc.get():
                ip = None
                if c.get("status") == "running":
                    try:
                        cfg = px.nodes(node_name).lxc(c["vmid"]).config.get()
                        ip = extract_lxc_ip(cfg)
                    except Exception:
                        pass
                lxc_list.append(LXCModel(
                    vmid=int(c["vmid"]),
                    name=c.get("name", f"lxc-{c['vmid']}"),
                    status=c.get("status", "unknown"),
                    cpu=c.get("cpu", 0.0),
                    maxcpu=c.get("maxcpu", 1),
                    mem=c.get("mem", 0),
                    maxmem=c.get("maxmem", 0),
                    disk=c.get("disk", 0),
                    maxdisk=c.get("maxdisk", 0),
                    uptime=c.get("uptime", 0),
                    tags=c.get("tags"),
                    ip=ip,
                ))
        except Exception as e:
            log.warning("Failed to fetch LXC for node %s: %s", node_name, e)

        try:
            for v in px.nodes(node_name).qemu.get():
                vm_list.append(VMModel(
                    vmid=int(v["vmid"]),
                    name=v.get("name", f"vm-{v['vmid']}"),
                    status=v.get("status", "unknown"),
                    cpu=v.get("cpu", 0.0),
                    maxcpu=v.get("maxcpu", 1),
                    mem=v.get("mem", 0),
                    maxmem=v.get("maxmem", 0),
                    disk=v.get("disk", 0),
                    maxdisk=v.get("maxdisk", 0),
                    uptime=v.get("uptime", 0),
                    tags=v.get("tags"),
                ))
        except Exception as e:
            log.warning("Failed to fetch VMs for node %s: %s", node_name, e)

        try:
            for iface in px.nodes(node_name).network.get():
                if iface.get("type") in ("bridge", "bond", "vlan"):
                    bridges.append(BridgeInfo(
                        name=iface.get("iface", ""),
                        type=iface.get("type", "bridge"),
                        address=iface.get("address"),
                        netmask=iface.get("netmask"),
                        active=bool(iface.get("active", 0)),
                        bridge_ports=iface.get("bridge_ports"),
                    ))
        except Exception as e:
            log.warning("Failed to fetch network for node %s: %s", node_name, e)

        result.append(NodeModel(
            node=node_name,
            status=n.get("status", "unknown"),
            cpu=n.get("cpu", 0.0),
            maxcpu=n.get("maxcpu", 1),
            mem=n.get("mem", 0),
            maxmem=n.get("maxmem", 0),
            uptime=n.get("uptime", 0),
            lxc=lxc_list,
            vms=vm_list,
            bridges=bridges,
        ))

    return result


async def collect() -> CollectorResult[list[NodeModel]]:
    try:
        nodes = await asyncio.to_thread(_collect_sync)
        return CollectorResult(available=True, data=nodes)
    except Exception as e:
        log.error("Proxmox collection failed: %s", e)
        return CollectorResult(available=False, error=str(e), data=[])
