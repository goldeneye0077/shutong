from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(default="sqlite+pysqlite:///./data_service.db", validation_alias="DATABASE_URL")
    poll_interval_seconds: int = Field(default=5, validation_alias="DATA_SERVICE_POLL_INTERVAL")
    batch_size: int = Field(default=10, validation_alias="DATA_SERVICE_BATCH_SIZE")
    enable_background_worker: bool = Field(default=False, validation_alias="DATA_SERVICE_ENABLE_BACKGROUND_WORKER")
    worker_name: str = Field(default="data-service-worker", validation_alias="DATA_SERVICE_WORKER_NAME")
    storage_uploads_path: str = Field(default="/workspace/storage/uploads", validation_alias="STORAGE_UPLOADS_PATH")
    storage_exports_path: str = Field(default="/workspace/storage/exports", validation_alias="STORAGE_EXPORTS_PATH")


@lru_cache
def get_settings() -> Settings:
    return Settings()
