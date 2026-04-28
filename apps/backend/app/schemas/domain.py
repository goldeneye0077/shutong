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


class RuleSetVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_set_id: str
    version: str
    status: str
    snapshot: dict
    effective_from: datetime | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class RuleVersionDiffEntry(BaseModel):
    field: str
    before: object
    after: object


class RuleVersionDiffRead(BaseModel):
    rule_set_id: str
    base_version_id: str
    compare_version_id: str
    changed_count: int
    changes: list[RuleVersionDiffEntry]


class RuleVersionRollbackRequest(BaseModel):
    version: str | None = None


class InspectionCreate(BaseModel):
    name: str
    trigger_type: str
    rule_set_id: str
    asset_scope: list[str]


class InspectionAssignmentRead(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    owner: str


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
    assignment_summary: list[InspectionAssignmentRead] = Field(default_factory=list)
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


class NormalizedConfigSearchItem(BaseModel):
    id: str
    config_file_id: str
    asset_id: str
    asset_name: str
    filename: str
    config_version: int
    hostname: str | None
    matched_sections: list[str]
    matched_content: list[str]
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


class TicketReviewSubmit(BaseModel):
    resolution_note: str | None = None


class TicketReviewDecision(BaseModel):
    comment: str | None = None


class TicketAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    filename: str
    content_type: str | None
    size_bytes: int
    uploaded_by_id: str
    created_at: datetime
    updated_at: datetime


class TicketReminderCreate(BaseModel):
    message: str
    reminded_to: str | None = None


class TicketReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    message: str
    reminded_to: str | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    finding_id: str
    assignee: str
    status: str
    due_at: datetime | None
    resolution_note: str | None
    review_status: str
    submitted_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by_id: str | None
    review_comment: str | None
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
    template_id: str | None = None
    parameters: dict = Field(default_factory=dict)


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


class LedgerItemPayload(BaseModel):
    name: str | None = None
    status: str = "active"
    version: str = "v1"
    owner: str | None = None
    content: dict = Field(default_factory=dict)


class LedgerImportRequest(BaseModel):
    catalog_type: str
    source: str = "manual"
    items: list[LedgerItemPayload]


class LedgerItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    catalog_type: str
    name: str
    status: str
    source: str
    version: str
    owner: str | None
    content: dict
    imported_by_id: str | None
    created_at: datetime
    updated_at: datetime


class LedgerImportError(BaseModel):
    row_no: int
    field: str
    code: str
    message: str
    item: dict = Field(default_factory=dict)


class LedgerImportResult(BaseModel):
    catalog_type: str
    source: str
    accepted_count: int
    rejected_count: int
    imported_items: list[LedgerItemRead]
    errors: list[LedgerImportError]


class ConfigDiffRead(BaseModel):
    base_config_id: str
    compare_config_id: str
    added: list[str]
    removed: list[str]
    changed_count: int


class ScheduledTaskCreate(BaseModel):
    name: str
    task_type: str
    enabled: bool = True
    interval_minutes: int = 1440
    payload: dict = Field(default_factory=dict)
    next_run_at: datetime | None = None


class ScheduledTaskUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    interval_minutes: int | None = None
    payload: dict | None = None
    next_run_at: datetime | None = None


class ScheduledTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    task_type: str
    enabled: bool
    interval_minutes: int
    payload: dict
    last_run_at: datetime | None
    next_run_at: datetime | None
    last_message: str | None
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class ScheduledTaskExecutionLogRead(BaseModel):
    id: str
    action: str
    details: dict
    actor_user_id: str | None
    created_at: datetime


class NotificationCreate(BaseModel):
    title: str
    message: str
    level: str = "info"
    resource_type: str | None = None
    resource_id: str | None = None
    recipient_user_id: str | None = None


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    message: str
    level: str
    status: str
    resource_type: str | None
    resource_id: str | None
    recipient_user_id: str | None
    created_by_id: str | None
    read_at: datetime | None
    created_at: datetime
    updated_at: datetime


class NotificationUnreadCount(BaseModel):
    unread_count: int


class NotificationMarkAllReadResult(BaseModel):
    marked_count: int
    unread_count: int


class LogClueCreate(BaseModel):
    source: str
    severity: str
    keyword: str
    message: str
    event_time: datetime | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    details: dict = Field(default_factory=dict)


class LogClueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    severity: str
    keyword: str
    message: str
    event_time: datetime | None
    resource_type: str | None
    resource_id: str | None
    details: dict
    imported_by_id: str | None
    created_at: datetime
    updated_at: datetime


class ProblemTopicItem(BaseModel):
    finding_id: str
    title: str
    severity: str
    status: str
    asset_id: str | None
    asset_name: str | None
    asset_type: str | None
    owner: str | None
    rule_set_id: str
    rule_name: str | None
    ticket_id: str | None
    ticket_status: str | None
    log_clue_count: int
    latest_log_time: datetime | None
    created_at: datetime
    updated_at: datetime


class ProblemTopicResponse(BaseModel):
    items: list[ProblemTopicItem]
    total: int
    page: int
    page_size: int


class ReportTemplateCreate(BaseModel):
    name: str
    template_type: str
    version: str = "v1"
    status: str = "active"
    body: str
    variables: dict = Field(default_factory=dict)


class ReportTemplateUpdate(BaseModel):
    name: str | None = None
    version: str | None = None
    status: str | None = None
    body: str | None = None
    variables: dict | None = None


class ReportTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    template_type: str
    version: str
    status: str
    body: str
    variables: dict
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class SystemParameterCreate(BaseModel):
    key: str
    value: dict = Field(default_factory=dict)
    category: str = "general"
    description: str | None = None


class SystemParameterUpdate(BaseModel):
    value: dict | None = None
    category: str | None = None
    description: str | None = None


class SystemParameterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    value: dict
    category: str
    description: str | None
    updated_by_id: str | None
    created_at: datetime
    updated_at: datetime


class AiReviewRequest(BaseModel):
    review_status: str
    comment: str | None = None


class JobQueueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_type: str
    payload: dict
    status: str
    attempts: int
    available_at: datetime
    locked_by: str | None
    locked_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime
