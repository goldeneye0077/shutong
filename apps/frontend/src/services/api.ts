import type {
  AiAnalysisJob,
  Asset,
  AssetCreatePayload,
  AssetUpdatePayload,
  AuditEvent,
  ConfigFile,
  ExceptionCreatePayload,
  ExceptionRequest,
  Finding,
  InspectionCreatePayload,
  InspectionRun,
  NormalizedConfig,
  PagedResponse,
  ParseRun,
  ReportArtifact,
  ReportJobCreatePayload,
  ReportJob,
  RuleRunResult,
  RuleSetCreatePayload,
  RuleSetUpdatePayload,
  RuleSet,
  SystemSummary,
  TicketCreatePayload,
  TicketUpdatePayload,
  Ticket,
  TokenBundle,
} from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
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

export async function listAssets(token: string): Promise<PagedResponse<Asset>> {
  return requestJson<PagedResponse<Asset>>("/assets?page=1&page_size=50", { token });
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

export async function listParseRuns(token: string, configId: string): Promise<ParseRun[]> {
  return requestJson<ParseRun[]>(`/configs/${configId}/parse-runs`, { token });
}

export async function listNormalizedConfigs(token: string, configId: string): Promise<NormalizedConfig[]> {
  return requestJson<NormalizedConfig[]>(`/configs/${configId}/normalized`, { token });
}

export async function listConfigAiSummaries(token: string, configId: string): Promise<AiAnalysisJob[]> {
  return requestJson<AiAnalysisJob[]>(`/configs/${configId}/ai-summaries`, { token });
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
