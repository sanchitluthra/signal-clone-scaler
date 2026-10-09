"""The logged-in user's own profile."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..presenters import user_out
from ..realtime import manager
from ..schemas import ProfileUpdateIn, UserOut
from ..services.conversations import related_user_ids

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(me: models.User = Depends(get_current_user)):
    return user_out(me)


@router.patch("/me", response_model=UserOut)
async def update_me(data: ProfileUpdateIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    changes = data.model_dump(exclude_unset=True)
    if changes.get("username"):
        taken = db.scalar(
            select(models.User.id).where(models.User.username == changes["username"], models.User.id != me.id)
        )
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken")
    if changes.get("username") == "":
        changes["username"] = None
    for field, value in changes.items():
        setattr(me, field, value)
    db.commit()

    # Everyone who can see this user gets the new name/avatar immediately.
    out = user_out(me)
    await manager.send_many(related_user_ids(db, me.id), {"type": "user_updated", "user": out.model_dump(mode="json")})
    return out
