from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.entities import AiAnalysisJob, Asset, ConfigFile, NormalizedConfig, ParseRun, User
from app.schemas.domain import (
    AiAnalysisJobRead,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    ConfigFileRead,
    NormalizedConfigRead,
    ParseRunRead,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job
from app.services.storage import save_upload

router = APIRouter()


@router.get("/assets", response_model=dict, tags=["assets"])
def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Asset).order_by(Asset.created_at.desc())
    count_stmt = select(func.count()).select_from(Asset)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Asset.name.ilike(pattern))
        count_stmt = count_stmt.where(Asset.name.ilike(pattern))

    total = db.scalar(count_stmt) or 0
    items = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    return {
        "items": [AssetRead.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "actor": current_user.username,
    }


@router.post("/assets", response_model=AssetRead, tags=["assets"])
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="asset.create",
        resource_type="asset",
        resource_id=asset.id,
        details={"name": asset.name, "asset_type": asset.asset_type},
    )
    db.commit()
    return asset


@router.get("/assets/{asset_id}", response_model=AssetRead, tags=["assets"])
def get_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.patch("/assets/{asset_id}", response_model=AssetRead, tags=["assets"])
def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)

    db.add(asset)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="asset.update",
        resource_type="asset",
        resource_id=asset.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/configs/upload", response_model=ConfigFileRead, tags=["configs"])
def upload_config(
    asset_id: str = Form(...),
    source: str = Form("manual"),
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    existing_versions = db.scalar(
        select(func.count()).select_from(ConfigFile).where(ConfigFile.asset_id == asset_id)
    ) or 0
    storage_path = save_upload(upload)
    checksum = hashlib.sha256(Path(storage_path).read_bytes()).hexdigest()

    config_file = ConfigFile(
        asset_id=asset_id,
        filename=upload.filename or "uploaded-config",
        storage_path=storage_path,
        version=existing_versions + 1,
        checksum=checksum,
        source=source,
        uploaded_by_id=current_user.id,
        processing_status="queued",
    )
    db.add(config_file)
    db.flush()
    enqueue_job(
        db,
        job_type="parse_config",
        payload={"config_file_id": config_file.id, "asset_id": asset_id},
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="config.upload",
        resource_type="config_file",
        resource_id=config_file.id,
        details={"asset_id": asset_id, "filename": config_file.filename},
    )
    db.commit()
    db.refresh(config_file)
    return config_file


@router.get("/configs", response_model=dict, tags=["configs"])
def list_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    asset_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(ConfigFile).order_by(ConfigFile.created_at.desc())
    count_stmt = select(func.count()).select_from(ConfigFile)
    if asset_id:
        stmt = stmt.where(ConfigFile.asset_id == asset_id)
        count_stmt = count_stmt.where(ConfigFile.asset_id == asset_id)

    total = db.scalar(count_stmt) or 0
    items = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    return {
        "items": [ConfigFileRead.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/configs/{config_id}", response_model=ConfigFileRead, tags=["configs"])
def get_config(
    config_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    config_file = db.get(ConfigFile, config_id)
    if not config_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config file not found")
    return config_file


@router.get("/configs/assets/{asset_id}/versions", response_model=list[ConfigFileRead], tags=["configs"])
def get_versions(
    asset_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.execute(
            select(ConfigFile)
            .where(ConfigFile.asset_id == asset_id)
            .order_by(ConfigFile.version.desc())
        )
        .scalars()
        .all()
    )


@router.get("/configs/{config_id}/parse-runs", response_model=list[ParseRunRead], tags=["configs"])
def list_parse_runs(
    config_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.execute(
            select(ParseRun)
            .where(ParseRun.config_file_id == config_id)
            .order_by(ParseRun.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/configs/{config_id}/normalized", response_model=list[NormalizedConfigRead], tags=["configs"])
def list_normalized_configs(
    config_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.execute(
            select(NormalizedConfig)
            .where(NormalizedConfig.config_file_id == config_id)
            .order_by(NormalizedConfig.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/configs/{config_id}/ai-summaries", response_model=list[AiAnalysisJobRead], tags=["configs"])
def list_config_ai_summaries(
    config_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.execute(
            select(AiAnalysisJob)
            .where(
                AiAnalysisJob.target_type == "config_file",
                AiAnalysisJob.target_id == config_id,
            )
            .order_by(AiAnalysisJob.created_at.desc())
        )
        .scalars()
        .all()
    )
