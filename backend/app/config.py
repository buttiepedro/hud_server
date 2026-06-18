from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Proxmox
    proxmox_host: str
    proxmox_user: str = "root@pam"
    proxmox_token_name: str = "hud"
    proxmox_token_value: str
    proxmox_verify_ssl: bool = True
    proxmox_ca_cert: str | None = None

    # Docker SSH
    docker_ssh_user: str = "root"
    docker_ssh_key_path: str = "/app/certs/id_ed25519"
    docker_ssh_extra_hosts: str = ""  # comma-separated IPs

    # Traefik
    traefik_api_url: str | None = None
    traefik_api_user: str | None = None
    traefik_api_password: str | None = None

    # Cloudflare
    cloudflare_api_token: str | None = None
    cloudflare_account_id: str | None = None
    cloudflared_metrics_url: str | None = None

    # NAT
    nat_ssh_host: str | None = None
    nat_ssh_user: str = "root"
    nat_ssh_key_path: str = "/app/certs/id_ed25519"

    # App
    poll_interval_proxmox: int = 30
    poll_interval_docker: int = 15
    poll_interval_traefik: int = 60
    poll_interval_cloudflare: int = 120
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"
    hud_api_token: str = "change_me"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def docker_ssh_extra_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.docker_ssh_extra_hosts.split(",") if h.strip()]


settings = Settings()
