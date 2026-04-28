from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.entities import (
    AiAnalysisJob,
    AuditEvent,
    ExceptionRequest,
    Finding,
    LogClue,
    ReportArtifact,
    ReportJob,
    ReportTemplate,
    Ticket,
    TicketAttachment,
    TicketReminder,
    User,
)
from app.schemas.domain import (
    AiAnalysisJobRead,
    AuditEventRead,
    ExceptionApprovalRequest,
    ExceptionRequestCreate,
    ExceptionRequestRead,
    ReportArtifactRead,
    ReportJobCreate,
    ReportJobRead,
    TicketAttachmentRead,
    TicketCreate,
    TicketRead,
    TicketReminderCreate,
    TicketReminderRead,
    LogClueRead,
    TicketReviewDecision,
    TicketReviewSubmit,
    TicketUpdate,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job
from app.services.storage import save_upload

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
    current_user: User = Depends(require_permissions("tickets:*")),
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
    current_user: User = Depends(require_permissions("tickets:*")),
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


@router.post("/tickets/{ticket_id}/submit-review", response_model=TicketRead, tags=["tickets"])
def submit_ticket_review(
    ticket_id: str,
    payload: TicketReviewSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:*")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if payload.resolution_note is not None:
        ticket.resolution_note = payload.resolution_note
    ticket.status = "pending_review"
    ticket.review_status = "pending_review"
    ticket.submitted_at = datetime.now(UTC)
    finding = db.get(Finding, ticket.finding_id)
    if finding:
        finding.status = "remediation_submitted"
        db.add(finding)
    db.add(ticket)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.submit_review",
        resource_type="ticket",
        resource_id=ticket.id,
        details={"finding_id": ticket.finding_id},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/review/approve", response_model=TicketRead, tags=["tickets"])
def approve_ticket_review(
    ticket_id: str,
    payload: TicketReviewDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:review")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket.status = "closed"
    ticket.review_status = "approved"
    ticket.review_comment = payload.comment
    ticket.reviewed_by_id = current_user.id
    ticket.reviewed_at = datetime.now(UTC)
    finding = db.get(Finding, ticket.finding_id)
    if finding:
        finding.status = "closed"
        db.add(finding)
    db.add(ticket)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.review_approve",
        resource_type="ticket",
        resource_id=ticket.id,
        details={"comment": payload.comment},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/review/reject", response_model=TicketRead, tags=["tickets"])
def reject_ticket_review(
    ticket_id: str,
    payload: TicketReviewDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:review")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket.status = "in_progress"
    ticket.review_status = "rejected"
    ticket.review_comment = payload.comment
    ticket.reviewed_by_id = current_user.id
    ticket.reviewed_at = datetime.now(UTC)
    finding = db.get(Finding, ticket.finding_id)
    if finding:
        finding.status = "ticketed"
        db.add(finding)
    db.add(ticket)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.review_reject",
        resource_type="ticket",
        resource_id=ticket.id,
        details={"comment": payload.comment},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/tickets/{ticket_id}/attachments", response_model=list[TicketAttachmentRead], tags=["tickets"])
def list_ticket_attachments(
    ticket_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return (
        db.execute(
            select(TicketAttachment)
            .where(TicketAttachment.ticket_id == ticket_id)
            .order_by(TicketAttachment.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.post("/tickets/{ticket_id}/attachments", response_model=TicketAttachmentRead, tags=["tickets"])
def upload_ticket_attachment(
    ticket_id: str,
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:*", "tickets:review")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    storage_path = save_upload(upload, subdir="ticket-attachments")
    attachment = TicketAttachment(
        ticket_id=ticket_id,
        filename=upload.filename or "ticket-attachment",
        storage_path=storage_path,
        content_type=upload.content_type,
        size_bytes=Path(storage_path).stat().st_size,
        uploaded_by_id=current_user.id,
    )
    db.add(attachment)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.attachment_upload",
        resource_type="ticket_attachment",
        resource_id=attachment.id,
        details={"ticket_id": ticket_id, "filename": attachment.filename, "size_bytes": attachment.size_bytes},
    )
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/tickets/{ticket_id}/attachments/{attachment_id}/download", tags=["tickets"])
def download_ticket_attachment(
    ticket_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:*", "tickets:review", "audit:read")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    attachment = db.get(TicketAttachment, attachment_id)
    if not attachment or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket attachment not found")

    file_path = Path(attachment.storage_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket attachment file not found")

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.attachment_download",
        resource_type="ticket_attachment",
        resource_id=attachment.id,
        details={"ticket_id": ticket_id, "filename": attachment.filename},
    )
    db.commit()
    return FileResponse(
        path=file_path,
        filename=attachment.filename,
        media_type=attachment.content_type or "application/octet-stream",
    )


@router.get("/tickets/{ticket_id}/reminders", response_model=list[TicketReminderRead], tags=["tickets"])
def list_ticket_reminders(
    ticket_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return (
        db.execute(
            select(TicketReminder)
            .where(TicketReminder.ticket_id == ticket_id)
            .order_by(TicketReminder.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.post("/tickets/{ticket_id}/reminders", response_model=TicketReminderRead, tags=["tickets"])
def create_ticket_reminder(
    ticket_id: str,
    payload: TicketReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("tickets:*", "tickets:review")),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reminder message is required")

    reminder = TicketReminder(
        ticket_id=ticket_id,
        message=payload.message,
        reminded_to=payload.reminded_to,
        created_by_id=current_user.id,
    )
    db.add(reminder)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.reminder_create",
        resource_type="ticket_reminder",
        resource_id=reminder.id,
        details={"ticket_id": ticket_id, "reminded_to": reminder.reminded_to},
    )
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("/tickets/{ticket_id}/log-clues", response_model=list[LogClueRead], tags=["tickets"])
def list_ticket_log_clues(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    finding = db.get(Finding, ticket.finding_id)
    conditions = [
        (LogClue.resource_type == "ticket") & (LogClue.resource_id == ticket.id),
        (LogClue.resource_type == "finding") & (LogClue.resource_id == ticket.finding_id),
    ]
    if finding and finding.asset_id:
        conditions.append((LogClue.resource_type == "asset") & (LogClue.resource_id == finding.asset_id))

    clues = (
        db.execute(
            select(LogClue)
            .where(or_(*conditions))
            .order_by(LogClue.event_time.desc(), LogClue.created_at.desc())
        )
        .scalars()
        .all()
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ticket.log_clue_trace",
        resource_type="ticket",
        resource_id=ticket.id,
        details={"finding_id": ticket.finding_id, "result_count": len(clues)},
    )
    db.commit()
    return clues


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
    current_user: User = Depends(require_permissions("exceptions:*")),
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
    current_user: User = Depends(require_permissions("exceptions:review")),
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
    current_user: User = Depends(require_permissions("exceptions:review")),
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
    current_user: User = Depends(require_permissions("reports:*")),
):
    if payload.template_id:
        template = db.get(ReportTemplate, payload.template_id)
        if not template or template.template_type != payload.report_type or template.status == "deleted":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report template is not available")

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
        payload={
            "report_job_id": report_job.id,
            "report_type": report_job.report_type,
            "template_id": payload.template_id,
            "parameters": payload.parameters,
        },
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report.create",
        resource_type="report_job",
        resource_id=report_job.id,
        details={"report_type": report_job.report_type, "template_id": payload.template_id},
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
    current_user: User = Depends(require_permissions("reports:*")),
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
    _: User = Depends(require_permissions("audit:read")),
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
