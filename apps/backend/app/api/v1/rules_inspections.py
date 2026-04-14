from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.entities import AiAnalysisJob, Finding, InspectionRun, RuleRunResult, RuleSet, User
from app.schemas.domain import (
    AiAnalysisJobRead,
    FindingRead,
    InspectionCreate,
    InspectionRead,
    RuleRunResultRead,
    RuleSetCreate,
    RuleSetRead,
    RuleSetUpdate,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job

router = APIRouter()


@router.get("/rules", response_model=list[RuleSetRead], tags=["rules"])
def list_rules(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(RuleSet).order_by(RuleSet.created_at.desc())).scalars().all()


@router.post("/rules", response_model=RuleSetRead, tags=["rules"])
def create_rule(
    payload: RuleSetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator", "reviewer")),
):
    rule = RuleSet(**payload.model_dump())
    db.add(rule)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="rule.create",
        resource_type="rule_set",
        resource_id=rule.id,
        details={"name": rule.name, "version": rule.version},
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=RuleSetRead, tags=["rules"])
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
    return rule


@router.patch("/rules/{rule_id}", response_model=RuleSetRead, tags=["rules"])
def update_rule(
    rule_id: str,
    payload: RuleSetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator", "reviewer")),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)

    db.add(rule)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="rule.update",
        resource_type="rule_set",
        resource_id=rule.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/inspections", response_model=dict, tags=["inspections"])
def list_inspections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = db.scalar(select(func.count()).select_from(InspectionRun)) or 0
    items = (
        db.execute(
            select(InspectionRun)
            .order_by(InspectionRun.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return {
        "items": [InspectionRead.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/inspections", response_model=InspectionRead, tags=["inspections"])
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    rule_set = db.get(RuleSet, payload.rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")

    inspection = InspectionRun(
        **payload.model_dump(),
        status="queued",
        requested_by_id=current_user.id,
    )
    db.add(inspection)
    db.flush()
    enqueue_job(
        db,
        job_type="run_inspection",
        payload={
            "inspection_run_id": inspection.id,
            "rule_set_id": inspection.rule_set_id,
            "asset_ids": inspection.asset_scope,
        },
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="inspection.create",
        resource_type="inspection_run",
        resource_id=inspection.id,
        details={"name": inspection.name, "trigger_type": inspection.trigger_type},
    )
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("/inspections/{inspection_id}", response_model=InspectionRead, tags=["inspections"])
def get_inspection(
    inspection_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inspection = db.get(InspectionRun, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")
    return inspection


@router.get("/findings", response_model=dict, tags=["findings"])
def list_findings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    inspection_run_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Finding).order_by(Finding.created_at.desc())
    count_stmt = select(func.count()).select_from(Finding)
    if inspection_run_id:
        stmt = stmt.where(Finding.inspection_run_id == inspection_run_id)
        count_stmt = count_stmt.where(Finding.inspection_run_id == inspection_run_id)
    if status_filter:
        stmt = stmt.where(Finding.status == status_filter)
        count_stmt = count_stmt.where(Finding.status == status_filter)
    if severity:
        stmt = stmt.where(Finding.severity == severity)
        count_stmt = count_stmt.where(Finding.severity == severity)

    total = db.scalar(count_stmt) or 0
    items = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    return {
        "items": [FindingRead.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/inspections/{inspection_id}/rule-results", response_model=list[RuleRunResultRead], tags=["inspections"])
def list_rule_results(
    inspection_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inspection = db.get(InspectionRun, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    return (
        db.execute(
            select(RuleRunResult)
            .where(RuleRunResult.inspection_run_id == inspection_id)
            .order_by(RuleRunResult.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/inspections/{inspection_id}/ai-summaries", response_model=list[AiAnalysisJobRead], tags=["inspections"])
def list_inspection_ai_summaries(
    inspection_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inspection = db.get(InspectionRun, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    return (
        db.execute(
            select(AiAnalysisJob)
            .where(
                AiAnalysisJob.target_type == "inspection_run",
                AiAnalysisJob.target_id == inspection_id,
            )
            .order_by(AiAnalysisJob.created_at.desc())
        )
        .scalars()
        .all()
    )
