from pydantic import BaseModel


class ContainerPort(BaseModel):
    host_port: int | None = None
    container_port: int
    protocol: str = "tcp"


class DockerNetwork(BaseModel):
    name: str
    driver: str
    subnet: str | None = None
    gateway: str | None = None
    internal: bool = False
    container_count: int = 0


class DockerContainer(BaseModel):
    id: str
    name: str
    image: str
    status: str
    state: str
    created: int
    uptime: str | None = None
    ports: list[ContainerPort] = []
    networks: list[str] = []
    labels: dict[str, str] = {}


class DockerHost(BaseModel):
    host_id: str
    ip: str
    ssh_user: str
    available: bool
    error: str | None = None
    docker_version: str | None = None
    containers: list[DockerContainer] = []
    networks: list[DockerNetwork] = []
    proxmox_vmid: int | None = None
    proxmox_type: str | None = None  # "lxc" or "qemu"
    proxmox_name: str | None = None
