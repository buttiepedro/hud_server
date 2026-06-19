import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.scheduler import start_scheduler, run_initial_polls, build_snapshot
from app.api import proxmox, docker, connections, stream
from app.api import setup as setup_api

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting HUD Server — running initial polls...")
    start_scheduler()
    await run_initial_polls()
    log.info("Initial polls complete. HUD ready.")
    yield
    from app.scheduler import scheduler
    scheduler.shutdown(wait=False)


app = FastAPI(title="HUD Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def token_auth(request: Request, call_next):
    path = request.url.path

    # Always public
    if path == "/api/health":
        return await call_next(request)

    # Setup endpoints: public when not yet configured, token-protected otherwise
    if path.startswith("/api/setup/"):
        if not settings.is_configured:
            return await call_next(request)
        # Fall through to token check below

    # All /api/ endpoints require the token
    if path.startswith("/api/"):
        token = request.headers.get("X-HUD-Token") or request.query_params.get("token")
        if token != settings.hud_api_token:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


app.include_router(setup_api.router, prefix="/api")
app.include_router(proxmox.router, prefix="/api")
app.include_router(docker.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(stream.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "configured": settings.is_configured}


@app.get("/api/snapshot")
async def snapshot():
    return build_snapshot()
