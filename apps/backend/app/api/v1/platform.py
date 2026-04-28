from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.entities import (
    AiAnalysisJob,
    Asset,
    AuditEvent,
    ConfigFile,
    JobQueue,
    LedgerItem,
    LogClue,
    Notification,
    ReportTemplate,
    RuleSet,
    ScheduledTask,
    SystemParameter,
    User,
)
from app.schemas.domain import (
    AiAnalysisJobRead,
    AiReviewRequest,
    ConfigDiffRead,
    JobQueueRead,
    LedgerImportError,
    LedgerImportRequest,
    LedgerImportResult,
    LedgerItemRead,
    LogClueCreate,
    LogClueRead,
    NotificationCreate,
    NotificationMarkAllReadResult,
    NotificationRead,
    NotificationUnreadCount,
    ReportTemplateCreate,
    ReportTemplateRead,
    ReportTemplateUpdate,
    ScheduledTaskCreate,
    ScheduledTaskExecutionLogRead,
    ScheduledTaskRead,
    ScheduledTaskUpdate,
    SystemParameterCreate,
    SystemParameterRead,
    SystemParameterUpdate,
)
from app.services.audit import record_audit
from app.services.jobs import enqueue_job

router = APIRouter()

LEDGER_CATALOG_RULES: dict[str, dict[str, object]] = {
    "strategy": {
        "label": "策略台账",
        "required_content_fields": {
            "policy_id": "策略编号不能为空",
            "source": "源地址或源对象不能为空",
            "destination": "目的地址或目的对象不能为空",
            "action": "策略动作不能为空",
        },
    },
    "account": {
        "label": "账号台账",
        "required_content_fields": {
            "username": "账号名称不能为空",
            "role": "账号角色不能为空",
        },
    },
    "exception": {
        "label": "例外台账",
        "required_content_fields": {
            "exception_id": "例外编号不能为空",
            "reason": "例外原因不能为空",
            "expires_at": "例外到期时间不能为空",
        },
    },
    "bypass": {
        "label": "绕行台账",
        "required_content_fields": {
            "bypass_id": "绕行编号不能为空",
            "target": "绕行对象不能为空",
            "approved_by": "审批人不能为空",
        },
    },
    "template": {
        "label": "模板台账",
        "required_content_fields": {
            "template_type": "模板类型不能为空",
            "body": "模板内容不能为空",
        },
    },
}

VALID_LEDGER_STATUSES = {"active", "inactive", "pending", "approved", "expired", "disabled"}


def _is_blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _ledger_item_snapshot(item) -> dict:
    return item.model_dump()


def _validate_ledger_import(payload: LedgerImportRequest) -> list[LedgerImportError]:
    errors: list[LedgerImportError] = []
    rule = LEDGER_CATALOG_RULES.get(payload.catalog_type)

    if not payload.items:
        errors.append(
            LedgerImportError(
                row_no=0,
                field="items",
                code="EMPTY_ITEMS",
                message="导入内容不能为空",
                item={},
            )
        )
        return errors

    for index, item in enumerate(payload.items, start=1):
        snapshot = _ledger_item_snapshot(item)
        if not rule:
            errors.append(
                LedgerImportError(
                    row_no=index,
                    field="catalog_type",
                    code="UNSUPPORTED_CATALOG_TYPE",
                    message=f"不支持的台账类型：{payload.catalog_type}",
                    item=snapshot,
                )
            )
            continue

        if _is_blank(item.name):
            errors.append(
                LedgerImportError(
                    row_no=index,
                    field="name",
                    code="REQUIRED",
                    message="台账名称不能为空",
                    item=snapshot,
                )
            )

        if item.status not in VALID_LEDGER_STATUSES:
            errors.append(
                LedgerImportError(
                    row_no=index,
                    field="status",
                    code="INVALID_STATUS",
                    message=f"状态必须是 {', '.join(sorted(VALID_LEDGER_STATUSES))} 之一",
                    item=snapshot,
                )
            )

        content = item.content or {}
        required_content_fields = rule["required_content_fields"]
        assert isinstance(required_content_fields, dict)
        for field_name, message in required_content_fields.items():
            if _is_blank(content.get(field_name)):
                errors.append(
                    LedgerImportError(
                        row_no=index,
                        field=f"content.{field_name}",
                        code="REQUIRED",
                        message=str(message),
                        item=snapshot,
                    )
                )

    return errors


