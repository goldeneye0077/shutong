const backendBaseUrl = trimTrailingSlash(process.env.SEED_BACKEND_URL ?? "http://localhost:8000/api/v1");
const dataServiceBaseUrl = trimTrailingSlash(process.env.SEED_DATA_SERVICE_URL ?? "http://localhost:8010");
const username = process.env.SEED_USERNAME ?? "admin";
const password = process.env.SEED_PASSWORD ?? "admin123";
const prefix = process.env.SEED_PREFIX ?? `演示数据-${formatTimestamp(new Date())}`;

let accessToken = "";

const seedState = {
  prefix,
  assets: [],
  configs: [],
  rules: [],
  inspections: [],
  findings: [],
  tickets: [],
  exceptions: [],
  reports: [],
  artifacts: [],
};

async function main() {
  await assertService(`${backendBaseUrl}/health`, "backend");
  await assertService(`${dataServiceBaseUrl}/internal/health`, "data-service");

  const bundle = await backendJson("POST", "/auth/login", {
    username,
    password,
  });
  accessToken = bundle.access_token;

  const assets = await createAssets();
  await uploadAndParseConfigs(assets);

  const rules = await createRules();
  const inspections = await createInspections(rules, assets);
  await runInspections(inspections);

  const findings = await collectSeedFindings(inspections);
  await createWorkflowData(findings);
  await createReports();
  await verifyAudit();

  printSummary();
}

async function createAssets() {
  const assetPayloads = [
    {
      name: `${prefix}-CSW-核心交换-01`,
      asset_type: "CSW",
      vendor: "Huawei",
      status: "active",
      owner: "核心网一线值守",
      scenario: "月度配置合规巡检",
    },
    {
      name: `${prefix}-OMFW-防火墙-01`,
      asset_type: "OMFW",
      vendor: "H3C",
      status: "active",
      owner: "安全运维组",
      scenario: "边界访问控制复核",
    },
    {
      name: `${prefix}-PE-出口路由-01`,
      asset_type: "PE",
      vendor: "Huawei",
      status: "maintenance",
      owner: "承载网维护组",
      scenario: "变更后配置复核",
    },
  ];

  for (const payload of assetPayloads) {
    const asset = await backendJson("POST", "/assets", payload);
    seedState.assets.push(asset);
  }
  return seedState.assets;
}

async function uploadAndParseConfigs(assets) {
  const configByType = {
    CSW: [
      "hostname demo-csw-core-01",
      "interface GigabitEthernet0/0/1",
      " description uplink-to-core-router",
      " ip address 10.10.10.1 255.255.255.0",
      " undo shutdown",
      "interface GigabitEthernet0/0/2",
      " description access-to-service-zone",
      " ip address 10.10.20.1 255.255.255.0",
      " undo shutdown",
      "acl number 3000",
      " rule 5 permit ip any any",
      " rule 10 deny tcp source 10.0.0.0 0.255.255.255 destination 192.168.0.0 0.0.255.255",
      "return",
    ].join("\n"),
    OMFW: [
      "hostname demo-omfw-01",
      "interface GigabitEthernet1/0/1",
      " description trust-zone",
      " ip address 172.16.1.1 255.255.255.0",
      "security-policy",
      " rule name allow-monitoring",
      "  source-zone trust",
      "  destination-zone dmz",
      "  service ssh",
      "  action permit",
      "return",
    ].join("\n"),
    PE: [
      "hostname demo-pe-egress-01",
      "interface GigabitEthernet0/0/0",
      " description upstream-link",
      " ip address 100.64.1.1 255.255.255.252",
      "bgp 65000",
      " peer 100.64.1.2 as-number 65001",
      "return",
    ].join("\n"),
  };

  for (const asset of assets) {
    const config = await uploadConfig(asset, configByType[asset.asset_type] ?? configByType.CSW);
    seedState.configs.push(config);
    const parsedConfig = await runQueueUntil(`配置 ${config.filename} 解析完成`, async () => {
      const current = await backendJson("GET", `/configs/${config.id}`);
      if (current.processing_status === "failed") {
        throw new Error(`配置解析失败: ${config.id}`);
      }
      return current.processing_status === "parsed" ? current : null;
    });
    seedState.configs[seedState.configs.length - 1] = parsedConfig;
    await runQueueUntil(`配置 ${config.filename} AI 摘要完成`, async () => {
      const summaries = await backendJson("GET", `/configs/${config.id}/ai-summaries`);
      return summaries.find((item) => item.status === "completed") ?? null;
    });
  }
}

