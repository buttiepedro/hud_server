from fastapi import APIRouter
from app.cache import cache
from app.models.base import CollectorResult
from app.models.connections import TraefikState, CloudflareState, NATRule

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/traefik")
async def get_traefik() -> CollectorResult[TraefikState]:
    r = cache.get_stale("traefik")
    if r is None:
        return CollectorResult(available=False, error="No data yet", data=TraefikState())
    return r


@router.get("/cloudflare")
async def get_cloudflare() -> CollectorResult[CloudflareState]:
    r = cache.get_stale("cloudflare")
    if r is None:
        return CollectorResult(available=False, error="No data yet", data=CloudflareState())
    return r


@router.get("/nat")
async def get_nat() -> CollectorResult[list[NATRule]]:
    r = cache.get_stale("nat")
    if r is None:
        return CollectorResult(available=False, error="No data yet", data=[])
    return r
