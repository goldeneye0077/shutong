from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AssetBase(BaseModel):
    name: str
    asset_type: str
    vendor: str
    status: str
    owner: str
    scenario: str


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: str | None = None
    asset_type: str | None = None
    vendor: str | None = None
    status: str | None = None
    owner: str | None = None
    scenario: str | None = None


class AssetRead(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class ConfigFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asset_id: str
    filename: str
    storage_path: str
    version: int
    checksum: str
    source: str
    uploaded_by_id: str
    processing_status: str
    created_at: datetime
    updated_at: datetime


class RuleSetBase(BaseModel):
    name: str
    category: str
    version: str
    risk_level: str
    status: str = "draft"
    scope: str
    definition: dict = Field(default_factory=dict)


class RuleSetCreate(RuleSetBase):
    pass


class RuleSetUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    version: str | None = None
    risk_level: str | None = None
    status: str | None = None
    scope: str | None = None
    definition: dict | None = None


class RuleSetRead(RuleSetBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class InspectionCreate(BaseModel):
    name: str
    trigger_type: str
    rule_set_id: str
    asset_scope: list[str]


class InspectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    trigger_type: str
    rule_set_id: str
    requested_by_id: str
    status: str
    asset_scope: list[str]
    last_message: str | None
    created_at: datetime
    updated_at: datetime


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inspection_run_id: str
    asset_id: str | None
    rule_set_id: str
    title: str
    severity: str
    status: str
    evidence: dict
    recommendation: str | None
    created_at: datetime
    updated_at: datetime


class ParseRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    config_file_id: str
    asset_id: str | None
    status: str
    parser_name: str
    line_count: int
    warning_count: int
    summary: dict
    error_message: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class NormalizedConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    config_file_id: str
    asset_id: str
    config_version: int
    hostname: str | None
    interface_count: int
    summary: dict
    indicators: dict
    created_at: datetime
    updated_at: datetime


class RuleRunResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inspection_run_id: str
    asset_id: str | None
    rule_set_id: str
    status: str
    matched: bool
    severity: str | None
    summary: str | None
    details: dict
    created_at: datetime
    updated_at: datetime


class TicketCreate(BaseModel):
    finding_id: str
    assignee: str
    due_at: datetime | None = None


class TicketUpdate(BaseModel):
    assignee: str | None = None
    status: str | None = None
    due_at: datetime | None = None
    resolution_note: str | None = None


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    finding_id: str
    assignee: str
    status: str
    due_at: datetime | None
    resolution_note: str | None
    created_at: datetime
    updated_at: datetime


class ExceptionRequestCreate(BaseModel):
    ticket_id: str
    reason: str
    expires_at: datetime


class ExceptionApprovalRequest(BaseModel):
    comment: str | None = None


class ExceptionRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    reason: str
    status: str
    expires_at: datetime
    requested_by_id: str
    approved_by_id: str | None
    review_comment: str | None
    created_at: datetime
    updated_at: datetime


class ReportJobCreate(BaseModel):
    report_type: str


class ReportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_type: str
    status: str
    requested_by_id: str
    file_path: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ReportArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_job_id: str
    artifact_type: str
    file_path: str
    artifact_metadata: dict
    created_at: datetime
    updated_at: datetime


class AiAnalysisJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    target_type: str
    target_id: str
    analysis_type: str
    status: str
    review_status: str
    summary: str | None
    details: dict
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor_user_id: str | None
    action: str
    resource_type: str
    resource_id: str
    details: dict
    created_at: datetime
