from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.base import Base


def _connect_args(database_url: str) -> dict:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


settings = get_settings()
engine = create_engine(settings.database_url, future=True, connect_args=_connect_args(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def configure_database(database_url: str) -> None:
    global engine, SessionLocal
    engine = create_engine(database_url, future=True, connect_args=_connect_args(database_url))
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_database() -> None:
    from app.db.bootstrap import bootstrap_defaults

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        bootstrap_defaults(session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