def _validate_scheduled_task_payload(db: Session, *, task_type: str, payload: dict, interval_minutes: int) -> None:
    if interval_minutes < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="周期任务间隔必须大于 0 分钟")
    if task_type not in {"base_data_sync", "periodic_inspection"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"不支持的周期任务类型：{task_type}")

    if task_type == "periodic_inspection":
        rule_set_id = payload.get("rule_set_id")
        asset_scope = payload.get("asset_scope")
        if not rule_set_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="周期巡检任务必须配置 rule_set_id")
        if not isinstance(asset_scope, list) or not asset_scope:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="周期巡检任务必须配置 asset_scope")
        if not db.get(RuleSet, str(rule_set_id)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="周期巡检引用的规则集不存在")
        existing_assets = {
            asset.id
            for asset in db.execute(select(Asset).where(Asset.id.in_([str(asset_id) for asset_id in asset_scope]))).scalars().all()
        }
        missing_assets = [str(asset_id) for asset_id in asset_scope if str(asset_id) not in existing_assets]
        if missing_assets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"周期巡检引用的治理对象不存在：{', '.join(missing_assets)}",
            )


def _paged_response(db: Session, stmt, count_stmt, page: int, page_size: int, model):
    total = db.scalar(count_stmt) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {
        "items": [model.model_validate(item).model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/ledgers", response_model=dict, tags=["ledgers"])
def list_ledgers(
    catalog_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(LedgerItem).order_by(LedgerItem.created_at.desc())
    count_stmt = select(func.count()).select_from(LedgerItem)
    if catalog_type:
        stmt = stmt.where(LedgerItem.catalog_type == catalog_type)
        count_stmt = count_stmt.where(LedgerItem.catalog_type == catalog_type)
    return _paged_response(db, stmt, count_stmt, page, page_size, LedgerItemRead)


@router.post("/ledgers/import", response_model=LedgerImportResult, tags=["ledgers"])
def import_ledgers(
    payload: LedgerImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("ledgers:*")),
):
    imported: list[LedgerItem] = []
    validation_errors = _validate_ledger_import(payload)
    rejected_rows = {error.row_no for error in validation_errors if error.row_no > 0}

    for index, item in enumerate(payload.items, start=1):
        if index in rejected_rows:
            continue
        ledger_item = LedgerItem(
            catalog_type=payload.catalog_type,
            name=item.name or f"{payload.catalog_type}-{index}",
            status=item.status,
            source=payload.source,
            version=item.version,
            owner=item.owner,
            content=item.content,
            imported_by_id=current_user.id,
        )
        db.add(ledger_item)
        imported.append(ledger_item)
    if imported:
        db.flush()
        record_audit(
            db,
            actor_user_id=current_user.id,
            action="ledger.import",
            resource_type="ledger_item",
            resource_id=imported[0].id,
            details={
                "catalog_type": payload.catalog_type,
                "accepted_count": len(imported),
                "rejected_count": len(rejected_rows),
                "source": payload.source,
            },
        )
        db.commit()
        for item in imported:
            db.refresh(item)
    else:
        db.rollback()

    return LedgerImportResult(
        catalog_type=payload.catalog_type,
        source=payload.source,
        accepted_count=len(imported),
        rejected_count=len(rejected_rows) if rejected_rows else len(validation_errors),
        imported_items=imported,
        errors=validation_errors,
    )


@router.get("/configs/diff", response_model=ConfigDiffRead, tags=["configs"])
def diff_configs(
    base_config_id: str,
    compare_config_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    base_config = db.get(ConfigFile, base_config_id)
    compare_config = db.get(ConfigFile, compare_config_id)
    if not base_config or not compare_config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config file not found")
    if base_config.asset_id != compare_config.asset_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Config versions must belong to the same asset")

    base_lines = Path(base_config.storage_path).read_text(encoding="utf-8").splitlines()
    compare_lines = Path(compare_config.storage_path).read_text(encoding="utf-8").splitlines()
    base_set = set(base_lines)
    compare_set = set(compare_lines)
    added = [line for line in compare_lines if line not in base_set]
    removed = [line for line in base_lines if line not in compare_set]
    return ConfigDiffRead(
        base_config_id=base_config.id,
        compare_config_id=compare_config.id,
        added=added,
        removed=removed,
        changed_count=len(added) + len(removed),
    )


@router.get("/scheduled-tasks", response_model=list[ScheduledTaskRead], tags=["scheduled-tasks"])
def list_scheduled_tasks(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(ScheduledTask).order_by(ScheduledTask.created_at.desc())).scalars().all()


@router.post("/scheduled-tasks", response_model=ScheduledTaskRead, tags=["scheduled-tasks"])
def create_scheduled_task(
    payload: ScheduledTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("schedules:*")),
):
    _validate_scheduled_task_payload(
        db,
        task_type=payload.task_type,
        payload=payload.payload,
        interval_minutes=payload.interval_minutes,
    )
    next_run_at = payload.next_run_at or datetime.now(UTC) + timedelta(minutes=payload.interval_minutes)
    task = ScheduledTask(**payload.model_dump(exclude={"next_run_at"}), next_run_at=next_run_at, created_by_id=current_user.id)
    db.add(task)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="scheduled_task.create",
        resource_type="scheduled_task",
        resource_id=task.id,
        details={"task_type": task.task_type, "enabled": task.enabled},
    )
    db.commit()
    db.refresh(task)
    return task


@router.patch("/scheduled-tasks/{task_id}", response_model=ScheduledTaskRead, tags=["scheduled-tasks"])
def update_scheduled_task(
    task_id: str,
    payload: ScheduledTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("schedules:*")),
):
    task = db.get(ScheduledTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled task not found")
    updates = payload.model_dump(exclude_unset=True)
    merged_task_type = str(updates.get("task_type", task.task_type))
    merged_payload = updates.get("payload", task.payload) or {}
    merged_interval = int(updates.get("interval_minutes", task.interval_minutes))
    _validate_scheduled_task_payload(db, task_type=merged_task_type, payload=merged_payload, interval_minutes=merged_interval)

    for key, value in updates.items():
        setattr(task, key, value)
    if updates.get("enabled") is True and task.next_run_at is None:
        task.next_run_at = datetime.now(UTC) + timedelta(minutes=max(task.interval_minutes, 1))
    db.add(task)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="scheduled_task.update",
        resource_type="scheduled_task",
        resource_id=task.id,
        details=updates,
    )
    db.commit()
    db.refresh(task)
    return task


