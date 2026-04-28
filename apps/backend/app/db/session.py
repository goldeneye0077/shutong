from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
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
    _ensure_compat_columns()
    with SessionLocal() as session:
        bootstrap_defaults(session)


def _ensure_compat_columns() -> None:
    """Keep existing local demo databases usable until Alembic is adopted."""
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "roles" not in table_names:
        return
    dialect = engine.dialect.name
    json_type = "JSONB" if dialect == "postgresql" else "JSON"
    statements = []
    existing = {column["name"] for column in inspector.get_columns("roles")}
    if "permissions" not in existing:
        statements.append(f"ALTER TABLE roles ADD COLUMN permissions {json_type}")
    if "menu_items" not in existing:
        statements.append(f"ALTER TABLE roles ADD COLUMN menu_items {json_type}")
    if "tickets" in table_names:
        ticket_existing = {column["name"] for column in inspector.get_columns("tickets")}
        if "review_status" not in ticket_existing:
            statements.append("ALTER TABLE tickets ADD COLUMN review_status VARCHAR(50) DEFAULT 'not_submitted'")
        if "submitted_at" not in ticket_existing:
            statements.append("ALTER TABLE tickets ADD COLUMN submitted_at TIMESTAMP")
        if "reviewed_at" not in ticket_existing:
            statements.append("ALTER TABLE tickets ADD COLUMN reviewed_at TIMESTAMP")
        if "reviewed_by_id" not in ticket_existing:
            statements.append("ALTER TABLE tickets ADD COLUMN reviewed_by_id VARCHAR(36)")
        if "review_comment" not in ticket_existing:
            statements.append("ALTER TABLE tickets ADD COLUMN review_comment TEXT")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
