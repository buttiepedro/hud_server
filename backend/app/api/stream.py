import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.scheduler import build_snapshot

router = APIRouter(tags=["stream"])

SSE_INTERVAL = 5  # seconds between pushes


@router.get("/stream")
async def sse_stream(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            snapshot = build_snapshot()
            data = snapshot.model_dump_json()
            yield f"data: {data}\n\n"
            await asyncio.sleep(SSE_INTERVAL)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
