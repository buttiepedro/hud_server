import logging
from app.config import settings
from app.models.proxmox import NodeModel

log = logging.getLogger(__name__)


def extract_lxc_ip(lxc_raw: dict) -> str | None:
    """Proxmox LXC network config has IP in the 'net0' field as 'name=eth0,ip=x.x.x.x/24,...'"""
    for key in ("net0", "net1", "net2"):
        val = lxc_raw.get(key, "")
        for part in val.split(","):
            if part.startswith("ip="):
                ip_cidr = part[3:]
                return ip_cidr.split("/")[0] if "/" in ip_cidr else ip_cidr
    return None


def build_host_list(nodes: list[NodeModel]) -> list[tuple[str, int | None, str | None, str | None]]:
    """
    Build (ip, vmid, type, name) tuples for all running LXC/VMs across all nodes.
    IPs come from the Proxmox guest-agent (VMs) or LXC network config.
    Extra hosts from env are appended without vmid context.
    """
    hosts: list[tuple[str, int | None, str | None, str | None]] = []
    seen_ips: set[str] = set()

    for node in nodes:
        for lxc in node.lxc:
            if lxc.status != "running":
                continue
            ip = lxc.ip
            if ip and ip not in seen_ips:
                seen_ips.add(ip)
                hosts.append((ip, lxc.vmid, "lxc", lxc.name))

        for vm in node.vms:
            if vm.status != "running":
                continue
            ip = vm.ip
            if ip and ip not in seen_ips:
                seen_ips.add(ip)
                hosts.append((ip, vm.vmid, "qemu", vm.name))

    for extra_ip in settings.docker_ssh_extra_hosts_list:
        if extra_ip not in seen_ips:
            seen_ips.add(extra_ip)
            hosts.append((extra_ip, None, None, None))

    log.debug("Discovery found %d candidate Docker hosts", len(hosts))
    return hosts
