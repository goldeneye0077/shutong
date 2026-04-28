import { useQuery } from "@tanstack/react-query";
import {
  IconApps,
  IconBranch,
  IconExclamationCircle,
  IconFile,
} from "@arco-design/web-react/icon";
import { Alert, Empty, Space, Tag, Typography } from "@arco-design/web-react";
import { useAuth } from "../app/auth";
import { getActiveRefetchInterval } from "../app/polling";
import {
  CommandMetric,
  KeyValueList,
  LoadingBlock,
  OperatorPanel,
  QueryErrorNotice,
  SeverityTag,
  StatusTag,
  formatDateTime,
  translateAuditAction,
  translateReportType,
  translateSeverity,
  translateResourceType,
} from "../app/ui";
import {
  getDashboardMetrics,
  getSystemSummary,
  listAssets,
  listAuditEvents,
  listFindings,
  listInspections,
  listReports,
} from "../services/api";
import type { AuditEvent, Finding, InspectionRun, ReportJob } from "../types/api";
import type { ThemeMode } from "../theme/theme";

const pressureLabels = ["对象", "巡检", "风险", "报告", "审计"];

function severityRank(value: string) {
  const rank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return rank[value] ?? 0;
}

function buildPressureValues({
  assetCount,
  activeInspections,
  openFindings,
  pendingReports,
  auditCount,
}: {
  assetCount: number;
  activeInspections: number;
  openFindings: number;
  pendingReports: number;
  auditCount: number;
}) {
  return [
    Math.max(assetCount * 8, assetCount ? 24 : 0),
    Math.max(activeInspections * 28, activeInspections ? 36 : 0),
    Math.max(openFindings * 18, openFindings ? 32 : 0),
    Math.max(pendingReports * 22, pendingReports ? 30 : 0),
    Math.max(auditCount * 4, auditCount ? 18 : 0),
  ];
}

