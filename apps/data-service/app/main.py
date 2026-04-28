from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db, init_database
from app.jobs.handlers import enqueue_due_scheduled_tasks
from app.jobs.service import claim_next_job, get_queue_stats
from app.workers.runner import WorkerRunner

_worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _worker_task
    init_database()
    settings = get_settings()
    if settings.enable_background_worker:
        _worker_task = asyncio.create_task(WorkerRunner().loop_forever())
    try:
        yield
    finally:
        if _worker_task:
            _worker_task.cancel()
            _worker_task = None


app = FastAPI(
    title="核心网配置合规数据服务",
    version="0.1.0",
    docs_url="/internal/docs",
    openapi_url="/internal/openapi.json",
    lifespan=lifespan,
)


@app.get("/internal/health", tags=["internal"])
async def health() -> dict[str, str]:
    return {"status": "ok", "domain": "data-service"}


@app.get("/internal/capabilities", tags=["internal"])
async def capabilities() -> dict[str, object]:
    settings = get_settings()
    return {
        "job_strategy": "PostgreSQL job_queue with SELECT ... FOR UPDATE SKIP LOCKED",
        "responsibilities": [
            "ingest",
            "parse",
            "normalize",
            "rule-execute",
            "schedule",
            "report-generate",
            "ai-summarize",
        ],
        "frontend_access": False,
        "background_worker_enabled": settings.enable_background_worker,
        "supported_job_types": [
            "parse_config",
            "run_inspection",
            "generate_report",
            "generate_ai_summary",
            "run_scheduled_task",
        ],
    }


@app.get("/internal/queue/stats", tags=["internal"])
async def queue_stats(db: Session = Depends(get_db)) -> dict[str, int]:
    return get_queue_stats(db)


@app.post("/internal/queue/claim-next", tags=["internal"])
async def claim_next(db: Session = Depends(get_db)) -> dict[str, str | None]:
    job = claim_next_job(db, get_settings().worker_name)
    if not job:
        return {"status": "idle", "job_id": None}
    return {"status": job.status, "job_id": job.id, "job_type": job.job_type}


@app.post("/internal/queue/run-next", tags=["internal"])
async def run_next() -> dict[str, object]:
    return await WorkerRunner().run_once()


@app.post("/internal/schedules/run-due", tags=["internal"])
async def run_due_schedules(db: Session = Depends(get_db)) -> dict[str, object]:
    job_ids = enqueue_due_scheduled_tasks(db)
    db.commit()
    return {"status": "queued", "count": len(job_ids), "job_ids": job_ids}
