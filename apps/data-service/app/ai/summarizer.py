from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.domain_models import (
    AiAnalysisJob,
    Finding,
    InspectionRun,
    NormalizedConfig,
    ParseRun,
    ReportArtifact,
    ReportJob,
)

REPORT_TYPE_LABELS = {
    "compliance_summary": "合规汇总",
    "finding_digest": "问题摘要",
    "audit_snapshot": "审计快照",
    "inspection_package": "迎检资料包",
}


def build_summary(db: Session, ai_job: AiAnalysisJob) -> tuple[str, dict]:
    if ai_job.target_type == "config_file":
        parse_run = (
            db.execute(
                select(ParseRun)
                .where(ParseRun.config_file_id == ai_job.target_id)
                .order_by(ParseRun.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        normalized = (
            db.execute(
                select(NormalizedConfig)
                .where(NormalizedConfig.config_file_id == ai_job.target_id)
                .order_by(NormalizedConfig.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        if not parse_run or not normalized:
            return (
                "智能草稿摘要尚未生成：当前配置还没有形成可用的解析结果。",
                {"target_type": ai_job.target_type, "target_id": ai_job.target_id},
            )

        exposure_text = "检测到" if normalized.indicators.get("has_any_any_rule") else "未检测到"
        summary = (
            f"智能草稿：该配置已完成解析，主机名为 {normalized.hostname or '未识别'}，"
            f"识别接口 {normalized.interface_count} 个，"
            f"{exposure_text}任意到任意放通特征。"
        )
        return summary, {
            "line_count": parse_run.line_count,
            "warning_count": parse_run.warning_count,
            "interface_count": normalized.interface_count,
            "indicators": normalized.indicators,
        }

    if ai_job.target_type == "inspection_run":
        inspection = db.get(InspectionRun, ai_job.target_id)
        if not inspection:
            return "智能草稿摘要尚未生成：巡检任务不存在。", {"target_type": ai_job.target_type}

        finding_total = (
            db.scalar(select(func.count()).select_from(Finding).where(Finding.inspection_run_id == inspection.id))
            or 0
        )
        high_total = (
            db.scalar(
                select(func.count())
                .select_from(Finding)
                .where(Finding.inspection_run_id == inspection.id, Finding.severity == "high")
            )
            or 0
        )

        summary = (
            f"智能草稿：巡检 {inspection.name} 已处理 {len(inspection.asset_scope)} 个对象，"
            f"共发现 {finding_total} 项问题，其中高风险 {high_total} 项。"
        )
        return summary, {
            "inspection_status": inspection.status,
            "asset_scope_size": len(inspection.asset_scope),
            "finding_total": finding_total,
            "high_risk_total": high_total,
        }

    if ai_job.target_type == "report_job":
        report_job = db.get(ReportJob, ai_job.target_id)
        artifact = (
            db.execute(
                select(ReportArtifact)
                .where(ReportArtifact.report_job_id == ai_job.target_id)
                .order_by(ReportArtifact.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        if not report_job or not artifact:
            return "智能草稿摘要尚未生成：报告产物还未就绪。", {"target_type": ai_job.target_type}

        report_type_label = REPORT_TYPE_LABELS.get(report_job.report_type, report_job.report_type)
        summary = (
            f"智能草稿：{report_type_label}报告已生成，可用于人工复核后对外输出。"
            f"当前主产物路径为 {artifact.file_path}。"
        )
        return summary, {
            "report_type": report_job.report_type,
            "artifact_type": artifact.artifact_type,
            "artifact_path": artifact.file_path,
            "artifact_metadata": artifact.artifact_metadata,
        }

    return (
        "智能草稿摘要尚未生成：当前目标类型暂未实现。",
        {"target_type": ai_job.target_type, "analysis_type": ai_job.analysis_type},
    )
