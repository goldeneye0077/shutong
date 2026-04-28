import { expect, request, type APIRequestContext, type APIResponse } from "@playwright/test";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

export const frontendBaseUrl = trimTrailingSlash(process.env.E2E_FRONTEND_URL ?? "http://localhost:5173");
export const backendBaseUrl = trimTrailingSlash(process.env.E2E_BACKEND_URL ?? "http://localhost:8000/api/v1");
export const dataServiceBaseUrl = trimTrailingSlash(process.env.E2E_DATA_SERVICE_URL ?? "http://localhost:8010");

type RequestOptions = NonNullable<Parameters<APIRequestContext["fetch"]>[1]>;

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: { id: string; username: string; full_name?: string | null };
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  vendor: string;
  status: string;
  owner: string;
  scenario: string;
}

export interface ConfigFile {
  id: string;
  asset_id: string;
  filename: string;
  version: number;
  source: string;
  processing_status: string;
}

export interface ParseRun {
  id: string;
  config_file_id: string;
  status: string;
  parser_name: string;
  line_count: number;
  warning_count: number;
}

export interface NormalizedConfig {
  id: string;
  config_file_id: string;
  asset_id: string;
  hostname: string | null;
  interface_count: number;
  indicators: Record<string, unknown>;
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
}

export interface InspectionRun {
  id: string;
  name: string;
  rule_set_id: string;
  status: string;
  asset_scope: string[];
}

export interface RuleRunResult {
  id: string;
  inspection_run_id: string;
  asset_id: string | null;
  rule_set_id: string;
  status: string;
  matched: boolean;
  severity: string | null;
  details: Record<string, unknown>;
}

export interface Finding {
  id: string;
  inspection_run_id: string;
  asset_id: string | null;
  rule_set_id: string;
  title: string;
  severity: string;
  status: string;
}

export interface Ticket {
  id: string;
  finding_id: string;
  assignee: string;
  status: string;
}

export interface ExceptionRequest {
  id: string;
  ticket_id: string;
  reason: string;
  status: string;
}

export interface ReportJob {
  id: string;
  report_type: string;
  status: string;
  file_path: string | null;
}

export interface ReportArtifact {
  id: string;
  report_job_id: string;
  artifact_type: string;
  file_path: string;
  artifact_metadata: {
    metrics?: Record<string, number>;
    [key: string]: unknown;
  };
}

export interface AiAnalysisJob {
  id: string;
  target_type: string;
  target_id: string;
  analysis_type: string;
  status: string;
  review_status: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface QueueRunResult {
  status: "completed" | "failed" | "idle" | string;
  job_id?: string;
  job_type?: string;
  error?: string;
  [key: string]: unknown;
}

export interface MockApiClientOptions {
  backendUrl?: string;
  dataServiceUrl?: string;
}

export class MockApiClient {
  private token: string | null = null;

  private constructor(
    private readonly backend: APIRequestContext,
    private readonly dataService: APIRequestContext,
  ) {}

  static async create(options: MockApiClientOptions = {}): Promise<MockApiClient> {
    const backend = await request.newContext({
      baseURL: ensureTrailingSlash(options.backendUrl ?? backendBaseUrl),
      extraHTTPHeaders: { Accept: "application/json" },
    });
    const dataService = await request.newContext({
      baseURL: ensureTrailingSlash(options.dataServiceUrl ?? dataServiceBaseUrl),
      extraHTTPHeaders: { Accept: "application/json" },
    });
    return new MockApiClient(backend, dataService);
  }

  async dispose(): Promise<void> {
    await Promise.all([this.backend.dispose(), this.dataService.dispose()]);
  }

  async login(username = "admin", password = "admin123"): Promise<TokenBundle> {
    const bundle = await this.backendJson<TokenBundle>("POST", "/auth/login", {
      data: { username, password },
    });
    this.token = bundle.access_token;
    return bundle;
  }

  async createAsset(prefix: string): Promise<Asset> {
    return this.backendJson<Asset>("POST", "/assets", {
      data: {
        name: `${prefix}-CSW-01`,
        asset_type: "CSW",
        vendor: "Huawei",
        status: "active",
        owner: "mock-operator",
        scenario: "mock-e2e",
      },
    });
  }

