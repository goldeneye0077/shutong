from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ai.summarizer import build_summary
from app.db.domain_models import (
    AiAnalysisJob,
    Asset,
    AuditEvent,
    ConfigFile,
    Finding,
    InspectionRun,
    NormalizedConfig,
    ParseRun,
    ReportArtifact,
    ReportJob,
    RuleRunResult,
    RuleSet,
)
from app.jobs.models import JobQueue
from app.jobs.service import enqueue_job
from app.normalizers.network import build_normalized_config
from app.parsers.network import parse_config_text
from app.reports.generator import generate_report_artifact
from app.rules.engine import evaluate_rule


def dispatch_job(db: Session, job: JobQueue) -> dict:
    handlers = {
        "parse_config": handle_parse_config,
        "run_inspection": handle_run_inspection,
        "generate_report": handle_generate_report,
        "generate_ai_summary": handle_generate_ai_summary,
    }
    handler = handlers.get(job.job_type)
    if not handler:
        raise ValueError(f"Unsupported job type: {job.job_type}")
    return handler(db, job)


def mark_target_failed(db: Session, job: JobQueue, error_message: str) -> None:
    payload = job.payload or {}

    if job.job_type == "parse_config":
        config_file = db.get(ConfigFile, payload.get("config_file_id"))
        if config_file:
            config_file.processing_status = "failed"
            db.add(config_file)
        parse_run = ParseRun(
            config_file_id=payload.get("config_file_id"),
            asset_id=payload.get("asset_id"),
            status="failed",
            parser_name="fallback-parser",
            error_message=error_message[:2000],
            completed_at=datetime.now(UTC),
        )
        db.add(parse_run)

    elif job.job_type == "run_inspection":
        inspection = db.get(InspectionRun, payload.get("inspection_run_id"))
        if inspection:
            inspection.status = "failed"
            inspection.last_message = error_message[:1000]
            db.add(inspection)

    elif job.job_type == "generate_report":
        report_job = db.get(ReportJob, payload.get("report_job_id"))
        if report_job:
            report_job.status = "failed"
            db.add(report_job)

    elif job.job_type == "generate_ai_summary":
        ai_job = db.get(AiAnalysisJob, payload.get("ai_analysis_job_id"))
        if ai_job:
            ai_job.status = "failed"
            ai_job.details = {"error": error_message[:2000]}
            db.add(ai_job)


def handle_parse_config(db: Session, job: JobQueue) -> dict:
    config_file = db.get(ConfigFile, job.payload["config_file_id"])
    if not config_file:
        raise ValueError("Config file not found for parse job.")

    asset = db.get(Asset, config_file.asset_id)
    if not asset:
        raise ValueError("Asset not found for parse job.")

    config_file.processing_status = "processing"
    db.add(config_file)

    parsed = parse_config_text(
        Path(config_file.storage_path).read_text(encoding="utf-8"),
        asset_type=asset.asset_type,
        vendor=asset.vendor,
    )

    parse_run = ParseRun(
        config_file_id=config_file.id,
        asset_id=asset.id,
        status="completed",
        parser_name=parsed["parser_name"],
        line_count=parsed["line_count"],
        warning_count=parsed["warning_count"],
        summary=parsed["summary"],
        completed_at=datetime.now(UTC),
    )
    db.add(parse_run)
    db.flush()

    db.execute(delete(NormalizedConfig).where(NormalizedConfig.config_file_id == config_file.id))
    normalized = NormalizedConfig(
        **build_normalized_config(
            config_file_id=config_file.id,
            asset_id=asset.id,
            config_version=config_file.version,
            parsed=parsed,
        )
    )
    db.add(normalized)
    db.flush()

    config_file.processing_status = "parsed"
    db.add(config_file)
    _record_system_audit(
        db,
        action="config.parse.completed",
        resource_type="config_file",
        resource_id=config_file.id,
        details={"parse_run_id": parse_run.id, "normalized_config_id": normalized.id},
    )
    _queue_ai_summary(
        db,
        target_type="config_file",
        target_id=config_file.id,
        analysis_type="config_parse_summary",
    )
    return {"job_type": job.job_type, "config_file_id": config_file.id, "status": "completed"}


