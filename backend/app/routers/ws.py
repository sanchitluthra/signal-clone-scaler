"""The WebSocket endpoint: presence, typing indicators and delivery on reconnect.

Messages are *sent* over REST (easy to validate, test and retry); the socket is how
the server *pushes* events to clients. Client -> server only sends typing events.

Server -> client event types:
  message_new, message_updated, messages_deleted, receipts, typing,
  presence, user_updated, conversation_changed, conversation_removed
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from .. import models
from ..database import SessionLocal
from ..deps import user_from_token
from ..models import utcnow
from ..realtime import manager
from ..services.conversations import related_user_ids
from ..services.messaging import mark_delivered, notify_receipt_changes

router = APIRouter()


async def broadcast_presence(user_id: int, online: bool) -> None:
    with SessionLocal() as db:
        user = db.get(models.User, user_id)
        if not online:
            user.last_seen_at = utcnow()
            db.commit()
        event = {
            "type": "presence",
            "user_id": user_id,
            "is_online": online,
            "last_seen_at": user.last_seen_at.isoformat() + "Z",
        }
        await manager.send_many(related_user_ids(db, user_id), event)


async def relay_typing(user_id: int, data: dict) -> None:
    conversation_id = data.get("conversation_id")
    with SessionLocal() as db:
        member_ids = set(
            db.scalars(
                select(models.ConversationMember.user_id).where(
                    models.ConversationMember.conversation_id == conversation_id
                )
            ).all()
        )
    if user_id not in member_ids:  # ignore typing events for chats you're not in
        return
    member_ids.discard(user_id)
    await manager.send_many(
        member_ids,
        {"type": "typing", "conversation_id": conversation_id, "user_id": user_id, "is_typing": bool(data.get("is_typing"))},
    )


@router.websocket("/api/ws")
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = ""):
    with SessionLocal() as db:
        user = user_from_token(db, token)
        user_id = user.id if user else None
    if user_id is None:
        await ws.close(code=4401)  # custom code: not authenticated
        return

    await ws.accept()
    came_online = manager.connect(user_id, ws)

    # Anything sent to us while we were offline is now delivered -> senders see double checks.
    with SessionLocal() as db:
        await notify_receipt_changes(db, mark_delivered(db, user_id))
    if came_online:
        await broadcast_presence(user_id, True)

    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "typing":
                await relay_typing(user_id, data)
    except (WebSocketDisconnect, ValueError):  # ValueError = client sent invalid JSON
        pass
    finally:
        if manager.disconnect(user_id, ws):
            await broadcast_presence(user_id, False)
