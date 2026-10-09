"""Turn ORM rows into API response models.

Kept separate from the routers so REST endpoints and WebSocket events
always serialize objects the exact same way.
"""
from . import models
from .realtime import manager
from .schemas import (
    AttachmentOut,
    ConversationOut,
    MemberOut,
    MessageOut,
    ReactionOut,
    ReplyPreviewOut,
    UserOut,
)


def user_out(user: models.User) -> UserOut:
    return UserOut(
        id=user.id,
        phone=user.phone,
        username=user.username,
        display_name=user.display_name,
        about=user.about,
        avatar_color=user.avatar_color,
        avatar_url=user.avatar_url,
        is_online=manager.is_online(user.id),
        last_seen_at=user.last_seen_at,
    )


def attachment_out(a: models.Attachment) -> AttachmentOut:
    return AttachmentOut(
        id=a.id, file_name=a.file_name, content_type=a.content_type, size_bytes=a.size_bytes,
        url=f"/uploads/{a.storage_name}",
    )


def message_status(message: models.Message) -> str:
    """The sender's check marks: read once every recipient read it, delivered once every recipient got it."""
    receipts = message.receipts
    if receipts and all(r.read_at for r in receipts):
        return "read"
    if receipts and all(r.delivered_at for r in receipts):
        return "delivered"
    return "sent"


def message_out(message: models.Message, client_id: str | None = None) -> MessageOut:
    reply = message.reply_to
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        kind=message.kind,
        body=message.body,
        created_at=message.created_at,
        expires_at=message.expires_at,
        reply_to=ReplyPreviewOut(
            id=reply.id, sender_id=reply.sender_id, body=reply.body,
            attachment_name=reply.attachment.file_name if reply.attachment else None,
        ) if reply else None,
        attachment=attachment_out(message.attachment) if message.attachment else None,
        reactions=[ReactionOut(user_id=r.user_id, emoji=r.emoji) for r in message.reactions],
        status=message_status(message),
        client_id=client_id,
    )


def conversation_out(
    conv: models.Conversation, last_message: models.Message | None, unread_count: int
) -> ConversationOut:
    return ConversationOut(
        id=conv.id,
        kind=conv.kind,
        title=conv.title,
        avatar_color=conv.avatar_color,
        disappearing_seconds=conv.disappearing_seconds,
        created_at=conv.created_at,
        last_message_at=conv.last_message_at,
        members=[MemberOut(user=user_out(m.user), role=m.role, joined_at=m.joined_at) for m in conv.members],
        last_message=message_out(last_message) if last_message else None,
        unread_count=unread_count,
    )
