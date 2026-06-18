import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.scheduler import start_scheduler, run_initial_polls, build_snapshot
from app.api import proxmox, docker, connections, stream

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
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.middleware("http")
async def token_auth(request: Request, call_next):
    # Health endpoint is always public
    if request.url.path == "/api/health":
        return await call_next(request)
    # SSE and API endpoints require the token
    if request.url.path.startswith("/api/"):
        token = request.headers.get("X-HUD-Token") or request.query_params.get("token")
        if token != settings.hud_api_token:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)


app.include_router(proxmox.router, prefix="/api")
app.include_router(docker.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(stream.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/snapshot")
async def snapshot():
    return build_snapshot()
