from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.entities import Role, User


def bootstrap_defaults(db: Session) -> None:
    settings = get_settings()
    role_names = ["admin", "operator", "reviewer", "auditor"]
    existing_roles = {
        role.name: role for role in db.execute(select(Role).where(Role.name.in_(role_names))).scalars().all()
    }

    for role_name in role_names:
        if role_name not in existing_roles:
            role = Role(name=role_name, description=f"Default {role_name} role")
            db.add(role)
            existing_roles[role_name] = role

    db.flush()

    admin_user = db.execute(
        select(User).where(User.username == settings.bootstrap_admin_username)
    ).scalar_one_or_none()
    if not admin_user:
        db.add(
            User(
                username=settings.bootstrap_admin_username,
                full_name="Bootstrap Admin",
                hashed_password=hash_password(settings.bootstrap_admin_password),
                role_id=existing_roles["admin"].id,
                is_active=True,
            )
        )
    db.commit()

