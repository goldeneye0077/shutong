from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str | None
    is_active: bool
    role_id: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenBundle(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserRead

