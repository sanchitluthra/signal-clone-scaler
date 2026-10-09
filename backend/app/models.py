"""Database schema (SQLAlchemy 2.0 ORM).

Tables
  users                 - registered accounts
  auth_sessions         - login tokens (one row per logged-in device)
  contacts              - a user's address book (owner -> contact user)
  conversations         - a direct chat or a group
  conversation_members  - who is in which conversation, and their role
  messages              - text / attachment / system messages
  message_receipts      - per-recipient delivered/read timestamps (drives the check marks + unread counts)
  reactions             - one emoji reaction per user per message
  attachments           - uploaded files referenced by messages or avatars
"""
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """All timestamps are stored as naive UTC (SQLite has no timezone type)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    username: Mapped[str | None] = mapped_column(String(32), unique=True)
    display_name: Mapped[str] = mapped_column(String(64), default="")
    about: Mapped[str] = mapped_column(String(140), default="")
    avatar_color: Mapped[str] = mapped_column(String(8), default="A110")  # one of Signal's avatar palettes
    avatar_url: Mapped[str | None] = mapped_column(String(255))
    last_seen_at: Mapped[datetime] = mapped_column(default=utcnow)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    user: Mapped[User] = relationship()


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id"),
        CheckConstraint("owner_id <> contact_user_id", name="no_self_contact"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    contact_user: Mapped[User] = relationship(foreign_keys=[contact_user_id])


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (CheckConstraint("kind IN ('direct', 'group')", name="valid_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    title: Mapped[str | None] = mapped_column(String(64))  # groups only; direct chats use the other user's name
    avatar_color: Mapped[str] = mapped_column(String(8), default="A120")
    # "smallerUserId:largerUserId" for direct chats. UNIQUE guarantees one direct chat per pair of users.
    direct_key: Mapped[str | None] = mapped_column(String(32), unique=True)
    disappearing_seconds: Mapped[int] = mapped_column(default=0)  # 0 = off
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_message_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)  # sorts the chat list

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", passive_deletes=True
    )


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (CheckConstraint("role IN ('admin', 'member')", name="valid_role"),)

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(10), default="member")
    joined_at: Mapped[datetime] = mapped_column(default=utcnow)

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    file_name: Mapped[str] = mapped_column(String(255))  # original name, shown in the UI
    storage_name: Mapped[str] = mapped_column(String(64), unique=True)  # random name on disk
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("kind IN ('text', 'system')", name="valid_message_kind"),
        Index("ix_messages_conversation_id_id", "conversation_id", "id"),  # paging through a chat
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # 'system' rows are timeline events ("Priya added Rohan"); the body holds the action and sender is the actor.
    kind: Mapped[str] = mapped_column(String(10), default="text")
    body: Mapped[str] = mapped_column(Text, default="")
    reply_to_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"))
    attachment_id: Mapped[int | None] = mapped_column(ForeignKey("attachments.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(index=True)  # set when disappearing messages are on

    sender: Mapped[User] = relationship()
    reply_to: Mapped["Message | None"] = relationship(remote_side=[id])
    attachment: Mapped[Attachment | None] = relationship()
    receipts: Mapped[list["MessageReceipt"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    reactions: Mapped[list["Reaction"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class MessageReceipt(Base):
    """One row per (message, recipient). NULL timestamps mean 'not yet'."""

    __tablename__ = "message_receipts"
    __table_args__ = (Index("ix_receipts_user_unread", "user_id", "read_at"),)

    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    delivered_at: Mapped[datetime | None]
    read_at: Mapped[datetime | None]


class Reaction(Base):
    __tablename__ = "reactions"

    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
