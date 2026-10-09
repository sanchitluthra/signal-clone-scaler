"""The user's address book."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..presenters import user_out
from ..schemas import ContactIn, ContactOut
from ..services.conversations import find_user_by_phone_or_username

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def contact_out(c: models.Contact) -> ContactOut:
    return ContactOut(user=user_out(c.contact_user), added_at=c.created_at)


@router.get("", response_model=list[ContactOut])
def list_contacts(me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contacts = db.scalars(
        select(models.Contact)
        .join(models.User, models.User.id == models.Contact.contact_user_id)
        .where(models.Contact.owner_id == me.id)
        .options(joinedload(models.Contact.contact_user))
        .order_by(func.lower(models.User.display_name))
    ).all()
    return [contact_out(c) for c in contacts]


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def add_contact(data: ContactIn, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Find a Signal user by phone number or @username and save them."""
    other = find_user_by_phone_or_username(db, data.query)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No Signal user found with that number or username")
    if other.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't add yourself as a contact")
    exists = db.scalar(
        select(models.Contact).where(models.Contact.owner_id == me.id, models.Contact.contact_user_id == other.id)
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{other.display_name or other.phone} is already a contact")

    contact = models.Contact(owner_id=me.id, contact_user_id=other.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact_out(contact)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(user_id: int, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.scalar(
        select(models.Contact).where(models.Contact.owner_id == me.id, models.Contact.contact_user_id == user_id)
    )
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    db.delete(contact)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
