"""File uploads used for message attachments and profile photos."""
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from .. import models
from ..config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from ..database import get_db
from ..deps import get_current_user
from ..presenters import attachment_out
from ..schemas import AttachmentOut

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


@router.post("", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile, me: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Files can be at most 10 MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty")

    # Store under a random name so user-supplied file names never touch the filesystem path.
    storage_name = uuid4().hex + Path(file.filename or "").suffix.lower()[:10]
    (UPLOAD_DIR / storage_name).write_bytes(data)

    attachment = models.Attachment(
        uploader_id=me.id,
        file_name=(file.filename or "file")[:255],
        storage_name=storage_name,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
    )
    db.add(attachment)
    db.commit()
    return attachment_out(attachment)