function buildLinePath(values: number[]) {
  const width = 720;
  const height = 270;
  const left = 46;
  const bottom = 214;
  const chartWidth = width - left * 2;
  const chartHeight = 154;
  const maxValue = Math.max(...values, 1);

  const points = values.map((value, index) => {
    const x = left + (chartWidth / Math.max(values.length - 1, 1)) * index;
    const y = bottom - (value / maxValue) * chartHeight;
    return { x, y };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = points[points.length - 1] ?? { x: width - left, y: bottom };
  const firstPoint = points[0] ?? { x: left, y: bottom };
  const area = `${line} L ${lastPoint.x} ${bottom} L ${firstPoint.x} ${bottom} Z`;

  return { area, line, maxValue, bottom };
}

function createActivity(event: AuditEvent) {
  return {
    id: event.id,
    title: `${translateResourceType(event.resource_type)} / ${translateAuditAction(event.action)}`,
    description: `资源 ${event.resource_id.slice(0, 8)} · ${formatDateTime(event.created_at)}`,
    time: formatDateTime(event.created_at),
  };
}

function getRiskTitle(finding: Finding) {
  return finding.title || `${translateSeverity(finding.severity)}风险`;
}

export function DashboardPage({ mode }: { mode: ThemeMode }) {
  const { accessToken, user } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ["system-summary", accessToken],
    queryFn: () => getSystemSummary(accessToken),
  });
  const dashboardMetricsQuery = useQuery({
    queryKey: ["dashboard-metrics", accessToken],
    queryFn: () => getDashboardMetrics(accessToken!),
    enabled: Boolean(accessToken),
  });
  const assetsQuery = useQuery({
    queryKey: ["assets", accessToken],
    queryFn: () => listAssets(accessToken!),
    enabled: Boolean(accessToken),
  });
  const inspectionsQuery = useQuery({
    queryKey: ["inspections", accessToken],
    queryFn: () => listInspections(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: (query) =>
      getActiveRefetchInterval(
        (((query.state.data as { items?: InspectionRun[] } | undefined)?.items ?? []).map((item) => item.status)),
      ),
  });
  const findingsQuery = useQuery({
    queryKey: ["findings", accessToken, "dashboard"],
    queryFn: () => listFindings(accessToken!),
    enabled: Boolean(accessToken),
  });
  const reportsQuery = useQuery({
    queryKey: ["reports", accessToken],
    queryFn: () => listReports(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: (query) =>
      getActiveRefetchInterval((((query.state.data as ReportJob[] | undefined) ?? []).map((item) => item.status))),
  });
  const auditQuery = useQuery({
    queryKey: ["audit-events", accessToken, "dashboard"],
    queryFn: () => listAuditEvents(accessToken!),
    enabled: Boolean(accessToken),
  });

  const assetCount = assetsQuery.data?.total ?? 0;
  const inspectionItems = inspectionsQuery.data?.items ?? [];
  const findingItems = findingsQuery.data?.items ?? [];
  const reportItems = reportsQuery.data ?? [];
  const auditItems = auditQuery.data?.items ?? [];
  const dashboardMetrics = dashboardMetricsQuery.data;
  const activityItems = auditItems.slice(0, 5).map(createActivity);

  const activeInspections = inspectionItems.filter((item) => item.status === "queued" || item.status === "processing").length;
  const openFindings = findingItems.filter((item) => item.status === "open" || item.status === "pending").length;
  const severeFindings = findingItems.filter(
    (item) => (item.status === "open" || item.status === "pending") && ["critical", "high"].includes(item.severity),
  ).length;
  const pendingReports = reportItems.filter((item) => item.status === "queued" || item.status === "processing").length;
  const pressureValues = buildPressureValues({
    assetCount,
    activeInspections,
    openFindings,
    pendingReports,
    auditCount: auditItems.length,
  });
  const pressureChart = buildLinePath(pressureValues);

  const pendingQueue = [
    ...inspectionItems
      .filter((item) => item.status === "queued" || item.status === "processing")
      .map((item) => ({
        id: `inspection-${item.id}`,
        title: item.name,
        meta: `${item.asset_scope.length} 个对象 · 巡检`,
        status: item.status,
        updatedAt: item.updated_at,
      })),
    ...reportItems
      .filter((item) => item.status === "queued" || item.status === "processing")
      .map((item) => ({
        id: `report-${item.id}`,
        title: translateReportType(item.report_type),
        meta: "报告生成",
        status: item.status,
        updatedAt: item.updated_at,
      })),
  ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const riskBacklog = findingItems
    .filter((item) => item.status === "open" || item.status === "pending")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section className="shell-command-hero">
        <div className="shell-command-hero-copy">
          <span className="shell-overline">值守驾驶舱</span>
          <Typography.Title heading={2}>值守总览</Typography.Title>
          <p>{user?.full_name || user?.username || "管理员"}，当前页面只展示可操作状态：队列、风险、报告和审计。</p>
        </div>
        <div className="shell-command-hero-status">
          <span className="shell-live-dot" />
          <div>
            <strong>三域链路在线</strong>
            <span>前端调用后端；数据服务仅消费任务队列。</span>
          </div>
        </div>
      </section>

      <div className="shell-command-metric-grid">
        <CommandMetric
          label="治理对象"
          value={dashboardMetrics?.coverage.asset_total ?? assetCount}
          meta={`覆盖率 ${dashboardMetrics?.coverage.coverage_rate ?? 0}%`}
          tone="cyan"
          signal={<IconApps />}
        />
        <CommandMetric
          label="整改率"
          value={`${dashboardMetrics?.rectification.rectification_rate ?? 100}%`}
          meta={`${dashboardMetrics?.rectification.pending_ticket_reviews ?? 0} 个待复核`}
          tone="blue"
          signal={<IconBranch />}
        />
        <CommandMetric
          label="待处理风险"
          value={dashboardMetrics?.rectification.open_findings ?? openFindings}
          meta={`${dashboardMetrics?.alerts.high_open_findings ?? severeFindings} 个高危以上`}
          tone={severeFindings > 0 ? "red" : "amber"}
          signal={<IconExclamationCircle />}
        />
        <CommandMetric
          label="试点节省"
          value={`${dashboardMetrics?.pilot_effect.estimated_saved_minutes ?? 0} 分钟`}
          meta={`${dashboardMetrics?.pilot_effect.efficiency_uplift_percent ?? 0}% 效率提升估算`}
          tone="amber"
          signal={<IconFile />}
        />
      </div>

      <div className="shell-duty-grid">
        <OperatorPanel
          title="当前压力模型"
          subtitle="由当前对象、执行队列、待处理风险、报告队列和审计事件计算，仅用于值守排序。"
          aside={<Tag color={mode === "dark" ? "cyan" : "blue"}>实时查询</Tag>}
        >
          <div className="shell-pressure-chart">
            <svg viewBox="0 0 720 270" className="shell-growth-chart-svg" role="img" aria-label="当前压力模型">
              <defs>
                <linearGradient id="pressureAreaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(42, 168, 255, 0.34)" />
                  <stop offset="68%" stopColor="rgba(32, 215, 255, 0.12)" />
                  <stop offset="100%" stopColor="rgba(23, 105, 255, 0.02)" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = pressureChart.bottom - 154 * ratio;
                const value = Math.round(pressureChart.maxValue * ratio);
                return (
                  <g key={ratio}>
                    <line x1="46" x2="674" y1={y} y2={y} stroke="rgba(139, 170, 204, 0.16)" strokeDasharray="4 10" />
                    <text x="4" y={y + 5} className="shell-growth-chart-axis">
                      {value}
                    </text>
                  </g>
                );
              })}

              <path d={pressureChart.area} fill="url(#pressureAreaGradient)" />
              <path d={pressureChart.line} fill="none" stroke="var(--shell-accent)" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <div className="shell-growth-chart-months">
              {pressureLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </OperatorPanel>

        <OperatorPanel title="最近审计事件" subtitle="只展示系统真实事件，不补演示动态。">
          {auditQuery.isLoading ? (
            <LoadingBlock label="正在读取审计事件" />
          ) : auditQuery.error ? (
            <QueryErrorNotice error={auditQuery.error} />
          ) : activityItems.length > 0 ? (
            <div className="shell-activity-list">
              {activityItems.map((item) => (
                <div key={item.id} className="shell-activity-item">
                  <span className="shell-activity-bullet" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small className="shell-activity-time">{item.time}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无审计事件" />
          )}
        </OperatorPanel>
      </div>

      <div className="shell-duty-grid shell-duty-grid-balanced">
        <OperatorPanel title="任务队列" subtitle="巡检和报告的后台处理状态。">
          <div className="shell-data-stack">
            {pendingQueue.slice(0, 5).map((item) => (
              <div key={item.id} className="shell-data-strip">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <div className="shell-data-strip-tail">
                  <StatusTag value={item.status} />
                  <small>{formatDateTime(item.updatedAt)}</small>
                </div>
              </div>
            ))}
            {pendingQueue.length === 0 ? (
              <div className="shell-empty-state">当前没有排队或处理中的巡检、报告任务。</div>
            ) : null}
          </div>
        </OperatorPanel>

        <OperatorPanel title="待办处置" subtitle="优先展示高风险与未关闭发现。">
          <div className="shell-data-stack">
            {riskBacklog.map((item) => (
              <div key={item.id} className="shell-data-strip">
                <div>
                  <strong>{getRiskTitle(item)}</strong>
                  <span>{item.asset_id ? `对象 ${item.asset_id.slice(0, 8)}` : "未绑定对象"}</span>
                </div>
                <div className="shell-data-strip-tail">
                  <SeverityTag value={item.severity} />
                  <StatusTag value={item.status} />
                </div>
              </div>
            ))}
            {riskBacklog.length === 0 ? <div className="shell-empty-state">当前没有待处理风险。</div> : null}
          </div>
        </OperatorPanel>
      </div>

      <div className="shell-duty-grid shell-duty-grid-balanced">
        <OperatorPanel title="验收指标" subtitle="按需求口径聚合覆盖率、整改率和试点效果。">
          {dashboardMetricsQuery.isLoading ? (
            <LoadingBlock label="正在计算验收指标" />
          ) : dashboardMetricsQuery.error ? (
            <QueryErrorNotice error={dashboardMetricsQuery.error} />
          ) : (
            <KeyValueList
              items={[
                {
                  label: "配置覆盖率",
                  value: `${dashboardMetrics?.coverage.configured_assets ?? 0}/${dashboardMetrics?.coverage.asset_total ?? 0}，${dashboardMetrics?.coverage.coverage_rate ?? 0}%`,
                },
                {
                  label: "整改完成率",
                  value: `${dashboardMetrics?.rectification.closed_findings ?? 0}/${dashboardMetrics?.rectification.finding_total ?? 0}，${dashboardMetrics?.rectification.rectification_rate ?? 100}%`,
                },
                {
                  label: "待复核工单",
                  value: `${dashboardMetrics?.rectification.pending_ticket_reviews ?? 0} 个`,
                },
                {
                  label: "估算节省时长",
                  value: `${dashboardMetrics?.pilot_effect.estimated_saved_minutes ?? 0} 分钟`,
                },
              ]}
            />
          )}
        </OperatorPanel>

        <OperatorPanel title="风险热点" subtitle="按对象类型和风险等级聚合，优先展示问题高发区域。">
          {dashboardMetricsQuery.isLoading ? (
            <LoadingBlock label="正在计算风险热点" />
          ) : dashboardMetricsQuery.error ? (
            <QueryErrorNotice error={dashboardMetricsQuery.error} />
          ) : dashboardMetrics?.risk_hotspots.length ? (
            <div className="shell-data-stack">
              {dashboardMetrics.risk_hotspots.map((hotspot) => (
                <div key={`${hotspot.asset_type}-${hotspot.severity}`} className="shell-data-strip">
                  <div>
                    <strong>{hotspot.asset_type}</strong>
                    <span>{hotspot.count} 条问题</span>
                  </div>
                  <div className="shell-data-strip-tail">
                    <SeverityTag value={hotspot.severity} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="shell-empty-state">当前没有可聚合的风险热点。</div>
          )}
        </OperatorPanel>
      </div>

      <div className="shell-duty-grid shell-duty-grid-balanced">
        <OperatorPanel title="平台边界" subtitle="三域职责保持清晰，前端不直接访问数据服务。">
          {summaryQuery.isLoading ? (
            <LoadingBlock label="正在读取系统边界" />
          ) : summaryQuery.error ? (
            <QueryErrorNotice error={summaryQuery.error} />
          ) : (
            <Space direction="vertical" size="medium" style={{ width: "100%" }}>
              <Alert type="success" showIcon title="前端" content={summaryQuery.data?.frontend_boundary} />
              <Alert type="info" showIcon title="后端" content={summaryQuery.data?.backend_boundary} />
              <Alert type="warning" showIcon title="数据服务" content={summaryQuery.data?.data_service_boundary} />
            </Space>
          )}
        </OperatorPanel>

        <OperatorPanel title="值守摘要" subtitle="帮助操作员快速判断下一步。">
          <KeyValueList
            items={[
              { label: "活动巡检", value: `${activeInspections} 个` },
              { label: "待处理风险", value: `${openFindings} 个` },
              { label: "高危以上风险", value: `${severeFindings} 个` },
              { label: "报告生成中", value: `${pendingReports} 个` },
              { label: "最近任务更新", value: formatDateTime(inspectionItems[0]?.updated_at ?? reportItems[0]?.updated_at) },
            ]}
          />
        </OperatorPanel>
      </div>
    </Space>
  );
}
