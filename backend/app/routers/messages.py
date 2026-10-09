"""Messages inside a conversation, plus emoji reactions."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..presenters import message_out
from ..schemas import MessageIn, MessageOut, ReactionIn
from ..services.conversations import require_member
from ..services.messaging import (
    MESSAGE_LOAD,
    broadcast_message_updated,
    broadcast_new_message,
    create_message,
    load_message,
)

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    before_id: int | None = Query(default=None, description="Load messages older than this id (paging)"),
    limit: int = Query(default=50, ge=1, le=200),
    me: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_member(db, conversation_id, me)
    query = select(models.Message).where(models.Message.conversation_id == conversation_id)
    if before_id is not None:
        query = query.where(models.Message.id < before_id)
    newest_first = db.scalars(query.options(*MESSAGE_LOAD).order_by(models.Message.id.desc()).limit(limit)).all()
    return [message_out(m) for m in reversed(newest_first)]


@router.post(
    "/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
async def send_message(
    conversation_id: int, data: MessageIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    conv, _ = require_member(db, conversation_id, me)

    if data.reply_to_id is not None:
        original = db.get(models.Message, data.reply_to_id)
        if original is None or original.conversation_id != conv.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can only reply to a message in this chat")
    if data.attachment_id is not None:
        attachment = db.get(models.Attachment, data.attachment_id)
        if attachment is None or attachment.uploader_id != me.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown attachment")

    message = create_message(db, conv, me, data.body, reply_to_id=data.reply_to_id, attachment_id=data.attachment_id)
    await broadcast_new_message(db, conv, message, data.client_id)
    # Reload: if the recipient was online the status is already "delivered".
    return message_out(load_message(db, message.id), data.client_id)


def _message_for_member(db: Session, message_id: int, me: models.User) -> tuple[models.Message, models.Conversation]:
    message = db.get(models.Message, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    conv, _ = require_member(db, message.conversation_id, me)
    if message.kind != "text":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't react to this message")
    return message, conv


@router.put("/messages/{message_id}/reaction", response_model=MessageOut)
async def set_reaction(
    message_id: int, data: ReactionIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Each person has at most one reaction per message; sending a new one replaces the old."""
    message, conv = _message_for_member(db, message_id, me)
    reaction = db.get(models.Reaction, (message.id, me.id))
    if reaction:
        reaction.emoji = data.emoji
    else:
        db.add(models.Reaction(message_id=message.id, user_id=me.id, emoji=data.emoji))
    db.commit()
    await broadcast_message_updated(db, conv, message.id)
    return message_out(load_message(db, message.id))


@router.delete("/messages/{message_id}/reaction", response_model=MessageOut)
async def remove_reaction(message_id: int, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    message, conv = _message_for_member(db, message_id, me)
    if reaction := db.get(models.Reaction, (message.id, me.id)):
        db.delete(reaction)
        db.commit()
    await broadcast_message_updated(db, conv, message.id)
    return message_out(load_message(db, message.id))
