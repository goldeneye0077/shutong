import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

const backendBaseUrl = trimTrailingSlash(process.env.PERF_BACKEND_URL ?? "http://localhost:8000/api/v1");
const dataServiceBaseUrl = trimTrailingSlash(process.env.PERF_DATA_SERVICE_URL ?? "http://localhost:8010");
const username = process.env.PERF_USERNAME ?? process.env.BACKEND_BOOTSTRAP_ADMIN_USERNAME ?? "admin";
const password = process.env.PERF_PASSWORD ?? process.env.BACKEND_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123";
const assetCount = readPositiveInt("PERF_ASSET_COUNT", 4);
const ruleCount = readPositiveInt("PERF_RULE_COUNT", 2);
const queueMaxRuns = readPositiveInt("PERF_QUEUE_MAX_RUNS", 240);
const reportPath = process.env.PERF_REPORT_PATH ?? "docs/04-structure/performance-acceptance-report.md";
const jsonPath = process.env.PERF_JSON_PATH ?? "tests/performance/.last-result.json";
const runId = `PERF-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

let token = "";
const timings = [];

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function stage(name, action) {
  const start = performance.now();
  const result = await action();
  const durationMs = Math.round(performance.now() - start);
  timings.push({ name, durationMs });
  console.log(`PASS ${name}: ${durationMs}ms`);
  return result;
}

async function requestJson(method, path, { data, headers, body } = {}) {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ?? (data ? JSON.stringify(data) : undefined),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function dataServiceJson(method, path) {
  const response = await fetch(`${dataServiceBaseUrl}${path}`, { method, headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function login() {
  const payload = await requestJson("POST", "/auth/login", { data: { username, password } });
  token = payload.access_token;
  if (!token) {
    throw new Error("登录响应缺少 access_token");
  }
  return payload.user;
}

async function createAsset(index) {
  return requestJson("POST", "/assets", {
    data: {
      name: `${runId}-CSW-${String(index + 1).padStart(2, "0")}`,
      asset_type: "CSW",
      vendor: "Huawei",
      status: "active",
      owner: `性能责任人-${(index % 3) + 1}`,
      scenario: "performance-acceptance",
    },
  });
}

async function uploadConfig(asset, index) {
  const form = new FormData();
  const content = buildConfigContent(index);
  form.set("asset_id", asset.id);
  form.set("source", "manual");
  form.set(
    "upload",
    new Blob([content], { type: "text/plain" }),
    `${asset.name}.cfg`,
  );
  const response = await fetch(`${backendBaseUrl}/configs/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`上传配置失败 ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function buildConfigContent(index) {
  const portBase = index + 1;
  return [
    `sysname perf-csw-${String(portBase).padStart(2, "0")}`,
    "telnet server enable",
    "snmp-agent community read public",
    `interface 10GE1/0/${portBase}`,
    " description performance uplink",
    " ip address 10.10.10.1 255.255.255.0",
    `interface Vlanif${100 + portBase}`,
    " description service vlan",
    " ip address 172.16.1.1 255.255.255.0",
    "acl number 3000",
    " rule 5 permit ip any any",
    " rule 10 deny ip source 10.0.0.0 0.255.255.255",
    "local-user perf-admin password irreversible-cipher mock",
    "",
  ].join("\n");
}

async function createRule(index) {
  return requestJson("POST", "/rules", {
    data: {
      name: `${runId}-规则-${index + 1}`,
      category: "access-control",
      version: `v${index + 1}`,
      risk_level: index % 2 === 0 ? "high" : "medium",
      status: "active",
      scope: "CSW",
      definition: {
        must_not_have_any_any: true,
        finding_title: `${runId}-Any-Any 风险-${index + 1}`,
        severity: index % 2 === 0 ? "high" : "medium",
        recommendation: "收敛源、目的和服务范围后重新发布基线。",
      },
    },
  });
}

async function createInspection(rule, assetIds, index) {
  return requestJson("POST", "/inspections", {
    data: {
      name: `${runId}-巡检-${index + 1}`,
      trigger_type: "manual",
      rule_set_id: rule.id,
      asset_scope: assetIds,
    },
  });
}

async function createReport() {
  return requestJson("POST", "/reports", {
    data: {
      report_type: "inspection_summary",
      parameters: {
        acceptance_run_id: runId,
        asset_count: assetCount,
        rule_count: ruleCount,
      },
    },
  });
}

async function runQueueUntil(label, check) {
  const firstValue = await check();
  if (firstValue) {
    return firstValue;
  }

  const outcomes = [];
  for (let index = 0; index < queueMaxRuns; index += 1) {
    const result = await dataServiceJson("POST", "/internal/queue/run-next");
    outcomes.push(`${result.job_type ?? "none"}:${result.status}`);
    const value = await check();
    if (value) {
      return value;
    }
    await delay(result.status === "idle" ? 400 : 80);
  }

  const stats = await dataServiceJson("GET", "/internal/queue/stats");
  throw new Error(`${label} 超时。队列轨迹：${outcomes.join(", ")}。当前队列：${JSON.stringify(stats)}`);
}

async function getConfig(configId) {
  return requestJson("GET", `/configs/${configId}`);
}

async function getInspection(inspectionId) {
  return requestJson("GET", `/inspections/${inspectionId}`);
}

async function getReport(reportId) {
  return requestJson("GET", `/reports/${reportId}`);
}

async function listFindings() {
  return requestJson("GET", `/findings?page=1&page_size=100`);
}

async function listReportArtifacts(reportId) {
  return requestJson("GET", `/reports/${reportId}/artifacts`);
}

async function main() {
  const startedAt = new Date();
  console.log(`M14-12 performance acceptance run: ${runId}`);
  console.log(`backend=${backendBaseUrl}, data-service=${dataServiceBaseUrl}, assets=${assetCount}, rules=${ruleCount}`);

  await stage("登录与服务可用性", async () => {
    await login();
    await dataServiceJson("GET", "/internal/health");
  });

  const assets = await stage("创建治理对象", async () => {
    const created = [];
    for (let index = 0; index < assetCount; index += 1) {
      created.push(await createAsset(index));
    }
    return created;
  });

  const configs = await stage("上传配置文件", async () => {
    const uploaded = [];
    for (let index = 0; index < assets.length; index += 1) {
      uploaded.push(await uploadConfig(assets[index], index));
    }
    return uploaded;
  });

  await stage("解析配置与 AI 摘要", async () => {
    await runQueueUntil("所有配置解析完成", async () => {
      const states = await Promise.all(configs.map((config) => getConfig(config.id)));
      if (states.some((config) => config.processing_status === "failed")) {
        throw new Error("至少一个配置解析失败");
      }
      return states.every((config) => config.processing_status === "parsed") ? states : null;
    });
    await drainQueue("解析后的 AI 摘要任务");
  });

  const rules = await stage("创建规则集", async () => {
    const created = [];
    for (let index = 0; index < ruleCount; index += 1) {
      created.push(await createRule(index));
    }
    return created;
  });

  const inspections = await stage("发起巡检任务", async () => {
    const assetIds = assets.map((asset) => asset.id);
    const created = [];
    for (let index = 0; index < rules.length; index += 1) {
      created.push(await createInspection(rules[index], assetIds, index));
    }
    return created;
  });

  await stage("执行巡检与 AI 摘要", async () => {
    await runQueueUntil("所有巡检完成", async () => {
      const states = await Promise.all(inspections.map((inspection) => getInspection(inspection.id)));
      if (states.some((inspection) => inspection.status === "failed")) {
        throw new Error("至少一个巡检任务失败");
      }
      return states.every((inspection) => inspection.status === "completed") ? states : null;
    });
    await drainQueue("巡检后的 AI 摘要任务");
  });

  const findings = await stage("查询问题结果", async () => {
    const result = await listFindings();
    const matched = result.items.filter((item) => item.title.includes(runId));
    if (matched.length < assetCount) {
      throw new Error(`问题数量不足，期望至少 ${assetCount}，实际 ${matched.length}`);
    }
    return matched;
  });

  const report = await stage("生成报告产物", async () => {
    const queued = await createReport();
    const completed = await runQueueUntil("报告生成完成", async () => {
      const current = await getReport(queued.id);
      if (current.status === "failed") {
        throw new Error("报告生成失败");
      }
      return current.status === "completed" ? current : null;
    });
    await drainQueue("报告后的 AI 摘要任务");
    return completed;
  });

  const artifacts = await stage("校验报告产物", async () => {
    const items = await listReportArtifacts(report.id);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("未生成报告产物");
    }
    return items;
  });

  const queueStats = await dataServiceJson("GET", "/internal/queue/stats");
  const totalDurationMs = timings.reduce((sum, item) => sum + item.durationMs, 0);
  const result = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    backendBaseUrl,
    dataServiceBaseUrl,
    input: { assetCount, ruleCount, configCount: configs.length, inspectionCount: inspections.length },
    output: { findingCount: findings.length, artifactCount: artifacts.length, reportId: report.id },
    queueStats,
    totalDurationMs,
    timings,
  };

  await writeReports(result);
  console.log(`性能验收报告已写入 ${reportPath}`);
}

async function drainQueue(label) {
  for (let index = 0; index < queueMaxRuns; index += 1) {
    const stats = await dataServiceJson("GET", "/internal/queue/stats");
    if (stats.pending === 0 && stats.processing === 0) {
      return stats;
    }
    await dataServiceJson("POST", "/internal/queue/run-next");
    await delay(60);
  }
  throw new Error(`${label} 队列未能清空`);
}

async function writeReports(result) {
  await mkdir("docs/04-structure", { recursive: true });
  await mkdir("tests/performance", { recursive: true });
  await writeFile(jsonPath, JSON.stringify(result, null, 2), "utf8");
  const markdown = [
    "# M14-12 性能验收报告",
    "",
    `- 运行编号：\`${result.runId}\``,
    `- 开始时间：${formatDate(result.startedAt)}`,
    `- 完成时间：${formatDate(result.completedAt)}`,
    `- Backend：\`${result.backendBaseUrl}\``,
    `- Data-Service：\`${result.dataServiceBaseUrl}\``,
    "",
    "## 输入规模",
    "",
    `- 治理对象：${result.input.assetCount}`,
    `- 配置文件：${result.input.configCount}`,
    `- 规则集：${result.input.ruleCount}`,
    `- 巡检任务：${result.input.inspectionCount}`,
    "",
    "## 输出结果",
    "",
    `- 问题记录：${result.output.findingCount}`,
    `- 报告产物：${result.output.artifactCount}`,
    `- 报告任务：\`${result.output.reportId}\``,
    `- 队列状态：pending=${result.queueStats.pending}，processing=${result.queueStats.processing}，failed=${result.queueStats.failed}`,
    "",
    "## 分阶段耗时",
    "",
    "| 阶段 | 耗时 |",
    "|------|------|",
    ...result.timings.map((item) => `| ${item.name} | ${formatMs(item.durationMs)} |`),
    `| 总计 | ${formatMs(result.totalDurationMs)} |`,
    "",
    "## 验收结论",
    "",
    "- 本脚本使用真实 backend、data-service、PostgreSQL 和 job_queue，不 mock 处理逻辑。",
    "- 默认规模用于日常交付验收；可通过 `PERF_ASSET_COUNT`、`PERF_RULE_COUNT` 放大样本。",
    `- JSON 原始结果写入 \`${jsonPath}\`，gzip 后大小约 ${gzipSync(JSON.stringify(result)).length} bytes。`,
    "",
  ].join("\n");
  await writeFile(reportPath, markdown, "utf8");
}

function formatMs(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value}ms`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

await main();
