from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.jobs.handlers import dispatch_job, enqueue_due_scheduled_tasks, mark_target_failed
from app.jobs.service import claim_next_job, mark_job_completed, mark_job_failed

logger = logging.getLogger(__name__)


class WorkerRunner:
    async def run_once(self) -> dict[str, object]:
        with SessionLocal() as db:
            job = claim_next_job(db, get_settings().worker_name)
            if not job:
                return {"status": "idle"}
            logger.info("Claimed job %s (%s)", job.id, job.job_type)
            try:
                result = dispatch_job(db, job)
                mark_job_completed(db, job)
                db.commit()
                return {"status": "completed", "job_id": job.id, "job_type": job.job_type, **result}
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to process job %s (%s)", job.id, job.job_type)
                db.rollback()

        with SessionLocal() as db:
            failed_job = db.get(type(job), job.id)
            if failed_job:
                mark_target_failed(db, failed_job, str(exc))
                mark_job_failed(db, failed_job, str(exc))
                db.commit()
            return {"status": "failed", "job_id": job.id, "job_type": job.job_type, "error": str(exc)}

    async def loop_forever(self) -> None:
        settings = get_settings()
        while True:
            with SessionLocal() as db:
                enqueue_due_scheduled_tasks(db)
                db.commit()
            await self.run_once()
            await asyncio.sleep(settings.poll_interval_seconds)
