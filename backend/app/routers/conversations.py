"""Conversations: chat list, direct chats, groups and admin controls."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..realtime import manager
from ..schemas import ConversationOut, ConversationUpdateIn, DirectIn, GroupIn, MembersIn, ReadIn, RoleIn
from ..services import conversations as svc
from ..services.messaging import broadcast_new_message, create_message, mark_read, notify_receipt_changes

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

TIMER_LABELS = {30: "30 seconds", 300: "5 minutes", 3600: "1 hour", 28800: "8 hours", 86400: "1 day", 604800: "1 week"}


def display(user: models.User) -> str:
    return user.display_name or user.phone


async def post_system_event(db: Session, conv: models.Conversation, actor: models.User, action: str) -> None:
    """Add a timeline row like '<actor> changed the group name to ...' and push it to members."""
    message = create_message(db, conv, actor, action, kind="system")
    await broadcast_new_message(db, conv, message)


async def notify_changed(conv: models.Conversation) -> None:
    """Members refetch the conversation (title, members, timer...) when they get this event."""
    await manager.send_many(
        [m.user_id for m in conv.members], {"type": "conversation_changed", "conversation_id": conv.id}
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_conversations(db, me)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.require_member(db, conversation_id, me)
    return svc.get_conversation_view(db, me, conversation_id)


@router.post("/direct", response_model=ConversationOut)
def open_direct(data: DirectIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the 1:1 chat with a user, creating it the first time. Chatting with yourself = 'Note to Self'."""
    other = db.get(models.User, data.user_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    conv = svc.get_or_create_direct(db, me, other)
    return svc.get_conversation_view(db, me, conv.id)


@router.post("/group", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_group(data: GroupIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.existing_user_ids(db, data.member_ids)
    conv = svc.create_group(db, me, data.title, data.member_ids)
    await post_system_event(db, conv, me, "created the group")
    return svc.get_conversation_view(db, me, conv.id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdateIn,
    me: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv, membership = svc.require_member(db, conversation_id, me)

    if data.title is not None and data.title.strip() != conv.title:
        svc.require_group_admin(conv, membership)
        conv.title = data.title.strip()
        db.commit()
        await post_system_event(db, conv, me, f'changed the group name to "{conv.title}"')

    # Like Signal, any member may change the disappearing-message timer.
    if data.disappearing_seconds is not None and data.disappearing_seconds != conv.disappearing_seconds:
        conv.disappearing_seconds = data.disappearing_seconds
        db.commit()
        action = (
            f"set the disappearing message timer to {TIMER_LABELS[conv.disappearing_seconds]}"
            if conv.disappearing_seconds
            else "turned off disappearing messages"
        )
        await post_system_event(db, conv, me, action)

    await notify_changed(conv)
    return svc.get_conversation_view(db, me, conv.id)


@router.post("/{conversation_id}/members", response_model=ConversationOut)
async def add_members(
    conversation_id: int, data: MembersIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    conv, membership = svc.require_member(db, conversation_id, me)
    svc.require_group_admin(conv, membership)

    current = {m.user_id for m in conv.members}
    new_ids = svc.existing_user_ids(db, data.user_ids) - current
    if not new_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Those people are already in the group")
    for uid in new_ids:
        conv.members.append(models.ConversationMember(user_id=uid, role="member"))
    db.commit()

    conv = svc.load_conversation(db, conv.id)
    names = ", ".join(display(m.user) for m in conv.members if m.user_id in new_ids)
    await post_system_event(db, conv, me, f"added {names}")
    await notify_changed(conv)
    return svc.get_conversation_view(db, me, conv.id)


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: int, user_id: int, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Admins remove others; anyone can remove themselves (= leave the group)."""
    conv, membership = svc.require_member(db, conversation_id, me)
    leaving = user_id == me.id
    if conv.kind != "group":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove people from a direct chat")
    if not leaving:
        svc.require_group_admin(conv, membership)
    target = next((m for m in conv.members if m.user_id == user_id), None)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person is not in this group")

    await post_system_event(db, conv, me, "left the group" if leaving else f"removed {display(target.user)}")
    conv.members.remove(target)

    # A group should never be left without an admin: promote the longest-standing member.
    remaining = sorted(conv.members, key=lambda m: m.joined_at)
    if remaining and not any(m.role == "admin" for m in remaining):
        remaining[0].role = "admin"
    if not remaining:
        db.delete(conv)
    db.commit()

    await manager.send(user_id, {"type": "conversation_removed", "conversation_id": conversation_id})
    if remaining:
        await notify_changed(conv)


@router.patch("/{conversation_id}/members/{user_id}", response_model=ConversationOut)
async def change_role(
    conversation_id: int,
    user_id: int,
    data: RoleIn,
    me: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv, membership = svc.require_member(db, conversation_id, me)
    svc.require_group_admin(conv, membership)
    target = next((m for m in conv.members if m.user_id == user_id), None)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person is not in this group")
    if target.role == data.role:
        return svc.get_conversation_view(db, me, conv.id)
    if data.role == "member" and sum(m.role == "admin" for m in conv.members) == 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A group needs at least one admin")

    target.role = data.role
    db.commit()
    action = f"made {display(target.user)} an admin" if data.role == "admin" else f"removed {display(target.user)} as admin"
    await post_system_event(db, conv, me, action)
    await notify_changed(conv)
    return svc.get_conversation_view(db, me, conv.id)


@router.post("/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: int, data: ReadIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Called by the client when the user is looking at the chat. Turns the sender's checks to 'read'."""
    svc.require_member(db, conversation_id, me)
    changed = mark_read(db, me.id, conversation_id, data.up_to_message_id)
    await notify_receipt_changes(db, changed)
    return {"marked_read": len(changed)}