async function uploadConfig(asset, text) {
  const formData = new FormData();
  formData.set("asset_id", asset.id);
  formData.set("source", "manual");
  formData.set(
    "upload",
    new Blob([text], { type: "text/plain" }),
    `${asset.name}.cfg`,
  );

  return backendFetchJson("/configs/upload", {
    method: "POST",
    body: formData,
    headers: authHeaders(),
  });
}

async function createRules() {
  const rulePayloads = [
    {
      name: `${prefix}-禁止 Any-Any 放通`,
      category: "访问控制",
      version: "v1",
      risk_level: "high",
      status: "active",
      scope: "CSW/OMFW/PE",
      definition: {
        must_not_have_any_any: true,
        severity: "high",
        finding_title: `${prefix}-发现 Any-Any 放通风险`,
        recommendation: "收敛源地址和目的地址范围，禁止生产配置中保留任意到任意放通。",
      },
    },
    {
      name: `${prefix}-接口数量基线`,
      category: "基础配置",
      version: "v1",
      risk_level: "medium",
      status: "active",
      scope: "PE",
      definition: {
        minimum_interface_count: 2,
        severity: "medium",
        finding_title: `${prefix}-接口数量低于基线`,
        recommendation: "复核设备配置采集完整性，确认关键接口是否缺失或配置未纳管。",
      },
    },
  ];

  for (const payload of rulePayloads) {
    const rule = await backendJson("POST", "/rules", payload);
    seedState.rules.push(rule);
  }
  return seedState.rules;
}

async function createInspections(rules, assets) {
  const anyAnyRule = rules[0];
  const interfaceBaselineRule = rules[1];
  const peAsset = assets.find((asset) => asset.asset_type === "PE");

  const inspectionPayloads = [
    {
      name: `${prefix}-全量访问控制巡检`,
      trigger_type: "manual",
      rule_set_id: anyAnyRule.id,
      asset_scope: assets.map((asset) => asset.id),
    },
    {
      name: `${prefix}-PE接口基线巡检`,
      trigger_type: "manual",
      rule_set_id: interfaceBaselineRule.id,
      asset_scope: [peAsset.id],
    },
  ];

  for (const payload of inspectionPayloads) {
    const inspection = await backendJson("POST", "/inspections", payload);
    seedState.inspections.push(inspection);
  }
  return seedState.inspections;
}

async function runInspections(inspections) {
  for (const inspection of inspections) {
    await runQueueUntil(`巡检 ${inspection.name} 执行完成`, async () => {
      const current = await backendJson("GET", `/inspections/${inspection.id}`);
      if (current.status === "failed") {
        throw new Error(`巡检执行失败: ${inspection.id}`);
      }
      return current.status === "completed" ? current : null;
    });
    await runQueueUntil(`巡检 ${inspection.name} AI 摘要完成`, async () => {
      const summaries = await backendJson("GET", `/inspections/${inspection.id}/ai-summaries`);
      return summaries.find((item) => item.status === "completed") ?? null;
    });
  }
}

async function collectSeedFindings(inspections) {
  const findings = [];
  for (const inspection of inspections) {
    const response = await backendJson("GET", `/findings?page=1&page_size=100&inspection_run_id=${inspection.id}`);
    findings.push(...response.items);
  }

  if (findings.length < 2) {
    throw new Error(`演示数据至少应生成 2 条问题，实际生成 ${findings.length} 条。`);
  }

  seedState.findings.push(...findings);
  return findings;
}

async function createWorkflowData(findings) {
  const firstFinding = findings[0];
  const secondFinding = findings[1];

  const firstTicket = await backendJson("POST", "/tickets", {
    finding_id: firstFinding.id,
    assignee: "张工-核心网",
    due_at: daysFromNow(7),
  });
  seedState.tickets.push(firstTicket);

  const inProgressTicket = await backendJson("PATCH", `/tickets/${firstTicket.id}`, {
    status: "in_progress",
    resolution_note: "已纳入下一维护窗口，等待配置变更审批。",
  });
  seedState.tickets[0] = inProgressTicket;

  const exception = await backendJson("POST", "/exceptions", {
    ticket_id: firstTicket.id,
    reason: "业务割接窗口尚未开启，需保留临时访问策略并纳入人工复核。",
    expires_at: daysFromNow(30),
  });
  seedState.exceptions.push(exception);

  const approvedException = await backendJson("POST", `/exceptions/${exception.id}/approve`, {
    comment: "批准至下个维护周期，期间需保留审计记录。",
  });
  seedState.exceptions[0] = approvedException;

  const secondTicket = await backendJson("POST", "/tickets", {
    finding_id: secondFinding.id,
    assignee: "李工-承载网",
    due_at: daysFromNow(5),
  });
  seedState.tickets.push(secondTicket);

  const closedTicket = await backendJson("PATCH", `/tickets/${secondTicket.id}`, {
    status: "closed",
    resolution_note: "已确认配置采集遗漏，完成补采后关闭。",
  });
  seedState.tickets[1] = closedTicket;
}