@router.get(
    "/scheduled-tasks/{task_id}/execution-logs",
    response_model=list[ScheduledTaskExecutionLogRead],
    tags=["scheduled-tasks"],
)
def list_scheduled_task_execution_logs(
    task_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    task = db.get(ScheduledTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled task not found")
    logs = (
        db.execute(
            select(AuditEvent)
            .where(AuditEvent.resource_type == "scheduled_task", AuditEvent.resource_id == task_id)
            .order_by(AuditEvent.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    return [
        ScheduledTaskExecutionLogRead(
            id=event.id,
            action=event.action,
            details=event.details,
            actor_user_id=event.actor_user_id,
            created_at=event.created_at,
        )
        for event in logs
    ]


@router.post("/scheduled-tasks/{task_id}/trigger", response_model=JobQueueRead, tags=["scheduled-tasks"])
def trigger_scheduled_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("schedules:*")),
):
    task = db.get(ScheduledTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled task not found")
    job = enqueue_job(db, job_type="run_scheduled_task", payload={"scheduled_task_id": task.id})
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="scheduled_task.trigger",
        resource_type="scheduled_task",
        resource_id=task.id,
        details={"job_id": job.id},
    )
    db.commit()
    db.refresh(job)
    return job


@router.get("/notifications", response_model=list[NotificationRead], tags=["notifications"])
def list_notifications(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Notification)
        .where(or_(Notification.recipient_user_id.is_(None), Notification.recipient_user_id == current_user.id))
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if status_filter:
        stmt = stmt.where(Notification.status == status_filter)
    return db.execute(stmt).scalars().all()


@router.get("/notifications/unread-count", response_model=NotificationUnreadCount, tags=["notifications"])
def get_notification_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread_count = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.status == "unread",
                or_(Notification.recipient_user_id.is_(None), Notification.recipient_user_id == current_user.id),
            )
        )
        or 0
    )
    return NotificationUnreadCount(unread_count=unread_count)


