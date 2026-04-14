from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Asset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    scenario: Mapped[str] = mapped_column(String(100), nullable=False)


class ConfigFile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "config_files"

    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="manual")
    uploaded_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    processing_status: Mapped[str] = mapped_column(String(50), default="queued")


class RuleSet(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rule_sets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[dict] = mapped_column(JSON, default=dict)


class InspectionRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inspection_runs"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_set_id: Mapped[str] = mapped_column(ForeignKey("rule_sets.id"), nullable=False)
    requested_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued")
    asset_scope: Mapped[list[str]] = mapped_column(JSON, default=list)
    last_message: Mapped[str | None] = mapped_column(Text)


class Finding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "findings"

    inspection_run_id: Mapped[str] = mapped_column(ForeignKey("inspection_runs.id"), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"))
    rule_set_id: Mapped[str] = mapped_column(ForeignKey("rule_sets.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open")
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    recommendation: Mapped[str | None] = mapped_column(Text)


class Ticket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tickets"

    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id"), nullable=False)
    assignee: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)


class ExceptionRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "exceptions"

    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    requested_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    approved_by_id: Mapped[str | None] = mapped_column(String(36))
    review_comment: Mapped[str | None] = mapped_column(Text)


class ReportJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_jobs"

    report_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued")
    requested_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ParseRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "parse_runs"

    config_file_id: Mapped[str] = mapped_column(ForeignKey("config_files.id"), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"))
    status: Mapped[str] = mapped_column(String(50), default="queued")
    parser_name: Mapped[str] = mapped_column(String(100), nullable=False)
    line_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NormalizedConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "normalized_configs"

    config_file_id: Mapped[str] = mapped_column(ForeignKey("config_files.id"), nullable=False)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), nullable=False)
    config_version: Mapped[int] = mapped_column(Integer, nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(255))
    interface_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    indicators: Mapped[dict] = mapped_column(JSON, default=dict)


class RuleRunResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rule_run_results"

    inspection_run_id: Mapped[str] = mapped_column(ForeignKey("inspection_runs.id"), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"))
    rule_set_id: Mapped[str] = mapped_column(ForeignKey("rule_sets.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="completed")
    matched: Mapped[bool] = mapped_column(Boolean, default=False)
    severity: Mapped[str | None] = mapped_column(String(20))
    summary: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class ReportArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_artifacts"

    report_job_id: Mapped[str] = mapped_column(ForeignKey("report_jobs.id"), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    artifact_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class AiAnalysisJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_analysis_jobs"

    target_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued")
    review_status: Mapped[str] = mapped_column(String(50), default="pending_review")
    summary: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_events"

    actor_user_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
