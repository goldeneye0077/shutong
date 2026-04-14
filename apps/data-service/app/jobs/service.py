from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.jobs.models import JobQueue


def get_queue_stats(db: Session) -> dict[str, int]:
    return {
        "pending": db.scalar(select(func.count()).select_from(JobQueue).where(JobQueue.status == "pending")) or 0,
        "processing": db.scalar(select(func.count()).select_from(JobQueue).where(JobQueue.status == "processing")) or 0,
        "completed": db.scalar(select(func.count()).select_from(JobQueue).where(JobQueue.status == "completed")) or 0,
        "failed": db.scalar(select(func.count()).select_from(JobQueue).where(JobQueue.status == "failed")) or 0,
    }


def claim_next_job(db: Session, worker_name: str) -> JobQueue | None:
    now = datetime.now(UTC)
    dialect_name = db.bind.dialect.name if db.bind else "sqlite"

    if dialect_name == "postgresql":
        stmt = (
            select(JobQueue)
            .where(JobQueue.status == "pending", JobQueue.available_at <= now)
            .order_by(JobQueue.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        job = db.execute(stmt).scalars().first()
        if not job:
            db.rollback()
            return None
        job.status = "processing"
        job.locked_by = worker_name
        job.locked_at = now
        job.attempts += 1
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    job = (
        db.execute(
            select(JobQueue)
            .where(JobQueue.status == "pending", JobQueue.available_at <= now)
            .order_by(JobQueue.created_at.asc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if not job:
        return None

    updated = db.execute(
        update(JobQueue)
        .where(JobQueue.id == job.id, JobQueue.status == "pending")
        .values(
            status="processing",
            locked_by=worker_name,
            locked_at=now,
            attempts=job.attempts + 1,
        )
    )
    if updated.rowcount == 0:
        db.rollback()
        return None

    db.commit()
    return db.get(JobQueue, job.id)


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


def mark_job_completed(db: Session, job: JobQueue) -> JobQueue:
    job.status = "completed"
    job.locked_by = None
    job.locked_at = None
    db.add(job)
    db.flush()
    return job


def mark_job_failed(db: Session, job: JobQueue, error_message: str) -> JobQueue:
    job.status = "failed"
    job.locked_by = None
    job.locked_at = None
    job.last_error = error_message[:2000]
    db.add(job)
    db.flush()
    return job
