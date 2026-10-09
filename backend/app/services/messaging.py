"""Message business logic: create, deliver, read receipts, disappearing-message cleanup."""
from collections import defaultdict
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models
from ..database import SessionLocal
from ..models import utcnow
from ..presenters import message_out, message_status
from ..realtime import manager

# Everything message_out() touches, loaded up-front to avoid one query per message.
MESSAGE_LOAD = (
    selectinload(models.Message.receipts),
    selectinload(models.Message.reactions),
    joinedload(models.Message.attachment),
    joinedload(models.Message.reply_to).joinedload(models.Message.attachment),
)


def load_message(db: Session, message_id: int) -> models.Message | None:
    return db.scalar(
        select(models.Message)
        .where(models.Message.id == message_id)
        .options(*MESSAGE_LOAD)
        .execution_options(populate_existing=True)
    )


def create_message(
    db: Session,
    conv: models.Conversation,
    sender: models.User,
    body: str,
    kind: str = "text",
    reply_to_id: int | None = None,
    attachment_id: int | None = None,
) -> models.Message:
    now = utcnow()
    message = models.Message(
        conversation_id=conv.id,
        sender_id=sender.id,
        kind=kind,
        body=body,
        reply_to_id=reply_to_id,
        attachment_id=attachment_id,
        created_at=now,
    )
    if kind == "text":
        if conv.disappearing_seconds:
            message.expires_at = now + timedelta(seconds=conv.disappearing_seconds)
        # One receipt per recipient; both timestamps start empty -> status "sent".
        message.receipts = [
            models.MessageReceipt(user_id=m.user_id) for m in conv.members if m.user_id != sender.id
        ]
    conv.last_message_at = now
    db.add(message)
    db.commit()
    return load_message(db, message.id)


def mark_delivered(db: Session, user_id: int, message_ids: list[int] | None = None) -> list[int]:
    """Mark this user's pending receipts as delivered. Returns the affected message ids."""
    query = select(models.MessageReceipt).where(
        models.MessageReceipt.user_id == user_id, models.MessageReceipt.delivered_at.is_(None)
    )
    if message_ids is not None:
        query = query.where(models.MessageReceipt.message_id.in_(message_ids))
    receipts = db.scalars(query).all()
    now = utcnow()
    for r in receipts:
        r.delivered_at = now
    db.commit()
    return [r.message_id for r in receipts]


def mark_read(db: Session, user_id: int, conversation_id: int, up_to_message_id: int) -> list[int]:
    """Mark everything up to a message as read (reading implies delivered). Returns affected message ids."""
    receipts = db.scalars(
        select(models.MessageReceipt)
        .join(models.Message, models.Message.id == models.MessageReceipt.message_id)
        .where(
            models.MessageReceipt.user_id == user_id,
            models.MessageReceipt.read_at.is_(None),
            models.Message.conversation_id == conversation_id,
            models.Message.id <= up_to_message_id,
        )
    ).all()
    now = utcnow()
    for r in receipts:
        r.read_at = now
        r.delivered_at = r.delivered_at or now
    db.commit()
    return [r.message_id for r in receipts]


async def notify_receipt_changes(db: Session, message_ids: list[int]) -> None:
    """Tell each sender the new check-mark status of their messages."""
    if not message_ids:
        return
    messages = db.scalars(
        select(models.Message)
        .where(models.Message.id.in_(message_ids))
        .options(selectinload(models.Message.receipts))
        .execution_options(populate_existing=True)
    ).all()
    updates_by_sender: dict[int, list[dict]] = defaultdict(list)
    for m in messages:
        updates_by_sender[m.sender_id].append(
            {"conversation_id": m.conversation_id, "message_id": m.id, "status": message_status(m)}
        )
    for sender_id, updates in updates_by_sender.items():
        await manager.send(sender_id, {"type": "receipts", "updates": updates})


async def broadcast_new_message(
    db: Session, conv: models.Conversation, message: models.Message, client_id: str | None = None
) -> None:
    """Push a new message to every member. Anyone whose socket received it counts as 'delivered'."""
    event = {"type": "message_new", "message": message_out(message, client_id).model_dump(mode="json")}
    reached = await manager.send_many([m.user_id for m in conv.members], event)
    reached.discard(message.sender_id)
    if message.kind != "text" or not reached:
        return
    changed: list[int] = []
    for user_id in reached:
        changed += mark_delivered(db, user_id, [message.id])
    await notify_receipt_changes(db, changed)


async def broadcast_message_updated(db: Session, conv: models.Conversation, message_id: int) -> None:
    message = load_message(db, message_id)
    event = {"type": "message_updated", "message": message_out(message).model_dump(mode="json")}
    await manager.send_many([m.user_id for m in conv.members], event)


async def purge_expired_messages() -> None:
    """Delete messages whose disappearing timer ran out and tell the members to drop them."""
    with SessionLocal() as db:
        rows = db.execute(
            select(models.Message.id, models.Message.conversation_id).where(models.Message.expires_at <= utcnow())
        ).all()
        if not rows:
            return
        db.execute(delete(models.Message).where(models.Message.id.in_([r.id for r in rows])))
        db.commit()

        ids_by_conversation: dict[int, list[int]] = defaultdict(list)
        for r in rows:
            ids_by_conversation[r.conversation_id].append(r.id)
        for conversation_id, ids in ids_by_conversation.items():
            member_ids = db.scalars(
                select(models.ConversationMember.user_id).where(
                    models.ConversationMember.conversation_id == conversation_id
                )
            ).all()
            await manager.send_many(
                member_ids, {"type": "messages_deleted", "conversation_id": conversation_id, "message_ids": ids}
            )
