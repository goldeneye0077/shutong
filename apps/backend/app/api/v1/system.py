from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Asset, ConfigFile, Finding, InspectionRun, ReportJob, Ticket, User

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "domain": "backend"}


@router.get("/system/summary")
async def system_summary() -> dict[str, object]:
    return {
        "frontend_boundary": "前端只消费后端的 /api/v1 公共接口。",
        "backend_boundary": "后端负责认证、角色权限、流程状态、元数据和审计。",
        "data_service_boundary": "数据服务认领 PostgreSQL 任务队列并回写处理结果。",
        "public_resources": [
            "auth",
            "assets",
            "configs",
            "rules",
            "inspections",
            "findings",
            "tickets",
            "exceptions",
            "reports",
            "audit",
            "ledgers",
            "scheduled-tasks",
            "notifications",
            "log-clues",
            "report-templates",
            "system-parameters",
            "ai-analysis",
            "jobs",
        ],
    }


@router.get("/system/dashboard-metrics")
def dashboard_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, object]:
    active_assets = (
        db.execute(select(Asset).where(Asset.status != "deleted").order_by(Asset.created_at.desc()))
        .scalars()
        .all()
    )
    asset_ids = [asset.id for asset in active_assets]
    configured_asset_ids = set(
        db.execute(select(ConfigFile.asset_id).where(ConfigFile.asset_id.in_(asset_ids))).scalars().all()
        if asset_ids
        else []
    )
    findings = db.execute(select(Finding).order_by(Finding.created_at.desc())).scalars().all()
    tickets = db.execute(select(Ticket)).scalars().all()
    inspections_total = db.scalar(select(func.count()).select_from(InspectionRun)) or 0
    inspections_completed = db.scalar(
        select(func.count()).select_from(InspectionRun).where(InspectionRun.status == "completed")
    ) or 0
    reports_completed = db.scalar(select(func.count()).select_from(ReportJob).where(ReportJob.status == "completed")) or 0

    closed_statuses = {"closed", "exception_approved"}
    open_statuses = {"open", "pending", "ticketed", "in_progress", "pending_review", "remediation_submitted"}
    finding_total = len(findings)
    closed_findings = sum(1 for finding in findings if finding.status in closed_statuses)
    open_findings = sum(1 for finding in findings if finding.status in open_statuses)
    high_open_findings = sum(
        1
        for finding in findings
        if finding.status in open_statuses and finding.severity in {"critical", "high"}
    )
    pending_ticket_reviews = sum(1 for ticket in tickets if ticket.status == "pending_review")
    approved_ticket_reviews = sum(1 for ticket in tickets if ticket.review_status == "approved")

    asset_type_by_id = {asset.id: asset.asset_type for asset in active_assets}
    hotspot_map: dict[tuple[str, str], int] = {}
    for finding in findings:
        asset_type = asset_type_by_id.get(finding.asset_id or "", "未绑定对象")
        key = (asset_type, finding.severity)
        hotspot_map[key] = hotspot_map.get(key, 0) + 1
    hotspots = [
        {"asset_type": asset_type, "severity": severity, "count": count}
        for (asset_type, severity), count in sorted(hotspot_map.items(), key=lambda item: item[1], reverse=True)[:8]
    ]

    asset_total = len(active_assets)
    coverage_rate = round(len(configured_asset_ids) / asset_total * 100, 1) if asset_total else 0
    rectification_rate = round(closed_findings / finding_total * 100, 1) if finding_total else 100
    automation_baseline_minutes = inspections_total * 30 + reports_completed * 20
    estimated_saved_minutes = round(automation_baseline_minutes * 0.35)

    return {
        "coverage": {
            "asset_total": asset_total,
            "configured_assets": len(configured_asset_ids),
            "coverage_rate": coverage_rate,
        },
        "rectification": {
            "finding_total": finding_total,
            "open_findings": open_findings,
            "closed_findings": closed_findings,
            "rectification_rate": rectification_rate,
            "pending_ticket_reviews": pending_ticket_reviews,
            "approved_ticket_reviews": approved_ticket_reviews,
        },
        "risk_hotspots": hotspots,
        "pilot_effect": {
            "inspection_total": inspections_total,
            "completed_inspections": inspections_completed,
            "completed_reports": reports_completed,
            "estimated_saved_minutes": estimated_saved_minutes,
            "efficiency_uplift_percent": 35 if automation_baseline_minutes else 0,
        },
        "alerts": {
            "high_open_findings": high_open_findings,
        },
    }
