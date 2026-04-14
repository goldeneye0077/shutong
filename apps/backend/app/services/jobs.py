from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.entities import JobQueue


def enqueue_job(db: Session, *, job_type: str, payload: dict) -> JobQueue:
    job = JobQueue(
        job_type=job_type,
        payload=payload,
        status="pending",
        attempts=0,
        available_at=datetime.now(UTC),
    )
    db.add(job)
    db.flush()
    return job

