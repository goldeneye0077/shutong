from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.entities import Asset, AiAnalysisJob, Finding, InspectionRun, LogClue, RuleRunResult, RuleSet, RuleSetVersion, Ticket, User
from app.schemas.domain import (
    AiAnalysisJobRead,
    FindingRead,
    InspectionCreate,
    InspectionRead,
    LogClueRead,
    ProblemTopicItem,
    ProblemTopicResponse,
    RuleRunResultRead,
    RuleSetCreate,
    RuleSetRead,
    RuleSetUpdate,
    RuleVersionDiffEntry,
    RuleVersionDiffRead,
    RuleVersionRollbackRequest,
    RuleSetVersionRead,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job

router = APIRouter()


def _inspection_assignment_summary(db: Session, inspection: InspectionRun) -> list[dict[str, str]]:
    if not inspection.asset_scope:
        return []
    assets = db.execute(select(Asset).where(Asset.id.in_(inspection.asset_scope))).scalars().all()
    asset_map = {asset.id: asset for asset in assets}
    assignments: list[dict[str, str]] = []
    for asset_id in inspection.asset_scope:
        asset = asset_map.get(asset_id)
        if not asset:
            continue
        assignments.append(
            {
                "asset_id": asset.id,
                "asset_name": asset.name,
                "asset_type": asset.asset_type,
                "owner": asset.owner,
            }
        )
    return assignments


def _inspection_to_read(db: Session, inspection: InspectionRun) -> dict:
    payload = InspectionRead.model_validate(inspection).model_dump()
    payload["assignment_summary"] = _inspection_assignment_summary(db, inspection)
    return payload


def _rule_snapshot(rule: RuleSet) -> dict:
    return {
        "name": rule.name,
        "category": rule.category,
        "version": rule.version,
        "risk_level": rule.risk_level,
        "status": rule.status,
        "scope": rule.scope,
        "definition": rule.definition,
    }


def _record_rule_version(db: Session, *, rule: RuleSet, created_by_id: str) -> RuleSetVersion:
    version = RuleSetVersion(
        rule_set_id=rule.id,
        version=rule.version,
        status=rule.status,
        snapshot=_rule_snapshot(rule),
        effective_from=datetime.now(UTC) if rule.status == "active" else None,
        created_by_id=created_by_id,
    )
    db.add(version)
    db.flush()
    return version


def _get_rule_version_or_404(db: Session, *, rule_id: str, version_id: str) -> RuleSetVersion:
    version = db.get(RuleSetVersion, version_id)
    if not version or version.rule_set_id != rule_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found")
    return version


def _diff_rule_snapshots(base_snapshot: dict, compare_snapshot: dict) -> list[RuleVersionDiffEntry]:
    changes: list[RuleVersionDiffEntry] = []
    for field_name in ["name", "category", "version", "risk_level", "status", "scope", "definition"]:
        before = base_snapshot.get(field_name)
        after = compare_snapshot.get(field_name)
        if before != after:
            changes.append(RuleVersionDiffEntry(field=field_name, before=before, after=after))
    return changes


def _related_log_clue_conditions(
    *,
    finding_id: str | None = None,
    ticket_id: str | None = None,
    asset_id: str | None = None,
):
    conditions = []
    if finding_id:
        conditions.append((LogClue.resource_type == "finding") & (LogClue.resource_id == finding_id))
    if ticket_id:
        conditions.append((LogClue.resource_type == "ticket") & (LogClue.resource_id == ticket_id))
    if asset_id:
        conditions.append((LogClue.resource_type == "asset") & (LogClue.resource_id == asset_id))
    return conditions


def _list_related_log_clues(
    db: Session,
    *,
    finding_id: str | None = None,
    ticket_id: str | None = None,
    asset_id: str | None = None,
) -> list[LogClue]:
    conditions = _related_log_clue_conditions(finding_id=finding_id, ticket_id=ticket_id, asset_id=asset_id)
    if not conditions:
        return []
    return (
        db.execute(
            select(LogClue)
            .where(or_(*conditions))
            .order_by(LogClue.event_time.desc(), LogClue.created_at.desc())
        )
        .scalars()
        .all()
    )


def _problem_topic_empty_response(page: int, page_size: int) -> ProblemTopicResponse:
    return ProblemTopicResponse(items=[], total=0, page=page, page_size=page_size)


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
    current_user: User = Depends(require_permissions("rules:*")),
):
    rule = RuleSet(**payload.model_dump())
    db.add(rule)
    db.flush()
    rule_version = _record_rule_version(db, rule=rule, created_by_id=current_user.id)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="rule.create",
        resource_type="rule_set",
        resource_id=rule.id,
        details={"name": rule.name, "version": rule.version, "rule_version_id": rule_version.id},
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}/versions", response_model=list[RuleSetVersionRead], tags=["rules"])
def list_rule_versions(
    rule_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
    return (
        db.execute(
            select(RuleSetVersion)
            .where(RuleSetVersion.rule_set_id == rule_id)
            .order_by(RuleSetVersion.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/rules/{rule_id}/versions/diff", response_model=RuleVersionDiffRead, tags=["rules"])
def diff_rule_versions(
    rule_id: str,
    base_version_id: str,
    compare_version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
    base_version = _get_rule_version_or_404(db, rule_id=rule_id, version_id=base_version_id)
    compare_version = _get_rule_version_or_404(db, rule_id=rule_id, version_id=compare_version_id)
    changes = _diff_rule_snapshots(base_version.snapshot or {}, compare_version.snapshot or {})
    return RuleVersionDiffRead(
        rule_set_id=rule_id,
        base_version_id=base_version.id,
        compare_version_id=compare_version.id,
        changed_count=len(changes),
        changes=changes,
    )


@router.post("/rules/{rule_id}/versions/{version_id}/rollback", response_model=RuleSetRead, tags=["rules"])
def rollback_rule_version(
    rule_id: str,
    version_id: str,
    payload: RuleVersionRollbackRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("rules:*")),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
    version = _get_rule_version_or_404(db, rule_id=rule_id, version_id=version_id)
    snapshot = version.snapshot or {}
    rollback_version = payload.version if payload and payload.version else (
        f"{snapshot.get('version') or version.version}-rollback-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    )

    for field_name in ["name", "category", "risk_level", "status", "scope", "definition"]:
        if field_name in snapshot:
            setattr(rule, field_name, snapshot[field_name])
    rule.version = rollback_version

    db.add(rule)
    new_version = _record_rule_version(db, rule=rule, created_by_id=current_user.id)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="rule.rollback",
        resource_type="rule_set",
        resource_id=rule.id,
        details={
            "from_rule_version_id": version.id,
            "new_rule_version_id": new_version.id,
            "rollback_version": rollback_version,
        },
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
    current_user: User = Depends(require_permissions("rules:*")),
):
    rule = db.get(RuleSet, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)

    db.add(rule)
    rule_version = _record_rule_version(db, rule=rule, created_by_id=current_user.id)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="rule.update",
        resource_type="rule_set",
        resource_id=rule.id,
        details={**payload.model_dump(exclude_unset=True), "rule_version_id": rule_version.id},
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
        "items": [_inspection_to_read(db, item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/inspections", response_model=InspectionRead, tags=["inspections"])
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inspections:*")),
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
    return _inspection_to_read(db, inspection)


@router.get("/inspections/{inspection_id}", response_model=InspectionRead, tags=["inspections"])
def get_inspection(
    inspection_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inspection = db.get(InspectionRun, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")
    return _inspection_to_read(db, inspection)


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


@router.get("/findings/topic-view", response_model=ProblemTopicResponse, tags=["findings"])
def list_problem_topics(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    rule_set_id: str | None = Query(None),
    asset_type: str | None = Query(None),
    owner: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = []
    if rule_set_id:
        filters.append(Finding.rule_set_id == rule_set_id)
    if status_filter:
        filters.append(Finding.status == status_filter)
    if severity:
        filters.append(Finding.severity == severity)
    if asset_type or owner:
        asset_stmt = select(Asset.id)
        if asset_type:
            asset_stmt = asset_stmt.where(Asset.asset_type == asset_type)
        if owner:
            asset_stmt = asset_stmt.where(Asset.owner.ilike(f"%{owner}%"))
        asset_ids = db.execute(asset_stmt).scalars().all()
        if not asset_ids:
            response = _problem_topic_empty_response(page, page_size)
            record_audit(
                db,
                actor_user_id=current_user.id,
                action="finding.topic_search",
                resource_type="finding",
                resource_id="topic-view",
                details={
                    "filters": {
                        "rule_set_id": rule_set_id,
                        "asset_type": asset_type,
                        "owner": owner,
                        "status": status_filter,
                        "severity": severity,
                    },
                    "result_count": 0,
                },
            )
            db.commit()
            return response
        filters.append(Finding.asset_id.in_(asset_ids))

    total_stmt = select(func.count()).select_from(Finding)
    stmt = select(Finding).order_by(Finding.created_at.desc())
    if filters:
        total_stmt = total_stmt.where(*filters)
        stmt = stmt.where(*filters)

    total = db.scalar(total_stmt) or 0
    findings = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    finding_ids = [finding.id for finding in findings]
    asset_ids = [finding.asset_id for finding in findings if finding.asset_id]
    rule_ids = [finding.rule_set_id for finding in findings]

    assets = db.execute(select(Asset).where(Asset.id.in_(asset_ids))).scalars().all() if asset_ids else []
    rules = db.execute(select(RuleSet).where(RuleSet.id.in_(rule_ids))).scalars().all() if rule_ids else []
    tickets = (
        db.execute(select(Ticket).where(Ticket.finding_id.in_(finding_ids)).order_by(Ticket.created_at.desc()))
        .scalars()
        .all()
        if finding_ids
        else []
    )
    asset_map = {asset.id: asset for asset in assets}
    rule_map = {rule.id: rule for rule in rules}
    ticket_by_finding: dict[str, Ticket] = {}
    for ticket in tickets:
        ticket_by_finding.setdefault(ticket.finding_id, ticket)

    ticket_to_finding = {ticket.id: ticket.finding_id for ticket in tickets}
    asset_to_findings: dict[str, list[str]] = {}
    for finding in findings:
        if finding.asset_id:
            asset_to_findings.setdefault(finding.asset_id, []).append(finding.id)

    log_conditions = []
    if finding_ids:
        log_conditions.append((LogClue.resource_type == "finding") & (LogClue.resource_id.in_(finding_ids)))
    if ticket_to_finding:
        log_conditions.append((LogClue.resource_type == "ticket") & (LogClue.resource_id.in_(list(ticket_to_finding))))
    if asset_to_findings:
        log_conditions.append((LogClue.resource_type == "asset") & (LogClue.resource_id.in_(list(asset_to_findings))))
    log_clues = (
        db.execute(select(LogClue).where(or_(*log_conditions))).scalars().all()
        if log_conditions
        else []
    )

    log_count_by_finding = {finding_id: 0 for finding_id in finding_ids}
    latest_log_by_finding: dict[str, datetime] = {}
    for clue in log_clues:
        related_finding_ids: list[str] = []
        if clue.resource_type == "finding" and clue.resource_id in log_count_by_finding:
            related_finding_ids = [clue.resource_id]
        elif clue.resource_type == "ticket" and clue.resource_id in ticket_to_finding:
            related_finding_ids = [ticket_to_finding[clue.resource_id]]
        elif clue.resource_type == "asset" and clue.resource_id in asset_to_findings:
            related_finding_ids = asset_to_findings[clue.resource_id]

        clue_time = clue.event_time or clue.created_at
        for related_finding_id in related_finding_ids:
            log_count_by_finding[related_finding_id] += 1
            if related_finding_id not in latest_log_by_finding or clue_time > latest_log_by_finding[related_finding_id]:
                latest_log_by_finding[related_finding_id] = clue_time

    items: list[ProblemTopicItem] = []
    for finding in findings:
        asset = asset_map.get(finding.asset_id or "")
        rule = rule_map.get(finding.rule_set_id)
        ticket = ticket_by_finding.get(finding.id)
        items.append(
            ProblemTopicItem(
                finding_id=finding.id,
                title=finding.title,
                severity=finding.severity,
                status=finding.status,
                asset_id=finding.asset_id,
                asset_name=asset.name if asset else None,
                asset_type=asset.asset_type if asset else None,
                owner=asset.owner if asset else None,
                rule_set_id=finding.rule_set_id,
                rule_name=rule.name if rule else None,
                ticket_id=ticket.id if ticket else None,
                ticket_status=ticket.status if ticket else None,
                log_clue_count=log_count_by_finding.get(finding.id, 0),
                latest_log_time=latest_log_by_finding.get(finding.id),
                created_at=finding.created_at,
                updated_at=finding.updated_at,
            )
        )

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="finding.topic_search",
        resource_type="finding",
        resource_id="topic-view",
        details={
            "filters": {
                "rule_set_id": rule_set_id,
                "asset_type": asset_type,
                "owner": owner,
                "status": status_filter,
                "severity": severity,
            },
            "result_count": len(items),
        },
    )
    db.commit()
    return ProblemTopicResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/findings/{finding_id}/log-clues", response_model=list[LogClueRead], tags=["findings"])
def list_finding_log_clues(
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    ticket = db.scalar(select(Ticket).where(Ticket.finding_id == finding_id).order_by(Ticket.created_at.desc()))
    clues = _list_related_log_clues(
        db,
        finding_id=finding.id,
        ticket_id=ticket.id if ticket else None,
        asset_id=finding.asset_id,
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="finding.log_clue_trace",
        resource_type="finding",
        resource_id=finding.id,
        details={"ticket_id": ticket.id if ticket else None, "result_count": len(clues)},
    )
    db.commit()
    return clues


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
