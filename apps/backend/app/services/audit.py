from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import AuditEvent


def record_audit(
    db: Session,
    *,
    actor_user_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    db.add(event)
    db.flush()
    return event

