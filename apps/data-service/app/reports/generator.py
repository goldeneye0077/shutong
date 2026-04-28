from __future__ import annotations

import json
import csv
from io import StringIO
from zipfile import ZIP_DEFLATED, ZipFile
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.domain_models import Asset, ExceptionRequest, Finding, InspectionRun, ReportJob, ReportTemplate, RuleSet, SystemParameter, Ticket

REPORT_TYPE_LABELS = {
    "inspection_summary": "巡检摘要",
    "finding_digest": "问题摘要",
    "audit_snapshot": "审计快照",
    "inspection_package": "迎检资料包",
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


def _parameter_value(db: Session, key: str, default: dict) -> dict:
    parameter = db.execute(select(SystemParameter).where(SystemParameter.key == key)).scalar_one_or_none()
    if not parameter or not isinstance(parameter.value, dict):
        return default
    return {**default, **parameter.value}


def _render_template(body: str, values: dict[str, object]) -> str:
    rendered = body
    for key, value in values.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
    return rendered


def _collect_report_context(db: Session, report_job: ReportJob, parameters: dict | None = None) -> dict:
    report_settings = _parameter_value(
        db,
        "report.settings",
        {
            "finding_list_limit": 100,
            "include_closed_findings": True,
            "package_include_evidence_manifest": True,
        },
    )
    risk_settings = _parameter_value(db, "risk.levels", {"labels": SEVERITY_LABELS})
    merged_parameters = {**report_settings, **(parameters or {})}
    finding_limit = int(merged_parameters.get("finding_list_limit") or 100)
    include_closed = bool(merged_parameters.get("include_closed_findings", True))
    risk_labels = risk_settings.get("labels") if isinstance(risk_settings.get("labels"), dict) else SEVERITY_LABELS

    finding_stmt = select(Finding).order_by(Finding.created_at.desc()).limit(max(finding_limit, 1))
    if not include_closed:
        finding_stmt = finding_stmt.where(Finding.status != "closed")
    findings = db.execute(finding_stmt).scalars().all()
    tickets = db.execute(select(Ticket).order_by(Ticket.created_at.desc()).limit(20)).scalars().all()
    exceptions = (
        db.execute(select(ExceptionRequest).order_by(ExceptionRequest.created_at.desc()).limit(20)).scalars().all()
    )
    inspections = (
        db.execute(select(InspectionRun).order_by(InspectionRun.created_at.desc()).limit(10)).scalars().all()
    )
    asset_ids = [finding.asset_id for finding in findings if finding.asset_id]
    rule_ids = [finding.rule_set_id for finding in findings]
    assets = db.execute(select(Asset).where(Asset.id.in_(asset_ids))).scalars().all() if asset_ids else []
    rules = db.execute(select(RuleSet).where(RuleSet.id.in_(rule_ids))).scalars().all() if rule_ids else []
    asset_map = {asset.id: asset for asset in assets}
    rule_map = {rule.id: rule for rule in rules}
    ticket_by_finding: dict[str, Ticket] = {}
    for ticket in tickets:
        ticket_by_finding.setdefault(ticket.finding_id, ticket)

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
    severity_counts = {
        severity: db.scalar(select(func.count()).select_from(Finding).where(Finding.severity == severity)) or 0
        for severity in ["critical", "high", "medium", "low"]
    }
    metrics["severity_counts"] = severity_counts
    return {
        "findings": findings,
        "tickets": tickets,
        "exceptions": exceptions,
        "inspections": inspections,
        "asset_map": asset_map,
        "rule_map": rule_map,
        "ticket_by_finding": ticket_by_finding,
        "metrics": metrics,
        "risk_labels": risk_labels,
        "parameters": merged_parameters,
    }


def _build_summary_markdown(
    *,
    db: Session,
    report_job: ReportJob,
    context: dict,
    template_id: str | None = None,
) -> tuple[str, ReportTemplate | None]:
    metrics = context["metrics"]
    findings = context["findings"]
    tickets = context["tickets"]
    exceptions = context["exceptions"]
    inspections = context["inspections"]

    report_type_label = _label_from(REPORT_TYPE_LABELS, report_job.report_type)
    template = db.get(ReportTemplate, template_id) if template_id else None
    if not template or template.template_type != report_job.report_type or template.status == "deleted":
        template = (
            db.execute(
                select(ReportTemplate)
                .where(ReportTemplate.template_type == report_job.report_type, ReportTemplate.status == "active")
                .order_by(ReportTemplate.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )

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
    if template:
        template_body = _render_template(
            template.body,
            {
                "report_id": report_job.id,
                "report_type": report_type_label,
                "finding_total": metrics["finding_total"],
                "open_finding_total": metrics["open_finding_total"],
                "ticket_total": metrics["ticket_total"],
                "exception_total": metrics["exception_total"],
                "inspection_total": metrics["inspection_total"],
            },
        )
        lines.extend(["## 模板说明", "", template_body, ""])
    lines.extend(f"- {METRIC_LABELS[key]}: {metrics[key]}" for key in METRIC_LABELS)
    lines.extend(["", "## 最近问题", ""])
    if findings:
        lines.extend(
            f"- [{_label_from(context['risk_labels'], finding.severity)}] {finding.title}（{_label_from(STATUS_LABELS, finding.status)}）"
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

    return "\n".join(lines), template


def _build_finding_csv(context: dict) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["问题ID", "标题", "风险等级", "状态", "对象", "对象类型", "责任单位", "规则", "工单状态", "建议"])
    for finding in context["findings"]:
        asset = context["asset_map"].get(finding.asset_id or "")
        rule = context["rule_map"].get(finding.rule_set_id)
        ticket = context["ticket_by_finding"].get(finding.id)
        writer.writerow(
            [
                finding.id,
                finding.title,
                _label_from(context["risk_labels"], finding.severity),
                _label_from(STATUS_LABELS, finding.status),
                asset.name if asset else "",
                asset.asset_type if asset else "",
                asset.owner if asset else "",
                rule.name if rule else "",
                _label_from(STATUS_LABELS, ticket.status) if ticket else "",
                finding.recommendation or "",
            ]
        )
    return output.getvalue()


def _build_statistics_json(report_job: ReportJob, context: dict, template: ReportTemplate | None) -> str:
    payload = {
        "report_job_id": report_job.id,
        "report_type": report_job.report_type,
        "generated_at": datetime.now(UTC).isoformat(),
        "metrics": context["metrics"],
        "metric_labels": METRIC_LABELS,
        "risk_labels": context["risk_labels"],
        "template_id": template.id if template else None,
        "parameters": context["parameters"],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _build_evidence_manifest(report_job: ReportJob, context: dict) -> str:
    rows = []
    for finding in context["findings"]:
        rows.append(
            {
                "finding_id": finding.id,
                "title": finding.title,
                "severity": finding.severity,
                "asset_id": finding.asset_id,
                "rule_set_id": finding.rule_set_id,
                "evidence": finding.evidence,
                "recommendation": finding.recommendation,
            }
        )
    payload = {
        "report_job_id": report_job.id,
        "generated_at": datetime.now(UTC).isoformat(),
        "finding_count": len(rows),
        "findings": rows,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _artifact_metadata(
    *,
    report_job: ReportJob,
    artifact_label: str,
    template: ReportTemplate | None,
    context: dict,
    sections: list[str],
) -> dict:
    return {
        "report_type": report_job.report_type,
        "report_type_label": _label_from(REPORT_TYPE_LABELS, report_job.report_type),
        "artifact_label": artifact_label,
        "metrics": context["metrics"],
        "metric_labels": METRIC_LABELS,
        "template_id": template.id if template else None,
        "template_version": template.version if template else None,
        "parameters": context["parameters"],
        "settings": context["parameters"],
        "sections": sections,
    }


def generate_report_artifacts(
    db: Session,
    report_job: ReportJob,
    *,
    template_id: str | None = None,
    parameters: dict | None = None,
) -> list[dict]:
    exports_dir = Path(get_settings().storage_exports_path)
    exports_dir.mkdir(parents=True, exist_ok=True)
    context = _collect_report_context(db, report_job, parameters)
    summary_content, template = _build_summary_markdown(db=db, report_job=report_job, context=context, template_id=template_id)
    finding_csv = _build_finding_csv(context)
    statistics_json = _build_statistics_json(report_job, context, template)
    evidence_manifest_json = _build_evidence_manifest(report_job, context)

    summary_path = exports_dir / f"{report_job.report_type}-{report_job.id}-summary.md"
    findings_path = exports_dir / f"{report_job.report_type}-{report_job.id}-findings.csv"
    statistics_path = exports_dir / f"{report_job.report_type}-{report_job.id}-statistics.json"
    summary_path.write_text(summary_content, encoding="utf-8")
    findings_path.write_text(finding_csv, encoding="utf-8-sig")
    statistics_path.write_text(statistics_json, encoding="utf-8")

    artifacts = [
        {
            "artifact_type": "markdown",
            "file_path": str(summary_path),
            "artifact_metadata": _artifact_metadata(
                report_job=report_job,
                artifact_label="统计摘要",
                template=template,
                context=context,
                sections=["metrics", "recent_findings", "recent_tickets", "recent_exceptions", "recent_inspections"],
            ),
        },
        {
            "artifact_type": "csv",
            "file_path": str(findings_path),
            "artifact_metadata": _artifact_metadata(
                report_job=report_job,
                artifact_label="问题清单",
                template=template,
                context=context,
                sections=["finding_list"],
            ),
        },
        {
            "artifact_type": "json",
            "file_path": str(statistics_path),
            "artifact_metadata": _artifact_metadata(
                report_job=report_job,
                artifact_label="统计数据",
                template=template,
                context=context,
                sections=["metrics", "parameters", "risk_labels"],
            ),
        },
    ]

    if report_job.report_type == "inspection_package":
        package_path = exports_dir / f"{report_job.report_type}-{report_job.id}-package.zip"
        include_evidence_manifest = bool(context["parameters"].get("package_include_evidence_manifest", True))
        package_files = ["summary.md", "finding-list.csv", "statistics.json", "manifest.json"]
        if include_evidence_manifest:
            package_files.insert(3, "evidence-manifest.json")
        manifest = {
            "report_job_id": report_job.id,
            "report_type": report_job.report_type,
            "generated_at": datetime.now(UTC).isoformat(),
            "metrics": context["metrics"],
            "files": package_files,
            "parameters": context["parameters"],
        }
        with ZipFile(package_path, mode="w", compression=ZIP_DEFLATED) as archive:
            archive.writestr("summary.md", summary_content)
            archive.writestr("finding-list.csv", finding_csv)
            archive.writestr("statistics.json", statistics_json)
            if include_evidence_manifest:
                archive.writestr("evidence-manifest.json", evidence_manifest_json)
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        artifacts.append(
            {
                "artifact_type": "zip",
                "file_path": str(package_path),
                "artifact_metadata": _artifact_metadata(
                    report_job=report_job,
                    artifact_label="迎检资料包",
                    template=template,
                    context=context,
                    sections=["summary", "finding_list", "statistics", "evidence_manifest"],
                ),
            }
        )
    return artifacts


def generate_report_artifact(db: Session, report_job: ReportJob) -> dict:
    return generate_report_artifacts(db, report_job)[0]
