export interface UserRead {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string;
  role_name: string | null;
  permissions: string[];
  menu_items: string[];
}

export interface RoleRead {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  menu_items: string[];
}

export interface PermissionDefinitionRead {
  key: string;
  label: string;
  group: string;
}

export interface PermissionMatrixRead {
  menus: PermissionDefinitionRead[];
  permissions: PermissionDefinitionRead[];
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserRead;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  actor?: string;
}

export interface SystemSummary {
  frontend_boundary: string;
  backend_boundary: string;
  data_service_boundary: string;
  public_resources: string[];
}

export interface DashboardMetrics {
  coverage: {
    asset_total: number;
    configured_assets: number;
    coverage_rate: number;
  };
  rectification: {
    finding_total: number;
    open_findings: number;
    closed_findings: number;
    rectification_rate: number;
    pending_ticket_reviews: number;
    approved_ticket_reviews: number;
  };
  risk_hotspots: Array<{
    asset_type: string;
    severity: string;
    count: number;
  }>;
  pilot_effect: {
    inspection_total: number;
    completed_inspections: number;
    completed_reports: number;
    estimated_saved_minutes: number;
    efficiency_uplift_percent: number;
  };
  alerts: {
    high_open_findings: number;
  };
}

export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  vendor: string;
  status: string;
  owner: string;
  scenario: string;
  created_at: string;
  updated_at: string;
}

export interface AssetCreatePayload {
  name: string;
  asset_type: string;
  vendor: string;
  status: string;
  owner: string;
  scenario: string;
}

export interface AssetUpdatePayload {
  name?: string;
  asset_type?: string;
  vendor?: string;
  status?: string;
  owner?: string;
  scenario?: string;
}

export interface AssetListFilters {
  search?: string;
  asset_type?: string;
  status?: string;
  include_deleted?: boolean;
}

