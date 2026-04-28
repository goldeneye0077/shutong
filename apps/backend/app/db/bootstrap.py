from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.entities import Role, User


def bootstrap_defaults(db: Session) -> None:
    settings = get_settings()
    role_names = ["admin", "operator", "reviewer", "auditor"]
    role_descriptions = {
        "admin": "默认管理员角色",
        "operator": "默认操作员角色",
        "reviewer": "默认复核员角色",
        "auditor": "默认审计员角色",
    }
    role_permissions = {
        "admin": ["*"],
        "operator": [
            "dashboard:read",
            "assets:*",
            "configs:*",
            "rules:read",
            "inspections:*",
            "findings:read",
            "tickets:*",
            "exceptions:*",
            "reports:*",
            "notifications:*",
            "ledgers:*",
            "schedules:*",
            "logs:*",
            "jobs:*",
        ],
        "reviewer": [
            "dashboard:read",
            "rules:*",
            "findings:read",
            "tickets:*",
            "tickets:review",
            "exceptions:*",
            "exceptions:review",
            "reports:*",
            "audit:read",
            "notifications:*",
            "logs:*",
            "templates:*",
            "ai:review",
        ],
        "auditor": ["dashboard:read", "findings:read", "reports:*", "audit:read"],
    }
    role_menus = {
        "admin": ["dashboard", "assets", "rules", "workflow", "reports", "audit", "platform"],
        "operator": ["dashboard", "assets", "rules", "workflow", "reports"],
        "reviewer": ["dashboard", "rules", "workflow", "reports", "audit"],
        "auditor": ["dashboard", "reports", "audit"],
    }
    existing_roles = {
        role.name: role for role in db.execute(select(Role).where(Role.name.in_(role_names))).scalars().all()
    }

    for role_name in role_names:
        if role_name not in existing_roles:
            role = Role(name=role_name, description=role_descriptions[role_name])
            db.add(role)
            existing_roles[role_name] = role
        role = existing_roles[role_name]
        existing_permissions = set(role.permissions or [])
        if "*" not in existing_permissions:
            role.permissions = sorted(existing_permissions | set(role_permissions[role_name]))
        elif not role.permissions:
            role.permissions = role_permissions[role_name]
        existing_menu_items = set(role.menu_items or [])
        role.menu_items = sorted(existing_menu_items | set(role_menus[role_name]))
        db.add(role)

    db.flush()

    admin_user = db.execute(
        select(User).where(User.username == settings.bootstrap_admin_username)
    ).scalar_one_or_none()
    if not admin_user:
        db.add(
            User(
                username=settings.bootstrap_admin_username,
                full_name="管理员",
                hashed_password=hash_password(settings.bootstrap_admin_password),
                role_id=existing_roles["admin"].id,
                is_active=True,
            )
        )
    elif admin_user.full_name == "Bootstrap Admin":
        admin_user.full_name = "管理员"
        db.add(admin_user)
    db.commit()
