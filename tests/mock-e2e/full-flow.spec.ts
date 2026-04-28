import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import {
  MockApiClient,
  createRunPrefix,
  expectOk,
  frontendBaseUrl,
  type AiAnalysisJob,
  type ConfigFile,
  type InspectionRun,
  type ReportJob,
} from "./helpers/api";

const configFixturePath = resolve(process.cwd(), "tests/mock-e2e/fixtures/core-network-config.txt");

test.describe.configure({ mode: "serial" });

test.describe("mock e2e full project flow", () => {
  test("drives upload, parse, inspect, workflow, report, audit, and frontend display", async ({ page }) => {
    const api = await MockApiClient.create();
    const prefix = createRunPrefix();
    const findingTitle = `${prefix} Any-Any Risk`;
    const initialStats = await api.queueStats();

    try {
      await api.login();

      const asset = await api.createAsset(prefix);
      expect(asset.name).toBe(`${prefix}-CSW-01`);

      const config = await api.uploadConfig(asset.id, configFixturePath);
      expect(config.processing_status).toBe("queued");

      const parsedConfig = await api.runQueueUntil<ConfigFile>("uploaded config to be parsed", async () => {
        const current = await api.getConfig(config.id);
        if (current.processing_status === "failed") {
          throw new Error(`Config parsing failed for ${config.id}`);
        }
        return current.processing_status === "parsed" ? current : null;
      });
      expect(parsedConfig.processing_status).toBe("parsed");

      const parseRuns = await api.listParseRuns(config.id);
      expect(parseRuns.some((item) => item.status === "completed")).toBe(true);
      const normalizedConfigs = await api.listNormalizedConfigs(config.id);
      expect(normalizedConfigs).toHaveLength(1);
      expect(normalizedConfigs[0].hostname).toBe("mock-e2e-csw-01");
      expect(normalizedConfigs[0].interface_count).toBeGreaterThanOrEqual(2);
      expect(normalizedConfigs[0].indicators.has_any_any_rule).toBe(true);

      await api.runQueueUntil<AiAnalysisJob>("config AI summary to complete", async () => {
        return (await api.listConfigAiSummaries(config.id)).find((item) => item.status === "completed") ?? null;
      });

      const rule = await api.createRule(prefix);
      const inspection = await api.createInspection(prefix, rule.id, [asset.id]);
      expect(inspection.status).toBe("queued");

      const completedInspection = await api.runQueueUntil<InspectionRun>("inspection to complete", async () => {
        const current = await api.getInspection(inspection.id);
        if (current.status === "failed") {
          throw new Error(`Inspection failed for ${inspection.id}`);
        }
        return current.status === "completed" ? current : null;
      });
      expect(completedInspection.status).toBe("completed");

      const ruleResults = await api.listRuleResults(inspection.id);
      expect(ruleResults.some((item) => item.matched && item.severity === "high")).toBe(true);

      const findings = await api.listFindings(inspection.id);
      const finding = findings.items.find((item) => item.title === findingTitle);
      expect(finding, `Expected finding ${findingTitle}`).toBeTruthy();
      expect(finding?.status).toBe("open");

      await api.runQueueUntil<AiAnalysisJob>("inspection AI summary to complete", async () => {
        return (await api.listInspectionAiSummaries(inspection.id)).find((item) => item.status === "completed") ?? null;
      });

      const ticket = await api.createTicket(finding!.id);
      const inProgressTicket = await api.updateTicket(ticket.id);
      expect(inProgressTicket.status).toBe("in_progress");
      expect(inProgressTicket.assignee).toBe("mock-operator");

      const exception = await api.createException(ticket.id);
      expect(exception.status).toBe("pending");
      const approvedException = await api.approveException(exception.id);
      expect(approvedException.status).toBe("approved");

      const tickets = await api.listTickets();
      expect(tickets.find((item) => item.id === ticket.id)?.status).toBe("exception_approved");
      const updatedFindings = await api.listFindings(inspection.id);
      expect(updatedFindings.items.find((item) => item.id === finding!.id)?.status).toBe("exception_approved");

      const report = await api.createReport();
      const completedReport = await api.runQueueUntil<ReportJob>("report generation to complete", async () => {
        const current = await api.getReport(report.id);
        if (current.status === "failed") {
          throw new Error(`Report generation failed for ${report.id}`);
        }
        return current.status === "completed" ? current : null;
      });
      expect(completedReport.file_path).toContain(report.id);

      const artifacts = await api.listReportArtifacts(report.id);
      expect(artifacts.length).toBeGreaterThanOrEqual(3);
      const artifactTypes = new Set(artifacts.map((item) => item.artifact_type));
      expect(artifactTypes.has("markdown")).toBe(true);
      expect(artifactTypes.has("csv")).toBe(true);
      expect(artifactTypes.has("json")).toBe(true);
      const markdownArtifact = artifacts.find((item) => item.artifact_type === "markdown");
      expect(markdownArtifact, "Expected markdown report artifact").toBeTruthy();
      expect(markdownArtifact?.artifact_metadata.metrics?.finding_total).toBeGreaterThanOrEqual(1);

      await api.runQueueUntil<AiAnalysisJob>("report AI summary to complete", async () => {
        return (await api.listReportAiSummaries(report.id)).find((item) => item.status === "completed") ?? null;
      });

      const reportText = await api.downloadReportArtifact(report.id, markdownArtifact!.id);
      expect(reportText).toContain(report.id);
      expect(reportText).toContain("inspection_summary");
      expect(reportText).toContain(findingTitle);

      for (const action of [
        "asset.create",
        "config.upload",
        "rule.create",
        "inspection.create",
        "ticket.create",
        "ticket.update",
        "exception.create",
        "exception.approve",
        "report.create",
        "report.download",
      ]) {
        const auditEvents = await api.listAuditEvents(action);
        expect(auditEvents.total, `Expected audit action ${action}`).toBeGreaterThan(0);
      }

      const finalStats = await api.queueStats();
      expect(finalStats.failed).toBe(initialStats.failed);

      await loginThroughFrontend(page);
      await expectFrontendText(page, "/assets", asset.name);
      await expectFrontendText(page, "/assets", "core-network-config.txt");
      await expectFrontendText(page, "/rules", rule.name);
      await expectFrontendText(page, "/rules", inspection.name);
      await expectFrontendText(page, "/rules", findingTitle);
      await expectFrontendText(page, "/workflow", findingTitle);
      await expectFrontendText(page, "/workflow", "mock-operator");
      await expectFrontendText(page, "/reports", report.id);
      await expectFrontendText(page, "/audit", markdownArtifact!.id.slice(0, 8));
      await expectFrontendText(page, "/platform", "平台管理");

      await page.goto(`${frontendBaseUrl}/assets`);
      const currentTheme = await page.locator("html").getAttribute("data-shell-theme");
      await page.locator(".shell-topbar-actions .shell-icon-button").nth(1).click();
      await expect.poll(() => page.locator("html").getAttribute("data-shell-theme")).not.toBe(currentTheme);
      await expect(page.locator(".shell-nav")).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test("covers failure boundaries without mocking services", async ({ page }) => {
    const api = await MockApiClient.create();
    const prefix = createRunPrefix();
    const initialStats = await api.queueStats();

    try {
      await page.goto(`${frontendBaseUrl}/assets`);
      await expect(page).toHaveURL(/\/login/);

      await api.login();

      const missingAssetUpload = await api.uploadConfigExpectingFailure("missing-asset-id", configFixturePath);
      expect(missingAssetUpload.status()).toBe(404);

      const asset = await api.createAsset(`${prefix}-NO-CONFIG`);
      const rule = await api.createRule(`${prefix}-SKIP`);
      const inspection = await api.createInspection(`${prefix}-SKIP`, rule.id, [asset.id]);

      await api.runQueueUntil<InspectionRun>("inspection without normalized config to complete", async () => {
        const current = await api.getInspection(inspection.id);
        if (current.status === "failed") {
          throw new Error(`Inspection failed for ${inspection.id}`);
        }
        return current.status === "completed" ? current : null;
      });

      const skippedResults = await api.listRuleResults(inspection.id);
      expect(skippedResults).toHaveLength(1);
      expect(skippedResults[0].status).toBe("skipped");
      expect(skippedResults[0].matched).toBe(false);
      expect((await api.listFindings(inspection.id)).total).toBe(0);

      await api.runQueueUntil<AiAnalysisJob>("skipped inspection AI summary to complete", async () => {
        return (await api.listInspectionAiSummaries(inspection.id)).find((item) => item.status === "completed") ?? null;
      });

      const report = await api.createReport();
      await api.runQueueUntil<ReportJob>("failure-boundary report generation to complete", async () => {
        const current = await api.getReport(report.id);
        return current.status === "completed" ? current : null;
      });
      await api.runQueueUntil<AiAnalysisJob>("failure-boundary report AI summary to complete", async () => {
        return (await api.listReportAiSummaries(report.id)).find((item) => item.status === "completed") ?? null;
      });

      const missingArtifactDownload = await api.downloadMissingReportArtifact(report.id);
      expect(missingArtifactDownload.status()).toBe(404);

      const finalStats = await api.queueStats();
      expect(finalStats.failed).toBe(initialStats.failed);
    } finally {
      await api.dispose();
    }
  });
});

async function loginThroughFrontend(page: Page): Promise<void> {
  await page.goto(`${frontendBaseUrl}/login`);
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".shell-nav")).toBeVisible();
}

async function expectFrontendText(
  page: Page,
  path: string,
  text: string,
): Promise<void> {
  await page.goto(`${frontendBaseUrl}${path}`);
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
}
