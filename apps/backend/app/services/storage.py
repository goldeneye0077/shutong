from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings


def save_upload(upload: UploadFile) -> str:
    upload_dir = Path(get_settings().storage_uploads_path)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4()}-{upload.filename or 'uploaded-config'}"
    target = upload_dir / filename
    with target.open("wb") as file:
        file.write(upload.file.read())
    return str(target)

