// Generated from backend OpenAPI. Do not edit by hand.

export interface AiAnalysisJobRead {
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

export interface AiReviewRequest {
  review_status: string;
  comment?: string | null;
}

export interface AssetCreate {
  name: string;
  asset_type: string;
  vendor: string;
  status: string;
  owner: string;
  scenario: string;
}

export interface AssetRead {
  name: string;
  asset_type: string;
  vendor: string;
  status: string;
  owner: string;
  scenario: string;
  id: string;
  created_at: string;
  updated_at: string;
}

export interface AssetUpdate {
  name?: string | null;
  asset_type?: string | null;
  vendor?: string | null;
  status?: string | null;
  owner?: string | null;
  scenario?: string | null;
}

export interface Body_bulk_upload_configs_api_v1_configs_bulk_upload_post {
  asset_id: string;
  source?: string;
  uploads: string[];
}

export interface Body_upload_config_api_v1_configs_upload_post {
  asset_id: string;
  source?: string;
  upload: string;
}

export interface Body_upload_ticket_attachment_api_v1_tickets__ticket_id__attachments_post {
  upload: string;
}

export interface ConfigDiffRead {
  base_config_id: string;
  compare_config_id: string;
  added: string[];
  removed: string[];
  changed_count: number;
}

export interface ConfigFileRead {
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

export interface ExceptionApprovalRequest {
  comment?: string | null;
}

export interface ExceptionRequestCreate {
  ticket_id: string;
  reason: string;
  expires_at: string;
}

export interface ExceptionRequestRead {
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

export interface HTTPValidationError {
  detail?: ValidationError[];
}

export interface InspectionAssignmentRead {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  owner: string;
}

export interface InspectionCreate {
  name: string;
  trigger_type: string;
  rule_set_id: string;
  asset_scope: string[];
}

export interface InspectionRead {
  id: string;
  name: string;
  trigger_type: string;
  rule_set_id: string;
  requested_by_id: string;
  status: string;
  asset_scope: string[];
  last_message: string | null;
  assignment_summary?: InspectionAssignmentRead[];
  created_at: string;
  updated_at: string;
}

export interface JobQueueRead {
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

export interface LedgerImportError {
  row_no: number;
  field: string;
  code: string;
  message: string;
  item?: Record<string, unknown>;
}

export interface LedgerImportRequest {
  catalog_type: string;
  source?: string;
  items: LedgerItemPayload[];
}

export interface LedgerImportResult {
  catalog_type: string;
  source: string;
  accepted_count: number;
  rejected_count: number;
  imported_items: LedgerItemRead[];
  errors: LedgerImportError[];
}

export interface LedgerItemPayload {
  name?: string | null;
  status?: string;
  version?: string;
  owner?: string | null;
  content?: Record<string, unknown>;
}

export interface LedgerItemRead {
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

export interface LogClueCreate {
  source: string;
  severity: string;
  keyword: string;
  message: string;
  event_time?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown>;
}

export interface LogClueRead {
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

export interface LoginRequest {
  username: string;
  password: string;
}

export interface NormalizedConfigRead {
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

export interface NotificationCreate {
  title: string;
  message: string;
  level?: string;
  resource_type?: string | null;
  resource_id?: string | null;
  recipient_user_id?: string | null;
}

export interface NotificationMarkAllReadResult {
  marked_count: number;
  unread_count: number;
}

export interface NotificationRead {
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

export interface ParseRunRead {
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

export interface PermissionDefinitionRead {
  key: string;
  label: string;
  group: string;
}

export interface PermissionMatrixRead {
  menus: PermissionDefinitionRead[];
  permissions: PermissionDefinitionRead[];
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

export interface RefreshRequest {
  refresh_token: string;
}

export interface ReportArtifactRead {
  id: string;
  report_job_id: string;
  artifact_type: string;
  file_path: string;
  artifact_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReportJobCreate {
  report_type: string;
  template_id?: string | null;
  parameters?: Record<string, unknown>;
}

export interface ReportJobRead {
  id: string;
  report_type: string;
  status: string;
  requested_by_id: string;
  file_path: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplateCreate {
  name: string;
  template_type: string;
  version?: string;
  status?: string;
  body: string;
  variables?: Record<string, unknown>;
}

export interface ReportTemplateRead {
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

export interface ReportTemplateUpdate {
  name?: string | null;
  version?: string | null;
  status?: string | null;
  body?: string | null;
  variables?: Record<string, unknown> | null;
}

export interface RoleRead {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  menu_items: string[];
}

export interface RoleUpdate {
  description?: string | null;
  permissions?: string[] | null;
  menu_items?: string[] | null;
}

export interface RuleRunResultRead {
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

export interface RuleSetCreate {
  name: string;
  category: string;
  version: string;
  risk_level: string;
  status?: string;
  scope: string;
  definition?: Record<string, unknown>;
}

export interface RuleSetRead {
  name: string;
  category: string;
  version: string;
  risk_level: string;
  status?: string;
  scope: string;
  definition?: Record<string, unknown>;
  id: string;
  created_at: string;
  updated_at: string;
}

export interface RuleSetUpdate {
  name?: string | null;
  category?: string | null;
  version?: string | null;
  risk_level?: string | null;
  status?: string | null;
  scope?: string | null;
  definition?: Record<string, unknown> | null;
}

export interface RuleSetVersionRead {
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
  before: string;
  after: string;
}

export interface RuleVersionDiffRead {
  rule_set_id: string;
  base_version_id: string;
  compare_version_id: string;
  changed_count: number;
  changes: RuleVersionDiffEntry[];
}

export interface RuleVersionRollbackRequest {
  version?: string | null;
}

export interface ScheduledTaskCreate {
  name: string;
  task_type: string;
  enabled?: boolean;
  interval_minutes?: number;
  payload?: Record<string, unknown>;
  next_run_at?: string | null;
}

export interface ScheduledTaskExecutionLogRead {
  id: string;
  action: string;
  details: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export interface ScheduledTaskRead {
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

export interface ScheduledTaskUpdate {
  name?: string | null;
  enabled?: boolean | null;
  interval_minutes?: number | null;
  payload?: Record<string, unknown> | null;
  next_run_at?: string | null;
}

export interface SystemParameterCreate {
  key: string;
  value?: Record<string, unknown>;
  category?: string;
  description?: string | null;
}

export interface SystemParameterRead {
  id: string;
  key: string;
  value: Record<string, unknown>;
  category: string;
  description: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemParameterUpdate {
  value?: Record<string, unknown> | null;
  category?: string | null;
  description?: string | null;
}

export interface TicketAttachmentRead {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TicketCreate {
  finding_id: string;
  assignee: string;
  due_at?: string | null;
}

export interface TicketRead {
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

export interface TicketReminderCreate {
  message: string;
  reminded_to?: string | null;
}

export interface TicketReminderRead {
  id: string;
  ticket_id: string;
  message: string;
  reminded_to: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TicketReviewDecision {
  comment?: string | null;
}

export interface TicketReviewSubmit {
  resolution_note?: string | null;
}

export interface TicketUpdate {
  assignee?: string | null;
  status?: string | null;
  due_at?: string | null;
  resolution_note?: string | null;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserRead;
}

export interface UserCreate {
  username: string;
  password: string;
  full_name?: string | null;
  role_id: string;
  is_active?: boolean;
}

export interface UserRead {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string;
  role_name?: string | null;
  permissions?: string[];
  menu_items?: string[];
}

export interface UserUpdate {
  full_name?: string | null;
  password?: string | null;
  role_id?: string | null;
  is_active?: boolean | null;
}

export interface ValidationError {
  loc: string | number[];
  msg: string;
  type: string;
}
