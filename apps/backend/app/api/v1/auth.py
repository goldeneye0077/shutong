from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenBundle, UserRead
from app.services.audit import record_audit
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenBundle)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenBundle:
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
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
        user=UserRead.model_validate(user),
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
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
