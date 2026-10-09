"""Conversation business logic: membership checks, direct/group creation, chat-list query."""
import random

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..presenters import conversation_out
from ..schemas import AVATAR_COLORS, ConversationOut, normalize_phone
from .messaging import MESSAGE_LOAD

MEMBERS_LOAD = selectinload(models.Conversation.members).selectinload(models.ConversationMember.user)


def load_conversation(db: Session, conversation_id: int) -> models.Conversation | None:
    return db.scalar(
        select(models.Conversation)
        .where(models.Conversation.id == conversation_id)
        .options(MEMBERS_LOAD)
        .execution_options(populate_existing=True)
    )


def require_member(
    db: Session, conversation_id: int, user: models.User
) -> tuple[models.Conversation, models.ConversationMember]:
    """Return the conversation and the caller's membership, or 404 (we don't reveal chats you're not in)."""
    conv = load_conversation(db, conversation_id)
    membership = next((m for m in conv.members if m.user_id == user.id), None) if conv else None
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv, membership


def require_group_admin(conv: models.Conversation, membership: models.ConversationMember) -> None:
    if conv.kind != "group":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only groups have admins")
    if membership.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only group admins can do this")


def get_or_create_direct(db: Session, me: models.User, other: models.User) -> models.Conversation:
    low, high = sorted((me.id, other.id))
    key = f"{low}:{high}"
    conv = db.scalar(select(models.Conversation).where(models.Conversation.direct_key == key))
    if conv is None:
        conv = models.Conversation(kind="direct", direct_key=key, created_by_id=me.id)
        conv.members = [models.ConversationMember(user_id=uid, role="member") for uid in {me.id, other.id}]
        db.add(conv)
        db.commit()
    return load_conversation(db, conv.id)


def create_group(db: Session, creator: models.User, title: str, member_ids: list[int]) -> models.Conversation:
    conv = models.Conversation(
        kind="group", title=title.strip(), created_by_id=creator.id, avatar_color=random.choice(AVATAR_COLORS)
    )
    conv.members = [models.ConversationMember(user_id=creator.id, role="admin")] + [
        models.ConversationMember(user_id=uid, role="member") for uid in set(member_ids) - {creator.id}
    ]
    db.add(conv)
    db.commit()
    return load_conversation(db, conv.id)


def existing_user_ids(db: Session, user_ids: list[int]) -> set[int]:
    found = set(db.scalars(select(models.User.id).where(models.User.id.in_(user_ids))).all())
    if missing := set(user_ids) - found:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown user ids: {sorted(missing)}")
    return found


def list_conversations(db: Session, user: models.User, only_id: int | None = None) -> list[ConversationOut]:
    """The chat list, newest activity first. Uses 3 queries total regardless of how many chats there are."""
    query = (
        select(models.Conversation)
        .join(models.ConversationMember)
        .where(models.ConversationMember.user_id == user.id)
        .options(MEMBERS_LOAD)
        .order_by(models.Conversation.last_message_at.desc())
    )
    if only_id is not None:
        query = query.where(models.Conversation.id == only_id)
    conversations = db.scalars(query.execution_options(populate_existing=True)).all()
    ids = [c.id for c in conversations]

    # 1) latest message of each conversation
    latest_ids = (
        select(func.max(models.Message.id))
        .where(models.Message.conversation_id.in_(ids))
        .group_by(models.Message.conversation_id)
    )
    latest = {
        m.conversation_id: m
        for m in db.scalars(select(models.Message).where(models.Message.id.in_(latest_ids)).options(*MESSAGE_LOAD))
    }

    # 2) my unread receipts per conversation
    unread = dict(
        db.execute(
            select(models.Message.conversation_id, func.count())
            .join(models.MessageReceipt, models.MessageReceipt.message_id == models.Message.id)
            .where(
                models.MessageReceipt.user_id == user.id,
                models.MessageReceipt.read_at.is_(None),
                models.Message.conversation_id.in_(ids),
            )
            .group_by(models.Message.conversation_id)
        ).all()
    )

    return [
        conversation_out(c, latest.get(c.id), unread.get(c.id, 0))
        for c in conversations
        # an empty direct chat only shows up for the person who opened it
        if c.kind == "group" or c.id in latest or c.created_by_id == user.id or c.id == only_id
    ]


def get_conversation_view(db: Session, user: models.User, conversation_id: int) -> ConversationOut:
    result = list_conversations(db, user, only_id=conversation_id)
    if not result:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return result[0]


def related_user_ids(db: Session, user_id: int) -> set[int]:
    """People who should see this user's presence/profile changes: chat partners and anyone who saved them."""
    my_conversations = select(models.ConversationMember.conversation_id).where(
        models.ConversationMember.user_id == user_id
    )
    ids = set(
        db.scalars(
            select(models.ConversationMember.user_id).where(
                models.ConversationMember.conversation_id.in_(my_conversations)
            )
        ).all()
    )
    ids |= set(
        db.scalars(select(models.Contact.owner_id).where(models.Contact.contact_user_id == user_id)).all()
    )
    ids.discard(user_id)
    return ids


def find_user_by_phone_or_username(db: Session, query: str) -> models.User | None:
    query = query.strip()
    conditions = [models.User.username == query.lstrip("@").lower()]
    try:
        conditions.append(models.User.phone == normalize_phone(query))
    except ValueError:
        pass
    return db.scalar(select(models.User).where(or_(*conditions)))
