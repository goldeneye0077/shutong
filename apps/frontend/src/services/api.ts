import type {
  AiAnalysisJob,
  Asset,
  AssetCreatePayload,
  AssetListFilters,
  AssetUpdatePayload,
  AuditEvent,
  ConfigFile,
  ConfigDiff,
  DashboardMetrics,
  ExceptionCreatePayload,
  ExceptionRequest,
  Finding,
  InspectionCreatePayload,
  InspectionRun,
  JobQueueItem,
  LedgerImportPayload,
  LedgerImportResult,
  LedgerItem,
  LogClue,
  LogClueFilters,
  NotificationItem,
  NotificationMarkAllReadResult,
  NotificationUnreadCount,
  NormalizedConfig,
  NormalizedConfigSearchItem,
  PagedResponse,
  ParseRun,
  PermissionMatrixRead,
  ProblemTopicFilters,
  ProblemTopicResponse,
  ReportArtifact,
  ReportTemplate,
  ReportJobCreatePayload,
  ReportJob,
  RoleRead,
  RuleRunResult,
  RuleSetCreatePayload,
  RuleVersionDiff,
  RuleSetVersion,
  RuleSetUpdatePayload,
  RuleSet,
  ScheduledTask,
  ScheduledTaskCreatePayload,
  ScheduledTaskExecutionLog,
  ScheduledTaskUpdatePayload,
  SystemParameter,
  SystemSummary,
  TicketCreatePayload,
  TicketAttachment,
  TicketReminder,
  TicketReminderCreatePayload,
  TicketUpdatePayload,
  Ticket,
  TokenBundle,
  UserRead,
} from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(normalizeApiMessage(message));
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

function normalizeApiMessage(message: string): string {
  const messageMap: Record<string, string> = {
    "Could not validate credentials": "登录状态已失效，请重新登录。",
    "You do not have permission to perform this action.": "没有权限执行此操作。",
    Unauthorized: "登录状态已失效，请重新登录。",
    Forbidden: "没有权限执行此操作。",
  };
  return messageMap[message] ?? message;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail?: unknown }).detail ?? "请求失败")
        : response.statusText || "请求失败";
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] ?? null;
}

async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers(options.headers ?? {});
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const message = response.statusText || "请求失败";
    throw new ApiError(message, response.status, await response.text());
  }

  return {
    blob: await response.blob(),
    filename: extractFilename(response.headers.get("content-disposition")),
  };
}