export interface ConfigFile {
  id: string;
  asset_id: string;
  filename: string;
  storage_path: string;
  version: number;
  checksum: string;
  source: string;
  uploaded_by_id: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigDiff {
  base_config_id: string;
  compare_config_id: string;
  added: string[];
  removed: string[];
  changed_count: number;
}

export interface ParseWarning {
  line_no: number;
  code: string;
  message: string;
  line: string;
}

export interface ParseRun {
  id: string;
  config_file_id: string;
  asset_id: string | null;
  status: string;
  parser_name: string;
  line_count: number;
  warning_count: number;
  summary: Record<string, unknown>;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NormalizedConfig {
  id: string;
  config_file_id: string;
  asset_id: string;
  config_version: number;
  hostname: string | null;
  interface_count: number;
  summary: Record<string, unknown>;
  indicators: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NormalizedConfigSearchItem {
  id: string;
  config_file_id: string;
  asset_id: string;
  asset_name: string;
  filename: string;
  config_version: number;
  hostname: string | null;
  matched_sections: string[];
  matched_content: string[];
  summary: Record<string, unknown>;
  indicators: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RuleSet {
  id: string;
  name: string;
  category: string;
  version: string;
  risk_level: string;
  status: string;
  scope: string;
  definition: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RuleSetVersion {
  id: string;
  rule_set_id: string;
  version: string;
  status: string;
  snapshot: Record<string, unknown>;
  effective_from: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleVersionDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RuleVersionDiff {
  rule_set_id: string;
  base_version_id: string;
  compare_version_id: string;
  changed_count: number;
  changes: RuleVersionDiffEntry[];
}

export interface RuleSetCreatePayload {
  name: string;
  category: string;
  version: string;
  risk_level: string;
  status: string;
  scope: string;
  definition: Record<string, unknown>;
}

export interface RuleSetUpdatePayload {
  name?: string;
  category?: string;
  version?: string;
  risk_level?: string;
  status?: string;
  scope?: string;
  definition?: Record<string, unknown>;
}

export interface InspectionRun {
  id: string;
  name: string;
  trigger_type: string;
  rule_set_id: string;
  requested_by_id: string;
  status: string;
  asset_scope: string[];
  last_message: string | null;
  assignment_summary: InspectionAssignment[];
  created_at: string;
  updated_at: string;
}

export interface InspectionAssignment {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  owner: string;
}

export interface InspectionCreatePayload {
  name: string;
  trigger_type: string;
  rule_set_id: string;
  asset_scope: string[];
}

export interface Finding {
  id: string;
  inspection_run_id: string;
  asset_id: string | null;
  rule_set_id: string;
  title: string;
  severity: string;
  status: string;
  evidence: Record<string, unknown>;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProblemTopicItem {
  finding_id: string;
  title: string;
  severity: string;
  status: string;
  asset_id: string | null;
  asset_name: string | null;
  asset_type: string | null;
  owner: string | null;
  rule_set_id: string;
  rule_name: string | null;
  ticket_id: string | null;
  ticket_status: string | null;
  log_clue_count: number;
  latest_log_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProblemTopicResponse {
  items: ProblemTopicItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProblemTopicFilters {
  rule_set_id?: string;
  asset_type?: string;
  owner?: string;
  status?: string;
  severity?: string;
}

export interface RuleRunResult {
  id: string;
  inspection_run_id: string;
  asset_id: string | null;
  rule_set_id: string;
  status: string;
  matched: boolean;
  severity: string | null;
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  finding_id: string;
  assignee: string;
  status: string;
  due_at: string | null;
  resolution_note: string | null;
  review_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCreatePayload {
  finding_id: string;
  assignee: string;
  due_at: string | null;
}

export interface TicketUpdatePayload {
  assignee?: string;
  status?: string;
  due_at?: string | null;
  resolution_note?: string | null;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TicketReminder {
  id: string;
  ticket_id: string;
  message: string;
  reminded_to: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TicketReminderCreatePayload {
  message: string;
  reminded_to?: string | null;
}

export interface ExceptionRequest {
  id: string;
  ticket_id: string;
  reason: string;
  status: string;
  expires_at: string;
  requested_by_id: string;
  approved_by_id: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExceptionCreatePayload {
  ticket_id: string;
  reason: string;
  expires_at: string;
}

export interface ReportJob {
  id: string;
  report_type: string;
  status: string;
  requested_by_id: string;
  file_path: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportJobCreatePayload {
  report_type: string;
  template_id?: string | null;
  parameters?: Record<string, unknown>;
}

export interface ReportArtifact {
  id: string;
  report_job_id: string;
  artifact_type: string;
  file_path: string;
  artifact_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiAnalysisJob {
  id: string;
  target_type: string;
  target_id: string;
  analysis_type: string;
  status: string;
  review_status: string;
  summary: string | null;
  details: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface LedgerItem {
  id: string;
  catalog_type: string;
  name: string;
  status: string;
  source: string;
  version: string;
  owner: string | null;
  content: Record<string, unknown>;
  imported_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerImportError {
  row_no: number;
  field: string;
  code: string;
  message: string;
  item: Record<string, unknown>;
}

export interface LedgerImportResult {
  catalog_type: string;
  source: string;
  accepted_count: number;
  rejected_count: number;
  imported_items: LedgerItem[];
  errors: LedgerImportError[];
}

export interface LedgerImportPayload {
  catalog_type: string;
  source: string;
  items: Array<{
    name?: string | null;
    status?: string;
    version?: string;
    owner?: string | null;
    content?: Record<string, unknown>;
  }>;
}

export interface ScheduledTask {
  id: string;
  name: string;
  task_type: string;
  enabled: boolean;
  interval_minutes: number;
  payload: Record<string, unknown>;
  last_run_at: string | null;
  next_run_at: string | null;
  last_message: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskCreatePayload {
  name: string;
  task_type: string;
  enabled: boolean;
  interval_minutes: number;
  payload: Record<string, unknown>;
  next_run_at?: string | null;
}

export interface ScheduledTaskUpdatePayload {
  name?: string;
  task_type?: string;
  enabled?: boolean;
  interval_minutes?: number;
  payload?: Record<string, unknown>;
  next_run_at?: string | null;
}

export interface ScheduledTaskExecutionLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: string;
  status: string;
  resource_type: string | null;
  resource_id: string | null;
  recipient_user_id: string | null;
  created_by_id: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationUnreadCount {
  unread_count: number;
}

export interface NotificationMarkAllReadResult {
  marked_count: number;
  unread_count: number;
}

export interface LogClue {
  id: string;
  source: string;
  severity: string;
  keyword: string;
  message: string;
  event_time: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  imported_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogClueFilters {
  keyword?: string;
  severity?: string;
  resource_type?: string;
  resource_id?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  template_type: string;
  version: string;
  status: string;
  body: string;
  variables: Record<string, unknown>;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemParameter {
  id: string;
  key: string;
  value: Record<string, unknown>;
  category: string;
  description: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobQueueItem {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  available_at: string;
  locked_by: string | null;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
