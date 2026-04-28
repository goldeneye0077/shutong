from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.entities import AiAnalysisJob, Asset, ConfigFile, NormalizedConfig, ParseRun, User
from app.schemas.domain import (
    AiAnalysisJobRead,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    ConfigFileRead,
    NormalizedConfigRead,
    NormalizedConfigSearchItem,
    ParseRunRead,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job
from app.services.storage import save_upload

router = APIRouter()


def _normalized_search_blob(normalized: NormalizedConfig) -> str:
    return json.dumps(
        {
            "hostname": normalized.hostname,
            "summary": normalized.summary or {},
            "indicators": normalized.indicators or {},
        },
        ensure_ascii=False,
        default=str,
    ).lower()


def _extract_matched_sections(normalized: NormalizedConfig, keyword: str | None, section: str | None) -> tuple[list[str], list[str]]:
    summary = normalized.summary or {}
    indicators = normalized.indicators or {}
    section_candidates: dict[str, object] = {
        "hostname": normalized.hostname,
        "interfaces": indicators.get("interface_names") or summary.get("interface_names"),
        "acl": indicators.get("acl_lines") or summary.get("acl_lines"),
        "warnings": indicators.get("warnings") or summary.get("warnings"),
        "keywords": indicators.get("keywords"),
        "summary": summary,
        "indicators": indicators,
    }
    keyword_lower = keyword.lower() if keyword else None
    section_lower = section.lower() if section else None
    matched_sections: list[str] = []
    matched_content: list[str] = []

    for section_name, value in section_candidates.items():
        if section_lower and section_lower not in section_name.lower():
            continue
        value_text = json.dumps(value, ensure_ascii=False, default=str)
        if keyword_lower and keyword_lower not in value_text.lower():
            continue
        if value in (None, [], {}, ""):
            continue
        matched_sections.append(section_name)
        if isinstance(value, list):
            matched_content.extend(str(item) for item in value[:5])
        else:
            matched_content.append(str(value)[:500])

    if not matched_sections and not keyword_lower and not section_lower:
        matched_sections.append("summary")
        matched_content.append(json.dumps(summary, ensure_ascii=False, default=str)[:500])

    return matched_sections, matched_content[:10]


@router.get("/assets", response_model=dict, tags=["assets"])
def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    asset_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Asset).order_by(Asset.created_at.desc())
    count_stmt = select(func.count()).select_from(Asset)
    if not include_deleted:
        stmt = stmt.where(Asset.status != "deleted")
        count_stmt = count_stmt.where(Asset.status != "deleted")
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Asset.name.ilike(pattern))
        count_stmt = count_stmt.where(Asset.name.ilike(pattern))
    if asset_type:
        stmt = stmt.where(Asset.asset_type == asset_type)
        count_stmt = count_stmt.where(Asset.asset_type == asset_type)
    if status_filter:
        stmt = stmt.where(Asset.status == status_filter)
        count_stmt = count_stmt.where(Asset.status == status_filter)

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
    current_user: User = Depends(require_permissions("assets:*")),
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
    current_user: User = Depends(require_permissions("assets:*")),
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


@router.delete("/assets/{asset_id}", response_model=AssetRead, tags=["assets"])
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("assets:*")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    asset.status = "deleted"
    db.add(asset)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="asset.delete",
        resource_type="asset",
        resource_id=asset.id,
        details={"name": asset.name, "soft_delete": True},
    )
    db.commit()
    db.refresh(asset)
    return asset


def _create_config_file(
    *,
    db: Session,
    asset_id: str,
    source: str,
    upload: UploadFile,
    uploaded_by_id: str,
    version: int,
) -> ConfigFile:
    storage_path = save_upload(upload)
    checksum = hashlib.sha256(Path(storage_path).read_bytes()).hexdigest()

    config_file = ConfigFile(
        asset_id=asset_id,
        filename=upload.filename or "uploaded-config",
        storage_path=storage_path,
        version=version,
        checksum=checksum,
        source=source,
        uploaded_by_id=uploaded_by_id,
        processing_status="queued",
    )
    db.add(config_file)
    db.flush()
    enqueue_job(
        db,
        job_type="parse_config",
        payload={"config_file_id": config_file.id, "asset_id": asset_id},
    )
    return config_file


@router.post("/configs/upload", response_model=ConfigFileRead, tags=["configs"])
def upload_config(
    asset_id: str = Form(...),
    source: str = Form("manual"),
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("configs:*")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    existing_versions = db.scalar(
        select(func.count()).select_from(ConfigFile).where(ConfigFile.asset_id == asset_id)
    ) or 0
    config_file = _create_config_file(
        db=db,
        asset_id=asset_id,
        source=source,
        uploaded_by_id=current_user.id,
        upload=upload,
        version=existing_versions + 1,
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


@router.post("/configs/bulk-upload", response_model=list[ConfigFileRead], tags=["configs"])
def bulk_upload_configs(
    asset_id: str = Form(...),
    source: str = Form("manual"),
    uploads: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("configs:*")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if not uploads:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one config file is required")

    existing_versions = db.scalar(
        select(func.count()).select_from(ConfigFile).where(ConfigFile.asset_id == asset_id)
    ) or 0
    config_files = [
        _create_config_file(
            db=db,
            asset_id=asset_id,
            source=source,
            upload=upload,
            uploaded_by_id=current_user.id,
            version=existing_versions + index + 1,
        )
        for index, upload in enumerate(uploads)
    ]
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="config.bulk_upload",
        resource_type="config_file",
        resource_id=asset_id,
        details={"asset_id": asset_id, "count": len(config_files), "filenames": [item.filename for item in config_files]},
    )
    db.commit()
    for config_file in config_files:
        db.refresh(config_file)
    return config_files


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


@router.get("/configs/normalized/search", response_model=dict, tags=["configs"])
def search_normalized_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    asset_id: str | None = Query(None),
    hostname: str | None = Query(None),
    section: str | None = Query(None),
    keyword: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(NormalizedConfig, Asset, ConfigFile)
        .join(Asset, NormalizedConfig.asset_id == Asset.id)
        .join(ConfigFile, NormalizedConfig.config_file_id == ConfigFile.id)
        .order_by(NormalizedConfig.created_at.desc())
    )
    if asset_id:
        stmt = stmt.where(NormalizedConfig.asset_id == asset_id)
    if hostname:
        stmt = stmt.where(NormalizedConfig.hostname.ilike(f"%{hostname}%"))

    rows = db.execute(stmt).all()
    filtered_items: list[NormalizedConfigSearchItem] = []
    keyword_lower = keyword.lower() if keyword else None
    for normalized, asset, config_file in rows:
        if keyword_lower and keyword_lower not in _normalized_search_blob(normalized):
            continue
        matched_sections, matched_content = _extract_matched_sections(normalized, keyword, section)
        if section and not matched_sections:
            continue
        filtered_items.append(
            NormalizedConfigSearchItem(
                id=normalized.id,
                config_file_id=normalized.config_file_id,
                asset_id=normalized.asset_id,
                asset_name=asset.name,
                filename=config_file.filename,
                config_version=normalized.config_version,
                hostname=normalized.hostname,
                matched_sections=matched_sections,
                matched_content=matched_content,
                summary=normalized.summary,
                indicators=normalized.indicators,
                created_at=normalized.created_at,
                updated_at=normalized.updated_at,
            )
        )

    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": [item.model_dump() for item in filtered_items[start:end]],
        "total": len(filtered_items),
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
