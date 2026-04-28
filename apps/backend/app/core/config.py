from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="核心网配置合规后端", validation_alias="BACKEND_APP_NAME")
    database_url: str = Field(default="sqlite+pysqlite:///./backend.db", validation_alias="DATABASE_URL")
    secret_key: str = Field(default="change-me", validation_alias="BACKEND_SECRET_KEY")
    access_token_expire_minutes: int = Field(default=480, validation_alias="BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, validation_alias="BACKEND_REFRESH_TOKEN_EXPIRE_DAYS")
    storage_uploads_path: str = Field(default="/workspace/storage/uploads", validation_alias="STORAGE_UPLOADS_PATH")
    bootstrap_admin_username: str = Field(default="admin", validation_alias="BACKEND_BOOTSTRAP_ADMIN_USERNAME")
    bootstrap_admin_password: str = Field(default="admin123", validation_alias="BACKEND_BOOTSTRAP_ADMIN_PASSWORD")
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="BACKEND_CORS_ORIGINS",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
