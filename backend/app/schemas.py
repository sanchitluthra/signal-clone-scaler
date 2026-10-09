"""Pydantic request/response models. These define the public shape of the REST API."""
import re
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, field_validator, model_validator

# Stored datetimes are naive UTC; send them to the browser as ISO strings ending in "Z".
UTCDateTime = Annotated[
    datetime,
    PlainSerializer(lambda d: d.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"), return_type=str),
]

AVATAR_COLORS = [f"A{n}" for n in range(100, 220, 10)]  # A100 ... A210, Signal's avatar palette names
USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,31}$")


def normalize_phone(raw: str) -> str:
    """'+91 98765-43210' -> '+919876543210'. Raises ValueError if it does not look like a phone number."""
    digits = re.sub(r"[\s\-().]", "", raw)
    if not digits.startswith("+"):
        digits = "+" + digits
    if not re.fullmatch(r"\+\d{7,15}", digits):
        raise ValueError("Enter a valid phone number with country code")
    return digits


# ---------- auth ----------
class PhoneIn(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class VerifyIn(PhoneIn):
    code: str = Field(min_length=6, max_length=6)


class OtpRequestOut(BaseModel):
    phone: str
    is_registered: bool


# ---------- users ----------
class UserOut(BaseModel):
    id: int
    phone: str
    username: str | None
    display_name: str
    about: str
    avatar_color: str
    avatar_url: str | None
    is_online: bool = False
    last_seen_at: UTCDateTime


class AuthOut(BaseModel):
    token: str
    user: UserOut
    is_new_user: bool


class ProfileUpdateIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    about: str | None = Field(default=None, max_length=140)
    username: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None

    @field_validator("username")
    @classmethod
    def _username(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        v = v.lstrip("@").lower()
        if not USERNAME_RE.fullmatch(v):
            raise ValueError("Usernames are 3-32 characters: letters, numbers and _ , starting with a letter")
        return v

    @field_validator("avatar_color")
    @classmethod
    def _color(cls, v: str | None) -> str | None:
        if v is not None and v not in AVATAR_COLORS:
            raise ValueError("Unknown avatar color")
        return v


# ---------- contacts ----------
class ContactIn(BaseModel):
    query: str = Field(min_length=3, description="Phone number or @username")


class ContactOut(BaseModel):
    user: UserOut
    added_at: UTCDateTime


# ---------- messages ----------
class AttachmentOut(BaseModel):
    id: int
    file_name: str
    content_type: str
    size_bytes: int
    url: str


class ReactionOut(BaseModel):
    user_id: int
    emoji: str


class ReplyPreviewOut(BaseModel):
    id: int
    sender_id: int
    body: str
    attachment_name: str | None


MessageStatus = Literal["sent", "delivered", "read"]


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    kind: Literal["text", "system"]
    body: str
    created_at: UTCDateTime
    expires_at: UTCDateTime | None
    reply_to: ReplyPreviewOut | None
    attachment: AttachmentOut | None
    reactions: list[ReactionOut]
    status: MessageStatus
    client_id: str | None = None  # echoed back so the sender can swap its optimistic "sending" bubble


class MessageIn(BaseModel):
    body: str = Field(default="", max_length=4000)
    reply_to_id: int | None = None
    attachment_id: int | None = None
    client_id: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def _not_empty(self):
        self.body = self.body.strip()
        if not self.body and self.attachment_id is None:
            raise ValueError("Message must contain text or an attachment")
        return self


class ReadIn(BaseModel):
    up_to_message_id: int


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


# ---------- conversations ----------
class MemberOut(BaseModel):
    user: UserOut
    role: Literal["admin", "member"]
    joined_at: UTCDateTime


class ConversationOut(BaseModel):
    id: int
    kind: Literal["direct", "group"]
    title: str | None
    avatar_color: str
    disappearing_seconds: int
    created_at: UTCDateTime
    last_message_at: UTCDateTime
    members: list[MemberOut]
    last_message: MessageOut | None
    unread_count: int


class DirectIn(BaseModel):
    user_id: int


class GroupIn(BaseModel):
    title: str = Field(min_length=1, max_length=64)
    member_ids: list[int] = Field(min_length=1)


DISAPPEARING_OPTIONS = {0, 30, 300, 3600, 28800, 86400, 604800}  # off, 30s, 5m, 1h, 8h, 1d, 1w


class ConversationUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=64)
    disappearing_seconds: int | None = None

    @field_validator("disappearing_seconds")
    @classmethod
    def _timer(cls, v: int | None) -> int | None:
        if v is not None and v not in DISAPPEARING_OPTIONS:
            raise ValueError("Unsupported disappearing message timer")
        return v


class MembersIn(BaseModel):
    user_ids: list[int] = Field(min_length=1)


class RoleIn(BaseModel):
    role: Literal["admin", "member"]
