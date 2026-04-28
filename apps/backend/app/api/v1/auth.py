from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.core.permissions import permission_matrix
from app.db.session import get_db
from app.models.entities import Role, User
from app.schemas.auth import LoginRequest, PermissionMatrixRead, RefreshRequest, RoleRead, RoleUpdate, TokenBundle, UserCreate, UserRead, UserUpdate
from app.services.audit import record_audit
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def build_user_read(user: User) -> UserRead:
    role = user.role
    return UserRead(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        role_id=user.role_id,
        role_name=role.name if role else None,
        permissions=role.permissions if role else [],
        menu_items=role.menu_items if role else [],
    )


@router.post("/login", response_model=TokenBundle)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenBundle:
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    record_audit(
        db,
        actor_user_id=user.id,
        action="auth.login",
        resource_type="user",
        resource_id=user.id,
        details={"username": user.username},
    )
    db.commit()
    return TokenBundle(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        token_type="bearer",
        user=build_user_read(user),
    )


@router.post("/refresh", response_model=TokenBundle)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenBundle:
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效") from exc

    user = db.get(User, claims["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户已停用")

    return TokenBundle(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        token_type="bearer",
        user=build_user_read(user),
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return build_user_read(current_user)


@router.get("/roles", response_model=list[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("roles:*")),
):
    return db.execute(select(Role).order_by(Role.name.asc())).scalars().all()


@router.get("/permission-matrix", response_model=PermissionMatrixRead)
def get_permission_matrix(
    _: User = Depends(require_permissions("roles:*")),
) -> PermissionMatrixRead:
    return PermissionMatrixRead(**permission_matrix())


@router.patch("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: str,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("roles:*")),
):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(role, key, value)
    db.add(role)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="role.update",
        resource_type="role",
        resource_id=role.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(role)
    return role


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("users:*")),
):
    return [build_user_read(user) for user in db.execute(select(User).order_by(User.created_at.desc())).scalars().all()]


@router.post("/users", response_model=UserRead)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("users:*")),
):
    if db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if not db.get(Role, payload.role_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role_id=payload.role_id,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="user.create",
        resource_type="user",
        resource_id=user.id,
        details={"username": user.username, "role_id": user.role_id},
    )
    db.commit()
    db.refresh(user)
    return build_user_read(user)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("users:*")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    changes = payload.model_dump(exclude_unset=True)
    if "password" in changes:
        password = changes.pop("password")
        if password:
            user.hashed_password = hash_password(password)
    if "role_id" in changes and changes["role_id"] and not db.get(Role, changes["role_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    for key, value in changes.items():
        setattr(user, key, value)
    db.add(user)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="user.update",
        resource_type="user",
        resource_id=user.id,
        details={key: value for key, value in payload.model_dump(exclude_unset=True).items() if key != "password"},
    )
    db.commit()
    db.refresh(user)
    return build_user_read(user)