async function createReports() {
  for (const reportType of ["inspection_summary", "finding_digest", "audit_snapshot"]) {
    const report = await backendJson("POST", "/reports", { report_type: reportType });
    seedState.reports.push(report);

    const completedReport = await runQueueUntil(`报告 ${reportType} 生成完成`, async () => {
      const current = await backendJson("GET", `/reports/${report.id}`);
      if (current.status === "failed") {
        throw new Error(`报告生成失败: ${report.id}`);
      }
      return current.status === "completed" ? current : null;
    });
    seedState.reports[seedState.reports.length - 1] = completedReport;

    await runQueueUntil(`报告 ${reportType} AI 摘要完成`, async () => {
      const summaries = await backendJson("GET", `/reports/${report.id}/ai-summaries`);
      return summaries.find((item) => item.status === "completed") ?? null;
    });

    const artifacts = await backendJson("GET", `/reports/${report.id}/artifacts`);
    seedState.artifacts.push(...artifacts);

    if (artifacts[0]) {
      await backendFetch(`/reports/${report.id}/artifacts/${artifacts[0].id}/download`, {
        method: "GET",
        headers: authHeaders(),
      });
    }
  }
}

async function verifyAudit() {
  const requiredActions = [
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
  ];

  for (const action of requiredActions) {
    const response = await backendJson("GET", `/audit?page=1&page_size=100&action=${encodeURIComponent(action)}`);
    if (response.total < 1) {
      throw new Error(`未找到审计动作: ${action}`);
    }
  }
}

async function runQueueUntil(description, check, maxRuns = 60) {
  const firstValue = await check();
  if (firstValue) {
    return firstValue;
  }

  const outcomes = [];
  for (let index = 0; index < maxRuns; index += 1) {
    const result = await dataServiceJson("POST", "/internal/queue/run-next");
    outcomes.push(`${result.job_type ?? "none"}:${result.status}`);

    const value = await check();
    if (value) {
      return value;
    }

    await delay(result.status === "idle" ? 500 : 150);
  }

  const stats = await dataServiceJson("GET", "/internal/queue/stats");
  throw new Error(`${description} 超时。队列推进: ${outcomes.join(", ")}；队列状态: ${JSON.stringify(stats)}`);
}

async function backendJson(method, path, payload) {
  return backendFetchJson(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function dataServiceJson(method, path) {
  const response = await fetch(`${dataServiceBaseUrl}${path}`, { method });
  await expectOk(response, `${method} ${path}`);
  return response.json();
}

async function backendFetchJson(path, options) {
  const response = await backendFetch(path, options);
  return response.json();
}

async function backendFetch(path, options) {
  const response = await fetch(`${backendBaseUrl}${path}`, options);
  await expectOk(response, `${options?.method ?? "GET"} ${path}`);
  return response;
}

async function assertService(url, label) {
  const response = await fetch(url);
  await expectOk(response, `检查 ${label} 服务`);
}

async function expectOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} 失败: HTTP ${response.status} ${await response.text()}`);
  }
}

function authHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printSummary() {
  const lines = [
    "",
    "演示数据已写入当前数据库。",
    `数据前缀: ${seedState.prefix}`,
    "",
    "资产:",
    ...seedState.assets.map((asset) => `- ${asset.name} (${asset.asset_type}) id=${asset.id}`),
    "",
    "配置:",
    ...seedState.configs.map((config) => `- ${config.filename} v${config.version} status=${config.processing_status} id=${config.id}`),
    "",
    "规则:",
    ...seedState.rules.map((rule) => `- ${rule.name} risk=${rule.risk_level} id=${rule.id}`),
    "",
    "巡检:",
    ...seedState.inspections.map((inspection) => `- ${inspection.name} id=${inspection.id}`),
    "",
    "问题与闭环:",
    `- findings=${seedState.findings.length}`,
    `- tickets=${seedState.tickets.length}`,
    `- exceptions=${seedState.exceptions.length}`,
    "",
    "报告:",
    ...seedState.reports.map((report) => `- ${report.report_type} status=${report.status} id=${report.id}`),
    `- artifacts=${seedState.artifacts.length}`,
    "",
    "前端查看:",
    "- http://localhost:5173/assets",
    "- http://localhost:5173/rules",
    "- http://localhost:5173/workflow",
    "- http://localhost:5173/reports",
    "- http://localhost:5173/audit",
  ];
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
