from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import UTC, datetime, timedelta

from jose import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 390000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.b64encode(salt).decode("utf-8"),
        base64.b64encode(digest).decode("utf-8"),
    )


def verify_password(password: str, hashed_password: str) -> bool:
    algorithm, iterations, salt, digest = hashed_password.split("$", maxsplit=3)
    if algorithm != "pbkdf2_sha256":
        return False
    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        base64.b64decode(salt.encode("utf-8")),
        int(iterations),
    )
    return hmac.compare_digest(base64.b64encode(computed).decode("utf-8"), digest)


def _create_token(user_id: str, role_name: str, token_type: str, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "role": role_name,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(user) -> str:
    role_name = user.role.name if user.role else "operator"
    return _create_token(
        user.id,
        role_name,
        "access",
        timedelta(minutes=get_settings().access_token_expire_minutes),
    )


def create_refresh_token(user) -> str:
    role_name = user.role.name if user.role else "operator"
    return _create_token(
        user.id,
        role_name,
        "refresh",
        timedelta(days=get_settings().refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    if payload.get("type") != expected_type:
        raise ValueError("Unexpected token type")
    return payload

