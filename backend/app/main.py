"""FastAPI application entry point.

    uvicorn app.main:app --reload      (run from the backend/ folder)
    API docs: http://localhost:8000/docs
"""
import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, SEED_ON_STARTUP, UPLOAD_DIR
from .database import Base, engine
from .routers import attachments, auth, contacts, conversations, messages, users, ws
from .seed import seed_if_empty
from .services.messaging import purge_expired_messages

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def disappearing_messages_loop() -> None:
    """Every 2 seconds, delete messages whose timer has expired."""
    while True:
        await asyncio.sleep(2)
        await purge_expired_messages()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    if SEED_ON_STARTUP:
        seed_if_empty()
    cleanup_task = asyncio.create_task(disappearing_messages_loop())
    yield
    cleanup_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await cleanup_task


app = FastAPI(title="Signal Clone API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, users, contacts, conversations, messages, attachments, ws):
    app.include_router(module.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