export async function loginRequest(username: string, password: string): Promise<TokenBundle> {
  return requestJson<TokenBundle>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getSystemSummary(token?: string | null): Promise<SystemSummary> {
  return requestJson<SystemSummary>("/system/summary", { token: token ?? undefined });
}

export async function getDashboardMetrics(token: string): Promise<DashboardMetrics> {
  return requestJson<DashboardMetrics>("/system/dashboard-metrics", { token });
}

export async function listAssets(token: string, filters: AssetListFilters = {}): Promise<PagedResponse<Asset>> {
  const search = new URLSearchParams({ page: "1", page_size: "50" });
  if (filters.search) {
    search.set("search", filters.search);
  }
  if (filters.asset_type) {
    search.set("asset_type", filters.asset_type);
  }
  if (filters.status) {
    search.set("status", filters.status);
  }
  if (filters.include_deleted) {
    search.set("include_deleted", "true");
  }
  return requestJson<PagedResponse<Asset>>(`/assets?${search.toString()}`, { token });
}

export async function createAsset(token: string, payload: AssetCreatePayload): Promise<Asset> {
  return requestJson<Asset>("/assets", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateAsset(token: string, assetId: string, payload: AssetUpdatePayload): Promise<Asset> {
  return requestJson<Asset>(`/assets/${assetId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteAsset(token: string, assetId: string): Promise<Asset> {
  return requestJson<Asset>(`/assets/${assetId}`, {
    method: "DELETE",
    token,
  });
}

export async function listConfigs(token: string, assetId: string): Promise<PagedResponse<ConfigFile>> {
  return requestJson<PagedResponse<ConfigFile>>(
    `/configs?page=1&page_size=50&asset_id=${encodeURIComponent(assetId)}`,
    { token },
  );
}

export async function uploadConfig(
  token: string,
  payload: { assetId: string; source: string; file: File },
): Promise<ConfigFile> {
  const formData = new FormData();
  formData.set("asset_id", payload.assetId);
  formData.set("source", payload.source);
  formData.set("upload", payload.file);
  return requestJson<ConfigFile>("/configs/upload", {
    method: "POST",
    token,
    body: formData,
  });
}

export async function uploadConfigsBulk(
  token: string,
  payload: { assetId: string; source: string; files: File[] },
): Promise<ConfigFile[]> {
  const formData = new FormData();
  formData.set("asset_id", payload.assetId);
  formData.set("source", payload.source);
  payload.files.forEach((file) => formData.append("uploads", file));
  return requestJson<ConfigFile[]>("/configs/bulk-upload", {
    method: "POST",
    token,
    body: formData,
  });
}

export async function listParseRuns(token: string, configId: string): Promise<ParseRun[]> {
  return requestJson<ParseRun[]>(`/configs/${configId}/parse-runs`, { token });
}

export async function listNormalizedConfigs(token: string, configId: string): Promise<NormalizedConfig[]> {
  return requestJson<NormalizedConfig[]>(`/configs/${configId}/normalized`, { token });
}

export async function searchNormalizedConfigs(
  token: string,
  filters: { asset_id?: string; hostname?: string; section?: string; keyword?: string },
): Promise<PagedResponse<NormalizedConfigSearchItem>> {
  const search = new URLSearchParams({ page: "1", page_size: "50" });
  if (filters.asset_id) {
    search.set("asset_id", filters.asset_id);
  }
  if (filters.hostname) {
    search.set("hostname", filters.hostname);
  }
  if (filters.section) {
    search.set("section", filters.section);
  }
  if (filters.keyword) {
    search.set("keyword", filters.keyword);
  }
  return requestJson<PagedResponse<NormalizedConfigSearchItem>>(`/configs/normalized/search?${search.toString()}`, { token });
}

export async function listConfigAiSummaries(token: string, configId: string): Promise<AiAnalysisJob[]> {
  return requestJson<AiAnalysisJob[]>(`/configs/${configId}/ai-summaries`, { token });
}

export async function diffConfigs(token: string, baseConfigId: string, compareConfigId: string): Promise<ConfigDiff> {
  const search = new URLSearchParams({ base_config_id: baseConfigId, compare_config_id: compareConfigId });
  return requestJson<ConfigDiff>(`/configs/diff?${search.toString()}`, { token });
}

export async function listRules(token: string): Promise<RuleSet[]> {
  return requestJson<RuleSet[]>("/rules", { token });
}

export async function createRule(token: string, payload: RuleSetCreatePayload): Promise<RuleSet> {
  return requestJson<RuleSet>("/rules", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateRule(token: string, ruleId: string, payload: RuleSetUpdatePayload): Promise<RuleSet> {
  return requestJson<RuleSet>(`/rules/${ruleId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listRuleVersions(token: string, ruleId: string): Promise<RuleSetVersion[]> {
  return requestJson<RuleSetVersion[]>(`/rules/${ruleId}/versions`, { token });
}

export async function diffRuleVersions(
  token: string,
  ruleId: string,
  baseVersionId: string,
  compareVersionId: string,
): Promise<RuleVersionDiff> {
  const search = new URLSearchParams({ base_version_id: baseVersionId, compare_version_id: compareVersionId });
  return requestJson<RuleVersionDiff>(`/rules/${ruleId}/versions/diff?${search.toString()}`, { token });
}

export async function rollbackRuleVersion(
  token: string,
  ruleId: string,
  versionId: string,
  payload: { version?: string | null } = {},
): Promise<RuleSet> {
  return requestJson<RuleSet>(`/rules/${ruleId}/versions/${versionId}/rollback`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listInspections(token: string): Promise<PagedResponse<InspectionRun>> {
  return requestJson<PagedResponse<InspectionRun>>("/inspections?page=1&page_size=50", { token });
}

export async function createInspection(token: string, payload: InspectionCreatePayload): Promise<InspectionRun> {
  return requestJson<InspectionRun>("/inspections", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listFindings(token: string, inspectionId?: string): Promise<PagedResponse<Finding>> {
  const search = new URLSearchParams({ page: "1", page_size: "100" });
  if (inspectionId) {
    search.set("inspection_run_id", inspectionId);
  }
  return requestJson<PagedResponse<Finding>>(`/findings?${search.toString()}`, { token });
}

export async function listProblemTopics(
  token: string,
  filters: ProblemTopicFilters = {},
): Promise<ProblemTopicResponse> {
  const search = new URLSearchParams({ page: "1", page_size: "50" });
  if (filters.rule_set_id) {
    search.set("rule_set_id", filters.rule_set_id);
  }
  if (filters.asset_type) {
    search.set("asset_type", filters.asset_type);
  }
  if (filters.owner) {
    search.set("owner", filters.owner);
  }
  if (filters.status) {
    search.set("status", filters.status);
  }
  if (filters.severity) {
    search.set("severity", filters.severity);
  }
  return requestJson<ProblemTopicResponse>(`/findings/topic-view?${search.toString()}`, { token });
}

export async function listFindingLogClues(token: string, findingId: string): Promise<LogClue[]> {
  return requestJson<LogClue[]>(`/findings/${findingId}/log-clues`, { token });
}

export async function listRuleResults(token: string, inspectionId: string): Promise<RuleRunResult[]> {
  return requestJson<RuleRunResult[]>(`/inspections/${inspectionId}/rule-results`, { token });
}

export async function listInspectionAiSummaries(token: string, inspectionId: string): Promise<AiAnalysisJob[]> {
  return requestJson<AiAnalysisJob[]>(`/inspections/${inspectionId}/ai-summaries`, { token });
}

export async function listTickets(token: string): Promise<Ticket[]> {
  return requestJson<Ticket[]>("/tickets", { token });
}

export async function createTicket(token: string, payload: TicketCreatePayload): Promise<Ticket> {
  return requestJson<Ticket>("/tickets", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(token: string, ticketId: string, payload: TicketUpdatePayload): Promise<Ticket> {
  return requestJson<Ticket>(`/tickets/${ticketId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listTicketAttachments(token: string, ticketId: string): Promise<TicketAttachment[]> {
  return requestJson<TicketAttachment[]>(`/tickets/${ticketId}/attachments`, { token });
}

export async function uploadTicketAttachment(
  token: string,
  ticketId: string,
  file: File,
): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.set("upload", file);
  return requestJson<TicketAttachment>(`/tickets/${ticketId}/attachments`, {
    method: "POST",
    token,
    body: formData,
  });
}

export async function downloadTicketAttachment(
  token: string,
  ticketId: string,
  attachmentId: string,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await requestBlob(`/tickets/${ticketId}/attachments/${attachmentId}/download`, {
    token,
  });
  return { blob, filename: filename ?? `${attachmentId}.attachment` };
}

export async function listTicketReminders(token: string, ticketId: string): Promise<TicketReminder[]> {
  return requestJson<TicketReminder[]>(`/tickets/${ticketId}/reminders`, { token });
}

export async function createTicketReminder(
  token: string,
  ticketId: string,
  payload: TicketReminderCreatePayload,
): Promise<TicketReminder> {
  return requestJson<TicketReminder>(`/tickets/${ticketId}/reminders`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listTicketLogClues(token: string, ticketId: string): Promise<LogClue[]> {
  return requestJson<LogClue[]>(`/tickets/${ticketId}/log-clues`, { token });
}

export async function submitTicketReview(
  token: string,
  ticketId: string,
  payload: { resolution_note?: string | null },
): Promise<Ticket> {
  return requestJson<Ticket>(`/tickets/${ticketId}/submit-review`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function approveTicketReview(token: string, ticketId: string, comment?: string | null): Promise<Ticket> {
  return requestJson<Ticket>(`/tickets/${ticketId}/review/approve`, {
    method: "POST",
    token,
    body: JSON.stringify({ comment }),
  });
}

export async function rejectTicketReview(token: string, ticketId: string, comment?: string | null): Promise<Ticket> {
  return requestJson<Ticket>(`/tickets/${ticketId}/review/reject`, {
    method: "POST",
    token,
    body: JSON.stringify({ comment }),
  });
}

export async function listExceptions(token: string): Promise<ExceptionRequest[]> {
  return requestJson<ExceptionRequest[]>("/exceptions", { token });
}

export async function createException(token: string, payload: ExceptionCreatePayload): Promise<ExceptionRequest> {
  return requestJson<ExceptionRequest>("/exceptions", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function approveException(
  token: string,
  exceptionId: string,
  comment: string,
): Promise<ExceptionRequest> {
  return requestJson<ExceptionRequest>(`/exceptions/${exceptionId}/approve`, {
    method: "POST",
    token,
    body: JSON.stringify({ comment }),
  });
}

export async function rejectException(
  token: string,
  exceptionId: string,
  comment: string,
): Promise<ExceptionRequest> {
  return requestJson<ExceptionRequest>(`/exceptions/${exceptionId}/reject`, {
    method: "POST",
    token,
    body: JSON.stringify({ comment }),
  });
}

export async function listReports(token: string): Promise<ReportJob[]> {
  return requestJson<ReportJob[]>("/reports", { token });
}

export async function createReport(token: string, payload: ReportJobCreatePayload): Promise<ReportJob> {
  return requestJson<ReportJob>("/reports", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listReportArtifacts(token: string, reportId: string): Promise<ReportArtifact[]> {
  return requestJson<ReportArtifact[]>(`/reports/${reportId}/artifacts`, { token });
}

export async function listReportAiSummaries(token: string, reportId: string): Promise<AiAnalysisJob[]> {
  return requestJson<AiAnalysisJob[]>(`/reports/${reportId}/ai-summaries`, { token });
}

export async function listAuditEvents(token: string): Promise<PagedResponse<AuditEvent>> {
  return requestJson<PagedResponse<AuditEvent>>("/audit?page=1&page_size=50", { token });
}

export async function listRoles(token: string): Promise<RoleRead[]> {
  return requestJson<RoleRead[]>("/auth/roles", { token });
}

export async function listPermissionMatrix(token: string): Promise<PermissionMatrixRead> {
  return requestJson<PermissionMatrixRead>("/auth/permission-matrix", { token });
}

export async function updateRole(
  token: string,
  roleId: string,
  payload: { description?: string | null; permissions?: string[]; menu_items?: string[] },
): Promise<RoleRead> {
  return requestJson<RoleRead>(`/auth/roles/${roleId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listUsers(token: string): Promise<UserRead[]> {
  return requestJson<UserRead[]>("/auth/users", { token });
}

export async function createUser(
  token: string,
  payload: { username: string; password: string; full_name?: string | null; role_id: string; is_active: boolean },
): Promise<UserRead> {
  return requestJson<UserRead>("/auth/users", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  token: string,
  userId: string,
  payload: { full_name?: string | null; password?: string | null; role_id?: string | null; is_active?: boolean },
): Promise<UserRead> {
  return requestJson<UserRead>(`/auth/users/${userId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listLedgers(token: string, catalogType?: string): Promise<PagedResponse<LedgerItem>> {
  const search = new URLSearchParams({ page: "1", page_size: "100" });
  if (catalogType) {
    search.set("catalog_type", catalogType);
  }
  return requestJson<PagedResponse<LedgerItem>>(`/ledgers?${search.toString()}`, { token });
}

export async function importLedgers(token: string, payload: LedgerImportPayload): Promise<LedgerImportResult> {
  return requestJson<LedgerImportResult>("/ledgers/import", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listScheduledTasks(token: string): Promise<ScheduledTask[]> {
  return requestJson<ScheduledTask[]>("/scheduled-tasks", { token });
}

export async function createScheduledTask(token: string, payload: ScheduledTaskCreatePayload): Promise<ScheduledTask> {
  return requestJson<ScheduledTask>("/scheduled-tasks", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateScheduledTask(
  token: string,
  taskId: string,
  payload: ScheduledTaskUpdatePayload,
): Promise<ScheduledTask> {
  return requestJson<ScheduledTask>(`/scheduled-tasks/${taskId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listScheduledTaskExecutionLogs(token: string, taskId: string): Promise<ScheduledTaskExecutionLog[]> {
  return requestJson<ScheduledTaskExecutionLog[]>(`/scheduled-tasks/${taskId}/execution-logs`, { token });
}

export async function triggerScheduledTask(token: string, taskId: string): Promise<JobQueueItem> {
  return requestJson<JobQueueItem>(`/scheduled-tasks/${taskId}/trigger`, {
    method: "POST",
    token,
  });
}

export async function listNotifications(token: string, status?: string): Promise<NotificationItem[]> {
  const search = new URLSearchParams();
  if (status) {
    search.set("status", status);
  }
  const suffix = search.size ? `?${search.toString()}` : "";
  return requestJson<NotificationItem[]>(`/notifications${suffix}`, { token });
}

export async function getNotificationUnreadCount(token: string): Promise<NotificationUnreadCount> {
  return requestJson<NotificationUnreadCount>("/notifications/unread-count", { token });
}

export async function createNotification(
  token: string,
  payload: { title: string; message: string; level: string; resource_type?: string | null; resource_id?: string | null },
): Promise<NotificationItem> {
  return requestJson<NotificationItem>("/notifications", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function markNotificationRead(token: string, notificationId: string): Promise<NotificationItem> {
  return requestJson<NotificationItem>(`/notifications/${notificationId}/read`, {
    method: "POST",
    token,
  });
}

export async function markAllNotificationsRead(token: string): Promise<NotificationMarkAllReadResult> {
  return requestJson<NotificationMarkAllReadResult>("/notifications/read-all", {
    method: "POST",
    token,
  });
}

export async function listLogClues(token: string, filters: LogClueFilters = {}): Promise<LogClue[]> {
  const search = new URLSearchParams();
  if (filters.keyword) {
    search.set("keyword", filters.keyword);
  }
  if (filters.severity) {
    search.set("severity", filters.severity);
  }
  if (filters.resource_type) {
    search.set("resource_type", filters.resource_type);
  }
  if (filters.resource_id) {
    search.set("resource_id", filters.resource_id);
  }
  const suffix = search.size ? `?${search.toString()}` : "";
  return requestJson<LogClue[]>(`/log-clues${suffix}`, { token });
}

export async function importLogClues(
  token: string,
  payload: Array<{
    source: string;
    severity: string;
    keyword: string;
    message: string;
    event_time?: string | null;
    resource_type?: string | null;
    resource_id?: string | null;
    details?: Record<string, unknown>;
  }>,
): Promise<LogClue[]> {
  return requestJson<LogClue[]>("/log-clues/import", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listReportTemplates(token: string): Promise<ReportTemplate[]> {
  return requestJson<ReportTemplate[]>("/report-templates", { token });
}

export async function createReportTemplate(
  token: string,
  payload: { name: string; template_type: string; version: string; status: string; body: string; variables: Record<string, unknown> },
): Promise<ReportTemplate> {
  return requestJson<ReportTemplate>("/report-templates", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateReportTemplate(
  token: string,
  templateId: string,
  payload: Partial<{
    name: string;
    template_type: string;
    version: string;
    status: string;
    body: string;
    variables: Record<string, unknown>;
  }>,
): Promise<ReportTemplate> {
  return requestJson<ReportTemplate>(`/report-templates/${templateId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteReportTemplate(token: string, templateId: string): Promise<ReportTemplate> {
  return requestJson<ReportTemplate>(`/report-templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}

export async function listSystemParameters(token: string): Promise<SystemParameter[]> {
  return requestJson<SystemParameter[]>("/system-parameters", { token });
}

export async function upsertSystemParameter(
  token: string,
  payload: { key: string; value: Record<string, unknown>; category: string; description?: string | null },
): Promise<SystemParameter> {
  return requestJson<SystemParameter>("/system-parameters", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listAiAnalysis(token: string): Promise<AiAnalysisJob[]> {
  return requestJson<AiAnalysisJob[]>("/ai-analysis", { token });
}

export async function reviewAiAnalysis(
  token: string,
  aiJobId: string,
  payload: { review_status: string; comment?: string | null },
): Promise<AiAnalysisJob> {
  return requestJson<AiAnalysisJob>(`/ai-analysis/${aiJobId}/review`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listJobs(token: string): Promise<JobQueueItem[]> {
  return requestJson<JobQueueItem[]>("/jobs", { token });
}

export async function retryJob(token: string, jobId: string): Promise<JobQueueItem> {
  return requestJson<JobQueueItem>(`/jobs/${jobId}/retry`, {
    method: "POST",
    token,
  });
}

export async function downloadReportArtifact(
  token: string,
  reportId: string,
  artifactId: string,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await requestBlob(`/reports/${reportId}/artifacts/${artifactId}/download`, {
    token,
  });
  return { blob, filename: filename ?? `${artifactId}.artifact` };
}