  async getAsset(assetId: string): Promise<Asset> {
    return this.backendJson<Asset>("GET", `/assets/${assetId}`);
  }

  async uploadConfig(assetId: string, fixturePath: string): Promise<ConfigFile> {
    const buffer = await readFile(fixturePath);
    return this.backendJson<ConfigFile>("POST", "/configs/upload", {
      multipart: {
        asset_id: assetId,
        source: "manual",
        upload: {
          name: basename(fixturePath),
          mimeType: "text/plain",
          buffer,
        },
      },
    });
  }

  async uploadConfigExpectingFailure(assetId: string, fixturePath: string): Promise<APIResponse> {
    const buffer = await readFile(fixturePath);
    return this.backend.fetch(this.contextPath("/configs/upload"), {
      method: "POST",
      headers: this.authHeaders(),
      multipart: {
        asset_id: assetId,
        source: "manual",
        upload: {
          name: basename(fixturePath),
          mimeType: "text/plain",
          buffer,
        },
      },
    });
  }

  async getConfig(configId: string): Promise<ConfigFile> {
    return this.backendJson<ConfigFile>("GET", `/configs/${configId}`);
  }

  async listParseRuns(configId: string): Promise<ParseRun[]> {
    return this.backendJson<ParseRun[]>("GET", `/configs/${configId}/parse-runs`);
  }

  async listNormalizedConfigs(configId: string): Promise<NormalizedConfig[]> {
    return this.backendJson<NormalizedConfig[]>("GET", `/configs/${configId}/normalized`);
  }

  async listConfigAiSummaries(configId: string): Promise<AiAnalysisJob[]> {
    return this.backendJson<AiAnalysisJob[]>("GET", `/configs/${configId}/ai-summaries`);
  }

  async createRule(prefix: string): Promise<RuleSet> {
    return this.backendJson<RuleSet>("POST", "/rules", {
      data: {
        name: `${prefix}-any-any-baseline`,
        category: "access-control",
        version: "v1",
        risk_level: "high",
        status: "active",
        scope: "CSW",
        definition: {
          must_not_have_any_any: true,
          finding_title: `${prefix} Any-Any Risk`,
          severity: "high",
          recommendation: "Restrict source and destination ranges before publishing the next baseline.",
        },
      },
    });
  }

  async createInspection(prefix: string, ruleSetId: string, assetIds: string[]): Promise<InspectionRun> {
    return this.backendJson<InspectionRun>("POST", "/inspections", {
      data: {
        name: `${prefix}-inspection`,
        trigger_type: "manual",
        rule_set_id: ruleSetId,
        asset_scope: assetIds,
      },
    });
  }

  async getInspection(inspectionId: string): Promise<InspectionRun> {
    return this.backendJson<InspectionRun>("GET", `/inspections/${inspectionId}`);
  }

  async listFindings(inspectionId?: string): Promise<PagedResponse<Finding>> {
    const query = new URLSearchParams({ page: "1", page_size: "100" });
    if (inspectionId) {
      query.set("inspection_run_id", inspectionId);
    }
    return this.backendJson<PagedResponse<Finding>>("GET", `/findings?${query.toString()}`);
  }

  async listRuleResults(inspectionId: string): Promise<RuleRunResult[]> {
    return this.backendJson<RuleRunResult[]>("GET", `/inspections/${inspectionId}/rule-results`);
  }

  async listInspectionAiSummaries(inspectionId: string): Promise<AiAnalysisJob[]> {
    return this.backendJson<AiAnalysisJob[]>("GET", `/inspections/${inspectionId}/ai-summaries`);
  }

  async createTicket(findingId: string): Promise<Ticket> {
    return this.backendJson<Ticket>("POST", "/tickets", {
      data: {
        finding_id: findingId,
        assignee: "mock-operator",
        due_at: daysFromNow(7),
      },
    });
  }

  async updateTicket(ticketId: string): Promise<Ticket> {
    return this.backendJson<Ticket>("PATCH", `/tickets/${ticketId}`, {
      data: {
        status: "in_progress",
        resolution_note: "Mock E2E remediation has started.",
      },
    });
  }

  async listTickets(): Promise<Ticket[]> {
    return this.backendJson<Ticket[]>("GET", "/tickets");
  }