@router.post("/notifications", response_model=NotificationRead, tags=["notifications"])
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("notifications:*")),
):
    notification = Notification(**payload.model_dump(), created_by_id=current_user.id)
    db.add(notification)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="notification.create",
        resource_type="notification",
        resource_id=notification.id,
        details={"level": notification.level, "resource_type": notification.resource_type},
    )
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/notifications/read-all", response_model=NotificationMarkAllReadResult, tags=["notifications"])
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.execute(
            select(Notification).where(
                Notification.status == "unread",
                or_(Notification.recipient_user_id.is_(None), Notification.recipient_user_id == current_user.id),
            )
        )
        .scalars()
        .all()
    )
    now = datetime.now(UTC)
    for notification in notifications:
        notification.status = "read"
        notification.read_at = now
        db.add(notification)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="notification.read_all",
        resource_type="notification",
        resource_id=current_user.id,
        details={"marked_count": len(notifications)},
    )
    db.commit()
    return NotificationMarkAllReadResult(marked_count=len(notifications), unread_count=0)


@router.post("/notifications/{notification_id}/read", response_model=NotificationRead, tags=["notifications"])
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.get(Notification, notification_id)
    if not notification or (
        notification.recipient_user_id is not None and notification.recipient_user_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.status = "read"
    notification.read_at = datetime.now(UTC)
    db.add(notification)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="notification.read",
        resource_type="notification",
        resource_id=notification.id,
        details={},
    )
    db.commit()
    db.refresh(notification)
    return notification


@router.get("/log-clues", response_model=list[LogClueRead], tags=["log-clues"])
def list_log_clues(
    keyword: str | None = Query(None),
    severity: str | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(LogClue).order_by(LogClue.created_at.desc())
    if keyword:
        stmt = stmt.where(LogClue.keyword.ilike(f"%{keyword}%"))
    if severity:
        stmt = stmt.where(LogClue.severity == severity)
    if resource_type:
        stmt = stmt.where(LogClue.resource_type == resource_type)
    if resource_id:
        stmt = stmt.where(LogClue.resource_id == resource_id)

    clues = db.execute(stmt).scalars().all()
    filters = {
        key: value
        for key, value in {
            "keyword": keyword,
            "severity": severity,
            "resource_type": resource_type,
            "resource_id": resource_id,
        }.items()
        if value
    }
    if filters:
        record_audit(
            db,
            actor_user_id=current_user.id,
            action="log_clue.search",
            resource_type="log_clue",
            resource_id=resource_id or resource_type or "filtered",
            details={"filters": filters, "result_count": len(clues)},
        )
        db.commit()
    return clues


@router.post("/log-clues/import", response_model=list[LogClueRead], tags=["log-clues"])
def import_log_clues(
    payload: list[LogClueCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("logs:*")),
):
    clues: list[LogClue] = []
    for item in payload:
        clue = LogClue(**item.model_dump(), imported_by_id=current_user.id)
        db.add(clue)
        clues.append(clue)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="log_clue.import",
        resource_type="log_clue",
        resource_id=clues[0].id if clues else "none",
        details={"count": len(clues)},
    )
    db.commit()
    return clues


@router.get("/report-templates", response_model=list[ReportTemplateRead], tags=["report-templates"])
def list_report_templates(
    template_type: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(ReportTemplate).order_by(ReportTemplate.created_at.desc())
    if template_type:
        stmt = stmt.where(ReportTemplate.template_type == template_type)
    return db.execute(stmt).scalars().all()


@router.post("/report-templates", response_model=ReportTemplateRead, tags=["report-templates"])
def create_report_template(
    payload: ReportTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("templates:*")),
):
    template = ReportTemplate(**payload.model_dump(), created_by_id=current_user.id)
    db.add(template)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report_template.create",
        resource_type="report_template",
        resource_id=template.id,
        details={"template_type": template.template_type, "version": template.version},
    )
    db.commit()
    db.refresh(template)
    return template


