"""Shared FastAPI dependencies."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db

# HTTPBearer also adds the "Authorize" button to the /docs page.
bearer_scheme = HTTPBearer(auto_error=False)


def user_from_token(db: Session, token: str | None) -> models.User | None:
    if not token:
        return None
    session = db.get(models.AuthSession, token)
    return session.user if session else None


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    user = user_from_token(db, creds.credentials if creds else None)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    return user
