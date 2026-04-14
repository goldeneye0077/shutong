export interface UserRead {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string;
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
  created_at: string;
  updated_at: string;
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
