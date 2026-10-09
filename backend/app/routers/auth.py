"""Mocked phone-number registration / login (fixed OTP) and logout."""
import random
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..config import MOCK_OTP
from ..database import get_db
from ..deps import bearer_scheme
from ..presenters import user_out
from ..schemas import AVATAR_COLORS, AuthOut, OtpRequestOut, PhoneIn, VerifyIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/request-otp", response_model=OtpRequestOut)
def request_otp(data: PhoneIn, db: Session = Depends(get_db)):
    """Step 1. A real app would text a code here; ours always expects MOCK_OTP."""
    registered = db.scalar(select(models.User.id).where(models.User.phone == data.phone)) is not None
    return OtpRequestOut(phone=data.phone, is_registered=registered)


@router.post("/verify-otp", response_model=AuthOut)
def verify_otp(data: VerifyIn, db: Session = Depends(get_db)):
    """Step 2. Correct code -> log in (creating the account on first use) and return a session token."""
    if data.code != MOCK_OTP:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code")

    user = db.scalar(select(models.User).where(models.User.phone == data.phone))
    if user is None:
        user = models.User(phone=data.phone, avatar_color=random.choice(AVATAR_COLORS))
        db.add(user)
        db.flush()  # assigns user.id

    token = secrets.token_hex(32)
    db.add(models.AuthSession(token=token, user_id=user.id))
    db.commit()
    # A user without a name still has to finish profile setup (step 3 on the frontend).
    return AuthOut(token=token, user=user_out(user), is_new_user=not user.display_name)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)):
    if creds and (session := db.get(models.AuthSession, creds.credentials)):
        db.delete(session)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
