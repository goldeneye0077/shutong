from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

metadata = MetaData()


class Base(DeclarativeBase):
    metadata = metadata


def generate_uuid() -> str:
    return str(uuid.uuid4())


class UUIDPrimaryKeyMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

