from pydantic import BaseModel


class BridgeInfo(BaseModel):
    name: str
    type: str
    address: str | None = None
    netmask: str | None = None
    active: bool = False
    bridge_ports: str | None = None


class LXCModel(BaseModel):
    vmid: int
    name: str
    status: str
    cpu: float = 0.0
    maxcpu: int = 1
    mem: int = 0
    maxmem: int = 0
    disk: int = 0
    maxdisk: int = 0
    uptime: int = 0
    ip: str | None = None
    tags: str | None = None


class VMModel(BaseModel):
    vmid: int
    name: str
    status: str
    cpu: float = 0.0
    maxcpu: int = 1
    mem: int = 0
    maxmem: int = 0
    disk: int = 0
    maxdisk: int = 0
    uptime: int = 0
    ip: str | None = None
    tags: str | None = None


class NodeModel(BaseModel):
    node: str
    status: str
    cpu: float = 0.0
    maxcpu: int = 1
    mem: int = 0
    maxmem: int = 0
    uptime: int = 0
    lxc: list[LXCModel] = []
    vms: list[VMModel] = []
    bridges: list[BridgeInfo] = []
