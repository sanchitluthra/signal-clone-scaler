"""Fill an empty database with demo users, contacts, chats and messages.

    python -m app.seed           # seed if empty
    python -m app.seed --reset   # wipe everything and seed again

Every demo account logs in with its phone number and the code 123456.
"""
import sys
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine
from .models import utcnow

USERS = [
    # phone,          display name,    username, about,                      avatar color
    ("+15550000001", "Aarav Mehta", "aarav", "Building things ✨", "A110"),
    ("+15550000002", "Priya Sharma", "priya", "Coffee first ☕", "A170"),
    ("+15550000003", "Rohan Verma", "rohan", "Probably on a trail 🏔️", "A130"),
    ("+15550000004", "Meera Iyer", "meera", "Design is how it works", "A150"),
    ("+15550000005", "Kabir Singh", "kabir", "", "A180"),
    ("+15550000006", "Ananya Rao", "ananya", "Signal me 💬", "A120"),
    ("+15550000007", "Dev Patel", "dev", "Shipping on Fridays", "A140"),
    ("+15550000008", "Sara Khan", "sara", "Reading 📚", "A160"),
]

# Each chat is a script of (sender username, text, minutes ago[, extras]).
# extras: {"reply": index of an earlier line, "react": {username: emoji}}
DIRECT_CHATS = [
    ("aarav", "rohan", 0, [
        ("rohan", "Bro the photos from the trek came out insane", 1500),
        ("aarav", "Send them!!", 1495),
        ("rohan", "Uploading to the shared album now", 1490),
        ("aarav", "That sunrise one is going on my wall", 1440, {"react": {"rohan": "😂"}}),
        ("rohan", "Haha told you the 4am start was worth it", 1438),
    ]),
    ("aarav", "meera", 1, [
        ("meera", "Can you review the new onboarding flow before standup?", 3000),
        ("aarav", "On it. The OTP screen looks clean", 2990),
        ("meera", "I moved the country code picker to the left", 2985),
        ("aarav", "Much better. Ship it 🚀", 2980, {"reply": 2, "react": {"meera": "❤️"}}),
        ("aarav", "Also left a few comments on the profile step", 2900),
    ]),
    ("aarav", "kabir", 0, [
        ("kabir", "Did you get the tickets?", 10080),
        ("aarav", "Yep, row F. See you Saturday", 10070),
        ("kabir", "Legend", 10065),
    ]),
]

GROUP_CHATS = [
    ("Weekend Trek 🏕️", "A130", "aarav", ["rohan", "priya", "kabir"], 3, [
        ("rohan", "Weather looks clear for Saturday ☀️", 180),
        ("priya", "Finally! Who's driving?", 175),
        ("aarav", "I can take 4 people", 170, {"react": {"priya": "❤️", "rohan": "👍"}}),
        ("kabir", "I'll bring snacks and the first aid kit", 60),
        ("rohan", "Meet at 5:30am at the usual spot", 35),
        ("priya", "5:30 😭", 34, {"reply": 4}),
        ("kabir", "Sunrise waits for no one", 30),
    ]),
    ("Product Team", "A150", "meera", ["aarav", "ananya", "dev"], 0, [
        ("meera", "Standup moved to 10:30 today", 400),
        ("dev", "Deploy is green ✅", 380, {"react": {"meera": "👍", "aarav": "👍"}}),
        ("ananya", "Nice! I'll start QA on the new chat list", 375),
        ("aarav", "Read receipts are live on staging, please try them", 360),
        ("ananya", "Double checks working on my side", 350, {"reply": 3}),
    ]),
]


def _add_script(db: Session, conv: models.Conversation, users: dict, script: list, unread_tail: int) -> None:
    """Insert scripted messages. The last `unread_tail` lines are delivered but not yet read."""
    now = utcnow()
    member_ids = [m.user_id for m in conv.members]
    created: list[models.Message] = []
    for index, line in enumerate(script):
        sender_name, text, minutes_ago, *rest = line
        extras = rest[0] if rest else {}
        sender = users[sender_name]
        sent_at = now - timedelta(minutes=minutes_ago)
        read = index < len(script) - unread_tail

        message = models.Message(
            conversation_id=conv.id,
            sender_id=sender.id,
            body=text,
            created_at=sent_at,
            reply_to_id=created[extras["reply"]].id if "reply" in extras else None,
        )
        message.receipts = [
            models.MessageReceipt(
                user_id=uid,
                delivered_at=sent_at + timedelta(seconds=2),
                read_at=sent_at + timedelta(minutes=1) if read else None,
            )
            for uid in member_ids
            if uid != sender.id
        ]
        message.reactions = [
            models.Reaction(user_id=users[name].id, emoji=emoji) for name, emoji in extras.get("react", {}).items()
        ]
        db.add(message)
        db.flush()
        created.append(message)
        conv.last_message_at = sent_at


def seed(db: Session) -> None:
    users = {}
    for phone, name, username, about, color in USERS:
        users[username] = models.User(
            phone=phone, display_name=name, username=username, about=about, avatar_color=color,
            last_seen_at=utcnow() - timedelta(minutes=len(users) * 17),
        )
        db.add(users[username])
    db.flush()

    # Everyone knows everyone, except Aarav doesn't have Sara yet (to demo "Add contact" with @sara).
    for owner in users.values():
        for other in users.values():
            if owner is not other and {owner.username, other.username} != {"aarav", "sara"}:
                db.add(models.Contact(owner_id=owner.id, contact_user_id=other.id))

    for a, b, unread_tail, script in DIRECT_CHATS:
        low, high = sorted((users[a].id, users[b].id))
        conv = models.Conversation(kind="direct", direct_key=f"{low}:{high}", created_by_id=users[a].id)
        conv.members = [models.ConversationMember(user_id=users[u].id) for u in (a, b)]
        db.add(conv)
        db.flush()
        _add_script(db, conv, users, script, unread_tail)

    for title, color, admin, members, unread_tail, script in GROUP_CHATS:
        conv = models.Conversation(kind="group", title=title, avatar_color=color, created_by_id=users[admin].id)
        conv.members = [models.ConversationMember(user_id=users[admin].id, role="admin")] + [
            models.ConversationMember(user_id=users[u].id) for u in members
        ]
        db.add(conv)
        db.flush()
        _add_script(db, conv, users, script, unread_tail)

    # Aarav's "Note to Self" (a direct chat with only one member).
    me = users["aarav"]
    note = models.Conversation(kind="direct", direct_key=f"{me.id}:{me.id}", created_by_id=me.id)
    note.members = [models.ConversationMember(user_id=me.id)]
    db.add(note)
    db.flush()
    _add_script(db, note, users, [("aarav", "Passport renewal — book appointment", 4000),
                                  ("aarav", "Wifi password at the cabin: trailmix2024", 2500)], 0)
    db.commit()


def seed_if_empty() -> bool:
    with SessionLocal() as db:
        if db.scalar(select(models.User.id).limit(1)) is not None:
            return False
        seed(db)
        return True


if __name__ == "__main__":
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("Seeded demo data." if seed_if_empty() else "Database already has data (use --reset to start over).")
