import asyncio
import logging
import re
import paramiko
from app.config import settings
from app.models.connections import NATRule
from app.models.base import CollectorResult

log = logging.getLogger(__name__)


def _run_ssh_command(host: str, user: str, key_path: str, cmd: str) -> str:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, key_filename=key_path, timeout=10)
    _, stdout, _ = ssh.exec_command(cmd)
    output = stdout.read().decode()
    ssh.close()
    return output


def _parse_iptables(output: str) -> list[NATRule]:
    rules: list[NATRule] = []
    current_chain = ""
    for line in output.splitlines():
        chain_match = re.match(r"^Chain (\S+)", line)
        if chain_match:
            current_chain = chain_match.group(1)
            continue
        if line.startswith("target") or line.startswith("pkts") or not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3:
            target = parts[0]
            proto = parts[1] if parts[1] != "--" else None
            extra = " ".join(parts[3:]) if len(parts) > 3 else None
            # Try to extract source/destination
            src = parts[2] if len(parts) > 2 and parts[2] not in ("0.0.0.0/0", "anywhere") else None
            dst = parts[3] if len(parts) > 3 and parts[3] not in ("0.0.0.0/0", "anywhere") else None
            rules.append(NATRule(
                chain=current_chain,
                protocol=proto,
                source=src,
                destination=dst,
                target=target,
                extra=extra,
            ))
    return rules


async def collect() -> CollectorResult[list[NATRule]]:
    if not settings.nat_ssh_host:
        return CollectorResult(available=False, error="NAT_SSH_HOST not configured", data=[])

    try:
        output = await asyncio.to_thread(
            _run_ssh_command,
            settings.nat_ssh_host,
            settings.nat_ssh_user,
            settings.nat_ssh_key_path,
            "iptables -L -n -t nat --line-numbers 2>/dev/null || nft list ruleset 2>/dev/null || echo 'no_nat_tool'",
        )
        if "no_nat_tool" in output or not output.strip():
            return CollectorResult(available=False, error="No iptables or nft available on host", data=[])

        rules = _parse_iptables(output)
        return CollectorResult(available=True, data=rules)

    except Exception as e:
        log.error("NAT collection failed: %s", e)
        return CollectorResult(available=False, error=str(e), data=[])