def handle_run_inspection(db: Session, job: JobQueue) -> dict:
    inspection = db.get(InspectionRun, job.payload["inspection_run_id"])
    if not inspection:
        raise ValueError("Inspection run not found for execution job.")

    rule_set = db.get(RuleSet, inspection.rule_set_id)
    if not rule_set:
        raise ValueError("Rule set not found for inspection job.")

    inspection.status = "processing"
    db.add(inspection)

    db.execute(delete(Finding).where(Finding.inspection_run_id == inspection.id))
    db.execute(delete(RuleRunResult).where(RuleRunResult.inspection_run_id == inspection.id))

    finding_count = 0
    for asset_id in inspection.asset_scope:
        asset = db.get(Asset, asset_id)
        if not asset:
            continue

        normalized = (
            db.execute(
                select(NormalizedConfig)
                .where(NormalizedConfig.asset_id == asset.id)
                .order_by(NormalizedConfig.config_version.desc(), NormalizedConfig.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )

        if not normalized:
            db.add(
                RuleRunResult(
                    inspection_run_id=inspection.id,
                    asset_id=asset.id,
                    rule_set_id=rule_set.id,
                    status="skipped",
                    matched=False,
                    severity=rule_set.risk_level,
                    summary=f"{asset.name}：跳过执行，原因是没有可用的已解析配置。",
                    details={"reason": "missing_normalized_config"},
                )
            )
            continue

        evaluation = evaluate_rule(rule_set=rule_set, normalized_config=normalized, asset=asset)
        db.add(
            RuleRunResult(
                inspection_run_id=inspection.id,
                asset_id=asset.id,
                rule_set_id=rule_set.id,
                status=evaluation["status"],
                matched=evaluation["matched"],
                severity=evaluation["severity"],
                summary=evaluation["summary"],
                details=evaluation["details"],
            )
        )
        if evaluation["finding"]:
            finding_count += 1
            db.add(
                Finding(
                    inspection_run_id=inspection.id,
                    asset_id=asset.id,
                    rule_set_id=rule_set.id,
                    title=evaluation["finding"]["title"],
                    severity=evaluation["finding"]["severity"],
                    status="open",
                    evidence=evaluation["finding"]["evidence"],
                    recommendation=evaluation["finding"]["recommendation"],
                )
            )

    inspection.status = "completed"
    inspection.last_message = (
        f"已处理 {len(inspection.asset_scope)} 个对象，生成 {finding_count} 条问题记录。"
    )
    db.add(inspection)
    _record_system_audit(
        db,
        action="inspection.execution.completed",
        resource_type="inspection_run",
        resource_id=inspection.id,
        details={"finding_count": finding_count, "asset_scope_size": len(inspection.asset_scope)},
    )
    _queue_ai_summary(
        db,
        target_type="inspection_run",
        target_id=inspection.id,
        analysis_type="inspection_findings_summary",
    )
    return {"job_type": job.job_type, "inspection_run_id": inspection.id, "finding_count": finding_count}


def handle_generate_report(db: Session, job: JobQueue) -> dict:
    report_job = db.get(ReportJob, job.payload["report_job_id"])
    if not report_job:
        raise ValueError("Report job not found for generation.")

    report_job.status = "processing"
    db.add(report_job)

    db.execute(delete(ReportArtifact).where(ReportArtifact.report_job_id == report_job.id))
    artifact_data = generate_report_artifact(db, report_job)
    artifact = ReportArtifact(report_job_id=report_job.id, **artifact_data)
    db.add(artifact)

    report_job.status = "completed"
    report_job.file_path = artifact.file_path
    report_job.completed_at = datetime.now(UTC)
    db.add(report_job)

    _record_system_audit(
        db,
        action="report.generation.completed",
        resource_type="report_job",
        resource_id=report_job.id,
        details={"artifact_type": artifact.artifact_type, "file_path": artifact.file_path},
    )
    _queue_ai_summary(
        db,
        target_type="report_job",
        target_id=report_job.id,
        analysis_type="report_digest",
    )
    return {"job_type": job.job_type, "report_job_id": report_job.id, "file_path": artifact.file_path}


def handle_generate_ai_summary(db: Session, job: JobQueue) -> dict:
    ai_job = db.get(AiAnalysisJob, job.payload["ai_analysis_job_id"])
    if not ai_job:
        raise ValueError("AI analysis job not found.")

    ai_job.status = "processing"
    db.add(ai_job)
    summary, details = build_summary(db, ai_job)
    ai_job.status = "completed"
    ai_job.summary = summary
    ai_job.details = details
    ai_job.completed_at = datetime.now(UTC)
    db.add(ai_job)

    _record_system_audit(
        db,
        action="ai.analysis.completed",
        resource_type="ai_analysis_job",
        resource_id=ai_job.id,
        details={"target_type": ai_job.target_type, "target_id": ai_job.target_id},
    )
    return {"job_type": job.job_type, "ai_analysis_job_id": ai_job.id, "status": ai_job.status}


def _queue_ai_summary(db: Session, *, target_type: str, target_id: str, analysis_type: str) -> AiAnalysisJob:
    existing = (
        db.execute(
            select(AiAnalysisJob)
            .where(
                AiAnalysisJob.target_type == target_type,
                AiAnalysisJob.target_id == target_id,
                AiAnalysisJob.analysis_type == analysis_type,
            )
            .order_by(AiAnalysisJob.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if existing and existing.status in {"queued", "processing", "completed"}:
        return existing

    ai_job = AiAnalysisJob(
        target_type=target_type,
        target_id=target_id,
        analysis_type=analysis_type,
        status="queued",
        review_status="pending_review",
    )
    db.add(ai_job)
    db.flush()
    enqueue_job(db, job_type="generate_ai_summary", payload={"ai_analysis_job_id": ai_job.id})
    return ai_job


def _record_system_audit(
    db: Session,
    *,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict,
) -> None:
    db.add(
        AuditEvent(
            actor_user_id=None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        )
    )