@router.patch("/report-templates/{template_id}", response_model=ReportTemplateRead, tags=["report-templates"])
def update_report_template(
    template_id: str,
    payload: ReportTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("templates:*")),
):
    template = db.get(ReportTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report template not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.add(template)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report_template.update",
        resource_type="report_template",
        resource_id=template.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(template)
    return template


@router.delete("/report-templates/{template_id}", response_model=ReportTemplateRead, tags=["report-templates"])
def delete_report_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("templates:*")),
):
    template = db.get(ReportTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report template not found")
    template.status = "deleted"
    db.add(template)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="report_template.delete",
        resource_type="report_template",
        resource_id=template.id,
        details={"template_type": template.template_type, "version": template.version},
    )
    db.commit()
    db.refresh(template)
    return template


@router.get("/system-parameters", response_model=list[SystemParameterRead], tags=["system-parameters"])
def list_system_parameters(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(SystemParameter).order_by(SystemParameter.category.asc(), SystemParameter.key.asc())
    if category:
        stmt = stmt.where(SystemParameter.category == category)
    return db.execute(stmt).scalars().all()


@router.post("/system-parameters", response_model=SystemParameterRead, tags=["system-parameters"])
def upsert_system_parameter(
    payload: SystemParameterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("parameters:*")),
):
    parameter = db.execute(select(SystemParameter).where(SystemParameter.key == payload.key)).scalar_one_or_none()
    if not parameter:
        parameter = SystemParameter(key=payload.key)
    parameter.value = payload.value
    parameter.category = payload.category
    parameter.description = payload.description
    parameter.updated_by_id = current_user.id
    db.add(parameter)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="system_parameter.upsert",
        resource_type="system_parameter",
        resource_id=parameter.id,
        details={"key": parameter.key, "category": parameter.category},
    )
    db.commit()
    db.refresh(parameter)
    return parameter


@router.patch("/system-parameters/{parameter_id}", response_model=SystemParameterRead, tags=["system-parameters"])
def update_system_parameter(
    parameter_id: str,
    payload: SystemParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("parameters:*")),
):
    parameter = db.get(SystemParameter, parameter_id)
    if not parameter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System parameter not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(parameter, key, value)
    parameter.updated_by_id = current_user.id
    db.add(parameter)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="system_parameter.update",
        resource_type="system_parameter",
        resource_id=parameter.id,
        details=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    db.refresh(parameter)
    return parameter


@router.get("/ai-analysis", response_model=list[AiAnalysisJobRead], tags=["ai-analysis"])
def list_ai_analysis(
    review_status: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(AiAnalysisJob).order_by(AiAnalysisJob.created_at.desc())
    if review_status:
        stmt = stmt.where(AiAnalysisJob.review_status == review_status)
    return db.execute(stmt).scalars().all()


@router.post("/ai-analysis/{ai_job_id}/review", response_model=AiAnalysisJobRead, tags=["ai-analysis"])
def review_ai_analysis(
    ai_job_id: str,
    payload: AiReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("ai:review")),
):
    ai_job = db.get(AiAnalysisJob, ai_job_id)
    if not ai_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI analysis job not found")
    if payload.review_status not in {"approved", "rejected", "pending_review"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid review status")
    ai_job.review_status = payload.review_status
    details = dict(ai_job.details or {})
    details["review"] = {
        "comment": payload.comment,
        "reviewed_by_id": current_user.id,
        "reviewed_at": datetime.now(UTC).isoformat(),
    }
    ai_job.details = details
    db.add(ai_job)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="ai_analysis.review",
        resource_type="ai_analysis_job",
        resource_id=ai_job.id,
        details={"review_status": payload.review_status},
    )
    db.commit()
    db.refresh(ai_job)
    return ai_job


@router.get("/jobs", response_model=list[JobQueueRead], tags=["jobs"])
def list_jobs(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("jobs:*")),
):
    stmt = select(JobQueue).order_by(JobQueue.created_at.desc()).limit(100)
    if status_filter:
        stmt = stmt.where(JobQueue.status == status_filter)
    return db.execute(stmt).scalars().all()


@router.post("/jobs/{job_id}/retry", response_model=JobQueueRead, tags=["jobs"])
def retry_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("jobs:*")),
):
    job = db.get(JobQueue, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed job cannot be retried")
    job.status = "pending"
    job.locked_by = None
    job.locked_at = None
    job.last_error = None
    job.available_at = datetime.now(UTC)
    db.add(job)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="job.retry",
        resource_type="job_queue",
        resource_id=job.id,
        details={"job_type": job.job_type, "attempts": job.attempts},
    )
    db.commit()
    db.refresh(job)
    return job