  async createException(ticketId: string): Promise<ExceptionRequest> {
    return this.backendJson<ExceptionRequest>("POST", "/exceptions", {
      data: {
        ticket_id: ticketId,
        reason: "Mock E2E exception while waiting for the maintenance window.",
        expires_at: daysFromNow(30),
      },
    });
  }

  async approveException(exceptionId: string): Promise<ExceptionRequest> {
    return this.backendJson<ExceptionRequest>("POST", `/exceptions/${exceptionId}/approve`, {
      data: {
        comment: "Mock E2E approval.",
      },
    });
  }

  async listExceptions(): Promise<ExceptionRequest[]> {
    return this.backendJson<ExceptionRequest[]>("GET", "/exceptions");
  }

  async createReport(): Promise<ReportJob> {
    return this.backendJson<ReportJob>("POST", "/reports", {
      data: { report_type: "inspection_summary" },
    });
  }

  async getReport(reportId: string): Promise<ReportJob> {
    return this.backendJson<ReportJob>("GET", `/reports/${reportId}`);
  }

  async listReportArtifacts(reportId: string): Promise<ReportArtifact[]> {
    return this.backendJson<ReportArtifact[]>("GET", `/reports/${reportId}/artifacts`);
  }

  async listReportAiSummaries(reportId: string): Promise<AiAnalysisJob[]> {
    return this.backendJson<AiAnalysisJob[]>("GET", `/reports/${reportId}/ai-summaries`);
  }

  async downloadReportArtifact(reportId: string, artifactId: string): Promise<string> {
    const response = await this.backend.fetch(this.contextPath(`/reports/${reportId}/artifacts/${artifactId}/download`), {
      method: "GET",
      headers: this.authHeaders(),
    });
    await expectOk(response, "download report artifact");
    return response.text();
  }

  async downloadMissingReportArtifact(reportId: string): Promise<APIResponse> {
    return this.backend.fetch(this.contextPath(`/reports/${reportId}/artifacts/not-found/download`), {
      method: "GET",
      headers: this.authHeaders(),
    });
  }

  async listAuditEvents(action?: string): Promise<PagedResponse<AuditEvent>> {
    const query = new URLSearchParams({ page: "1", page_size: "50" });
    if (action) {
      query.set("action", action);
    }
    return this.backendJson<PagedResponse<AuditEvent>>("GET", `/audit?${query.toString()}`);
  }

  async queueStats(): Promise<QueueStats> {
    return this.dataServiceJson<QueueStats>("GET", "/internal/queue/stats");
  }

  async runNextQueueJob(): Promise<QueueRunResult> {
    return this.dataServiceJson<QueueRunResult>("POST", "/internal/queue/run-next");
  }

  async runQueueUntil<T>(
    description: string,
    check: () => Promise<T | null | undefined | false>,
    maxRuns = 30,
  ): Promise<T> {
    const firstValue = await check();
    if (firstValue) {
      return firstValue;
    }

    const outcomes: string[] = [];
    for (let index = 0; index < maxRuns; index += 1) {
      const result = await this.runNextQueueJob();
      outcomes.push(`${result.job_type ?? "none"}:${result.status}`);

      const value = await check();
      if (value) {
        return value;
      }

      if (result.status === "idle") {
        await delay(500);
      } else {
        await delay(150);
      }
    }

    const stats = await this.queueStats();
    throw new Error(
      `Timed out waiting for ${description}. Queue outcomes: ${outcomes.join(", ")}. Stats: ${JSON.stringify(stats)}`,
    );
  }

  private async backendJson<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.backend.fetch(this.contextPath(path), {
      ...options,
      method,
      headers: {
        ...this.authHeaders(),
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    await expectOk(response, `${method} ${path}`);
    return response.json() as Promise<T>;
  }

  private async dataServiceJson<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.dataService.fetch(this.contextPath(path), {
      ...options,
      method,
    });
    await expectOk(response, `${method} ${path}`);
    return response.json() as Promise<T>;
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private contextPath(path: string): string {
    return path.replace(/^\/+/, "");
  }
}

export function createRunPrefix(): string {
  return `MOCK-E2E-${Date.now()}`;
}

export async function expectOk(response: APIResponse, label: string): Promise<void> {
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
  }
  expect(response.ok(), label).toBe(true);
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureTrailingSlash(value: string): string {
  return `${trimTrailingSlash(value)}/`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
