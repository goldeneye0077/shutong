from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str | None
    is_active: bool
    role_id: str
    role_name: str | None = None
    permissions: list[str] = Field(default_factory=list)
    menu_items: list[str] = Field(default_factory=list)


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    permissions: list[str]
    menu_items: list[str]


class PermissionDefinitionRead(BaseModel):
    key: str
    label: str
    group: str


class PermissionMatrixRead(BaseModel):
    menus: list[PermissionDefinitionRead]
    permissions: list[PermissionDefinitionRead]


class RoleUpdate(BaseModel):
    description: str | None = None
    permissions: list[str] | None = None
    menu_items: list[str] | None = None


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    role_id: str
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None
    role_id: str | None = None
    is_active: bool | None = None


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
