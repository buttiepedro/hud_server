import json
from pathlib import Path
from typing import Any  # noqa: F401 — used in settings_customise_sources signature
from pydantic_settings import BaseSettings, SettingsConfigDict, PydanticBaseSettingsSource
from pydantic.fields import FieldInfo

CONFIG_PATH = Path("/app/data/config.json")


class JsonFileConfigSource(PydanticBaseSettingsSource):
    def get_field_value(self, _field: FieldInfo, field_name: str) -> tuple[Any, str, bool]:
        data = self._read()
        val = data.get(field_name)
        return val, field_name, val is not None

    def __call__(self) -> dict[str, Any]:
        return self._read()

    def _read(self) -> dict[str, Any]:
        if CONFIG_PATH.exists():
            try:
                return json.loads(CONFIG_PATH.read_text())
            except Exception:
                pass
        return {}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Proxmox (required for operation, optional at startup for setup wizard)
    proxmox_host: str = ""
    proxmox_user: str = "root@pam"
    proxmox_token_name: str = "hud"
    proxmox_token_value: str = ""
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
    cloudflare_tunnel_name: str | None = None

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

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource | None = None,
        env_settings: PydanticBaseSettingsSource | None = None,
        dotenv_settings: PydanticBaseSettingsSource | None = None,
        secrets_settings: PydanticBaseSettingsSource | None = None,
        **_kwargs: Any,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # JSON file takes priority over .env so the setup wizard can override it.
        # Optional defaults handle pydantic-settings signature changes across versions.
        sources = (init_settings, JsonFileConfigSource(settings_cls), env_settings, dotenv_settings, secrets_settings)
        return tuple(s for s in sources if s is not None)

    @property
    def is_configured(self) -> bool:
        return bool(self.proxmox_host and self.proxmox_token_value)

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def docker_ssh_extra_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.docker_ssh_extra_hosts.split(",") if h.strip()]


settings = Settings()
