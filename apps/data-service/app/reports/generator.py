from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.domain_models import ExceptionRequest, Finding, InspectionRun, ReportJob, Ticket

REPORT_TYPE_LABELS = {
    "inspection_summary": "巡检摘要",
    "finding_digest": "问题摘要",
    "audit_snapshot": "审计快照",
}

STATUS_LABELS = {
    "open": "待处理",
    "closed": "已关闭",
    "pending": "待处理",
    "approved": "已批准",
    "rejected": "已驳回",
    "active": "启用",
    "completed": "已完成",
    "queued": "排队中",
    "processing": "处理中",
    "pending_review": "待人工确认",
    "exception_approved": "例外已批准",
}

SEVERITY_LABELS = {
    "critical": "严重",
    "high": "高",
    "medium": "中",
    "low": "低",
}

METRIC_LABELS = {
    "finding_total": "问题总数",
    "open_finding_total": "未关闭问题数",
    "ticket_total": "工单总数",
    "exception_total": "例外总数",
    "inspection_total": "巡检总数",
}


def _label_from(mapping: dict[str, str], value: str | None) -> str:
    if not value:
        return "-"
    return mapping.get(value, value)


def generate_report_artifact(db: Session, report_job: ReportJob) -> dict:
    findings = db.execute(select(Finding).order_by(Finding.created_at.desc()).limit(20)).scalars().all()
    tickets = db.execute(select(Ticket).order_by(Ticket.created_at.desc()).limit(20)).scalars().all()
    exceptions = (
        db.execute(select(ExceptionRequest).order_by(ExceptionRequest.created_at.desc()).limit(20)).scalars().all()
    )
    inspections = (
        db.execute(select(InspectionRun).order_by(InspectionRun.created_at.desc()).limit(10)).scalars().all()
    )

    metrics = {
        "finding_total": db.scalar(select(func.count()).select_from(Finding)) or 0,
        "open_finding_total": db.scalar(
            select(func.count()).select_from(Finding).where(Finding.status != "closed")
        )
        or 0,
        "ticket_total": db.scalar(select(func.count()).select_from(Ticket)) or 0,
        "exception_total": db.scalar(select(func.count()).select_from(ExceptionRequest)) or 0,
        "inspection_total": db.scalar(select(func.count()).select_from(InspectionRun)) or 0,
    }

    exports_dir = Path(get_settings().storage_exports_path)
    exports_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{report_job.report_type}-{report_job.id}.md"
    file_path = exports_dir / filename
    report_type_label = _label_from(REPORT_TYPE_LABELS, report_job.report_type)

    lines = [
        f"# {report_type_label}",
        "",
        f"- 生成时间: {datetime.now(UTC).isoformat()}",
        f"- 报告任务 ID: {report_job.id}",
        f"- 报告类型编码: {report_job.report_type}",
        "",
        "## 指标汇总",
        "",
    ]
    lines.extend(f"- {METRIC_LABELS[key]}: {value}" for key, value in metrics.items())
    lines.extend(["", "## 最近问题", ""])
    if findings:
        lines.extend(
            f"- [{_label_from(SEVERITY_LABELS, finding.severity)}] {finding.title}（{_label_from(STATUS_LABELS, finding.status)}）"
            for finding in findings
        )
    else:
        lines.append("- 暂无问题数据。")

    lines.extend(["", "## 最近工单", ""])
    if tickets:
        lines.extend(
            f"- {ticket.id}: {ticket.assignee} / {_label_from(STATUS_LABELS, ticket.status)}"
            for ticket in tickets
        )
    else:
        lines.append("- 暂无工单数据。")

    lines.extend(["", "## 最近例外申请", ""])
    if exceptions:
        lines.extend(
            f"- {exception.id}: {_label_from(STATUS_LABELS, exception.status)} / 到期时间 {exception.expires_at.isoformat()}"
            for exception in exceptions
        )
    else:
        lines.append("- 暂无例外申请数据。")

    lines.extend(["", "## 最近巡检", ""])
    if inspections:
        lines.extend(
            f"- {inspection.name}: {_label_from(STATUS_LABELS, inspection.status)} / 对象数量 {len(inspection.asset_scope)}"
            for inspection in inspections
        )
    else:
        lines.append("- 暂无巡检数据。")

    file_path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "artifact_type": "markdown",
        "file_path": str(file_path),
        "artifact_metadata": {
            "report_type": report_job.report_type,
            "report_type_label": report_type_label,
            "metrics": metrics,
            "metric_labels": METRIC_LABELS,
            "sections": ["metrics", "recent_findings", "recent_tickets", "recent_exceptions", "recent_inspections"],
        },
    }
