"""initial explicit schema baseline

Revision ID: 20260427_0001
Revises:
Create Date: 2026-04-27 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260427_0001"
down_revision = None
branch_labels = None
depends_on = None


def _id_column() -> sa.Column:
    return sa.Column("id", sa.String(length=36), primary_key=True, nullable=False)


def _timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "ai_analysis_jobs",
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("analysis_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("review_status", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "assets",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=50), nullable=False),
        sa.Column("vendor", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("owner", sa.String(length=100), nullable=False),
        sa.Column("scenario", sa.String(length=100), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "job_queue",
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_by", sa.String(length=100)),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "roles",
        sa.Column("name", sa.String(length=50), nullable=False, unique=True),
        sa.Column("description", sa.String(length=255)),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("menu_items", sa.JSON(), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "rule_sets",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=100), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=255)),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("role_id", sa.String(length=36), sa.ForeignKey("roles.id"), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "audit_events",
        sa.Column("actor_user_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        _id_column(),
    )
    op.create_table(
        "config_files",
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("uploaded_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("processing_status", sa.String(length=50), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "inspection_runs",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("trigger_type", sa.String(length=50), nullable=False),
        sa.Column("rule_set_id", sa.String(length=36), sa.ForeignKey("rule_sets.id"), nullable=False),
        sa.Column("requested_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("asset_scope", sa.JSON(), nullable=False),
        sa.Column("last_message", sa.Text()),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "ledger_items",
        sa.Column("catalog_type", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("owner", sa.String(length=100)),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("imported_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "log_clues",
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("keyword", sa.String(length=120), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True)),
        sa.Column("resource_type", sa.String(length=100)),
        sa.Column("resource_id", sa.String(length=36)),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("imported_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "notifications",
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("resource_type", sa.String(length=100)),
        sa.Column("resource_id", sa.String(length=36)),
        sa.Column("recipient_user_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("created_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "report_jobs",
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("requested_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_path", sa.String(length=500)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "report_templates",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("template_type", sa.String(length=80), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("variables", sa.JSON(), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "rule_set_versions",
        sa.Column("rule_set_id", sa.String(length=36), sa.ForeignKey("rule_sets.id"), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True)),
        sa.Column("created_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "scheduled_tasks",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("task_type", sa.String(length=80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("interval_minutes", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("last_message", sa.Text()),
        sa.Column("created_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "system_parameters",
        sa.Column("key", sa.String(length=120), nullable=False, unique=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255)),
        sa.Column("updated_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "findings",
        sa.Column("inspection_run_id", sa.String(length=36), sa.ForeignKey("inspection_runs.id"), nullable=False),
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("assets.id")),
        sa.Column("rule_set_id", sa.String(length=36), sa.ForeignKey("rule_sets.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("recommendation", sa.Text()),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "normalized_configs",
        sa.Column("config_file_id", sa.String(length=36), sa.ForeignKey("config_files.id"), nullable=False),
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("config_version", sa.Integer(), nullable=False),
        sa.Column("hostname", sa.String(length=255)),
        sa.Column("interface_count", sa.Integer(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("indicators", sa.JSON(), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "parse_runs",
        sa.Column("config_file_id", sa.String(length=36), sa.ForeignKey("config_files.id"), nullable=False),
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("assets.id")),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("parser_name", sa.String(length=100), nullable=False),
        sa.Column("line_count", sa.Integer(), nullable=False),
        sa.Column("warning_count", sa.Integer(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "report_artifacts",
        sa.Column("report_job_id", sa.String(length=36), sa.ForeignKey("report_jobs.id"), nullable=False),
        sa.Column("artifact_type", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "rule_run_results",
        sa.Column("inspection_run_id", sa.String(length=36), sa.ForeignKey("inspection_runs.id"), nullable=False),
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("assets.id")),
        sa.Column("rule_set_id", sa.String(length=36), sa.ForeignKey("rule_sets.id"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("matched", sa.Boolean(), nullable=False),
        sa.Column("severity", sa.String(length=20)),
        sa.Column("summary", sa.Text()),
        sa.Column("details", sa.JSON(), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "tickets",
        sa.Column("finding_id", sa.String(length=36), sa.ForeignKey("findings.id"), nullable=False),
        sa.Column("assignee", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("review_status", sa.String(length=50), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("review_comment", sa.Text()),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "exceptions",
        sa.Column("ticket_id", sa.String(length=36), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("review_comment", sa.Text()),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "ticket_attachments",
        sa.Column("ticket_id", sa.String(length=36), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120)),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        _id_column(),
        *_timestamps(),
    )
    op.create_table(
        "ticket_reminders",
        sa.Column("ticket_id", sa.String(length=36), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("reminded_to", sa.String(length=100)),
        sa.Column("created_by_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        _id_column(),
        *_timestamps(),
    )


def downgrade() -> None:
    for table_name in (
        "ticket_reminders",
        "ticket_attachments",
        "exceptions",
        "tickets",
        "rule_run_results",
        "report_artifacts",
        "parse_runs",
        "normalized_configs",
        "findings",
        "system_parameters",
        "scheduled_tasks",
        "rule_set_versions",
        "report_templates",
        "report_jobs",
        "notifications",
        "log_clues",
        "ledger_items",
        "inspection_runs",
        "config_files",
        "audit_events",
        "users",
        "rule_sets",
        "roles",
        "job_queue",
        "assets",
        "ai_analysis_jobs",
    ):
        op.drop_table(table_name)
