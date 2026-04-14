from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "domain": "backend"}


@router.get("/system/summary")
async def system_summary() -> dict[str, object]:
    return {
        "frontend_boundary": "前端只消费 backend 的 /api/v1 公共接口。",
        "backend_boundary": "后端负责认证、RBAC、流程状态、元数据和审计。",
        "data_service_boundary": "data-service 认领 job_queue 任务并回写处理结果。",
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
        ],
    }
