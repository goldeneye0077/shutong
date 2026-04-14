from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.entities import AiAnalysisJob, AuditEvent, ExceptionRequest, Finding, ReportArtifact, ReportJob, Ticket, User
from app.schemas.domain import (
    AiAnalysisJobRead,
    AuditEventRead,
    ExceptionApprovalRequest,
    ExceptionRequestCreate,
    ExceptionRequestRead,
    ReportArtifactRead,
    ReportJobCreate,
    ReportJobRead,
    TicketCreate,
    TicketRead,
    TicketUpdate,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job

router = APIRouter()


@router.get("/tickets", response_model=list[TicketRead], tags=["tickets"])
def list_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(Ticket).order_by(Ticket.created_at.desc())).scalars().all()


@router.post("/tickets", response_model=TicketRead, tags=["tickets"])
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    finding = db.get(Finding, payload.finding_id)
    if not finding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")

    ticket = Ticket(**payload.model_dump())
    db.add(ticket)
    db.flush()
    finding.status = "ticketed"
    db.add(finding)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.create",
        resource_type="ticket",
        resource_id=ticket.id,
        details={"finding_id": payload.finding_id},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=TicketRead, tags=["tickets"])
def update_ticket(
    ticket_id: str,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator", "reviewer")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)

    if payload.status == "closed":
        finding = db.get(Finding, ticket.finding_id)
        if finding:
            finding.status = "closed"
            db.add(finding)

    db.add(ticket)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.update",
        resource_type="ticket",
        resource_id=ticket.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/exceptions", response_model=list[ExceptionRequestRead], tags=["exceptions"])
def list_exceptions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(ExceptionRequest).order_by(ExceptionRequest.created_at.desc())).scalars().all()


@router.post("/exceptions", response_model=ExceptionRequestRead, tags=["exceptions"])
def create_exception_request(
    payload: ExceptionRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    ticket = db.get(Ticket, payload.ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    exception = ExceptionRequest(
        **payload.model_dump(),
        status="pending",
        requested_by_id=current_user.id,
    )
    db.add(exception)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="exception.create",
        resource_type="exception",
        resource_id=exception.id,
        details={"ticket_id": payload.ticket_id},
    )
    db.commit()
    db.refresh(exception)
    return exception


@router.post("/exceptions/{exception_id}/approve", response_model=ExceptionRequestRead, tags=["exceptions"])
def approve_exception(
    exception_id: str,
    payload: ExceptionApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "reviewer")),
):
    exception = db.get(ExceptionRequest, exception_id)
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exception request not found")

    exception.status = "approved"
    exception.review_comment = payload.comment
    exception.approved_by_id = current_user.id
    ticket = db.get(Ticket, exception.ticket_id)
    if ticket:
        ticket.status = "exception_approved"
        db.add(ticket)
        finding = db.get(Finding, ticket.finding_id)
        if finding:
            finding.status = "exception_approved"
            db.add(finding)

    db.add(exception)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="exception.approve",
        resource_type="exception",
        resource_id=exception.id,
        details={"comment": payload.comment},
    )
    db.commit()
    db.refresh(exception)
    return exception


@router.post("/exceptions/{exception_id}/reject", response_model=ExceptionRequestRead, tags=["exceptions"])
def reject_exception(
    exception_id: str,
    payload: ExceptionApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "reviewer")),
):
    exception = db.get(ExceptionRequest, exception_id)
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exception request not found")

    exception.status = "rejected"
    exception.review_comment = payload.comment
    exception.approved_by_id = current_user.id
    db.add(exception)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="exception.reject",
        resource_type="exception",
        resource_id=exception.id,
        details={"comment": payload.comment},
    )
    db.commit()
    db.refresh(exception)
    return exception


@router.get("/reports", response_model=list[ReportJobRead], tags=["reports"])
def list_reports(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(ReportJob).order_by(ReportJob.created_at.desc())).scalars().all()


@router.post("/reports", response_model=ReportJobRead, tags=["reports"])
def create_report(
    payload: ReportJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator", "reviewer", "auditor")),
):
    report_job = ReportJob(
        report_type=payload.report_type,
        status="queued",
        requested_by_id=current_user.id,
    )
    db.add(report_job)
    db.flush()
    enqueue_job(
        db,
        job_type="generate_report",
        payload={"report_job_id": report_job.id, "report_type": report_job.report_type},
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report.create",
        resource_type="report_job",
        resource_id=report_job.id,
        details={"report_type": report_job.report_type},
    )
    db.commit()
    db.refresh(report_job)
    return report_job


@router.get("/reports/{report_id}", response_model=ReportJobRead, tags=["reports"])
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    report = db.get(ReportJob, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")
    return report


@router.get("/reports/{report_id}/artifacts", response_model=list[ReportArtifactRead], tags=["reports"])
def list_report_artifacts(
    report_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    report = db.get(ReportJob, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")

    return (
        db.execute(
            select(ReportArtifact)
            .where(ReportArtifact.report_job_id == report_id)
            .order_by(ReportArtifact.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/reports/{report_id}/ai-summaries", response_model=list[AiAnalysisJobRead], tags=["reports"])
def list_report_ai_summaries(
    report_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    report = db.get(ReportJob, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")

    return (
        db.execute(
            select(AiAnalysisJob)
            .where(
                AiAnalysisJob.target_type == "report_job",
                AiAnalysisJob.target_id == report_id,
            )
            .order_by(AiAnalysisJob.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/reports/{report_id}/artifacts/{artifact_id}/download", tags=["reports"])
def download_report_artifact(
    report_id: str,
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator", "reviewer", "auditor")),
):
    report = db.get(ReportJob, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")

    artifact = db.get(ReportArtifact, artifact_id)
    if not artifact or artifact.report_job_id != report_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report artifact not found")

    file_path = Path(artifact.file_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact file not found")

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report.download",
        resource_type="report_artifact",
        resource_id=artifact.id,
        details={"report_job_id": report_id, "file_path": artifact.file_path},
    )
    db.commit()
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/octet-stream")


@router.get("/audit", response_model=dict, tags=["audit"])
def list_audit(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "reviewer", "auditor")),
):
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())
    count_stmt = select(func.count()).select_from(AuditEvent)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
        count_stmt = count_stmt.where(AuditEvent.action == action)
    if resource_type:
        stmt = stmt.where(AuditEvent.resource_type == resource_type)
        count_stmt = count_stmt.where(AuditEvent.resource_type == resource_type)

    total = db.scalar(count_stmt) or 0
    items = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    return {
        "items": [AuditEventRead.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
