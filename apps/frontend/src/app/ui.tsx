import type { ReactNode } from "react";
import Alert from "antd/es/alert";
import Empty from "antd/es/empty";
import Space from "antd/es/space";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import type { AiAnalysisJob } from "../types/api";
export { getDefaultTheme, panelStyle, surfaceStyle } from "./themeStyles";

const statusLabelMap: Record<string, string> = {
  active: "启用",
  maintenance: "维护中",
  retired: "已退役",
  parsed: "已解析",
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  pending_review: "待人工确认",
  approved: "已通过",
  rejected: "已驳回",
  pending: "待处理",
  open: "待处理",
  closed: "已关闭",
  draft: "草稿",
  skipped: "已跳过",
  exception_approved: "例外已批准",
  in_progress: "处理中",
};

const severityLabelMap: Record<string, string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

const analysisTypeLabelMap: Record<string, string> = {
  config_parse_summary: "配置解析摘要",
  inspection_findings_summary: "巡检发现摘要",
  report_digest: "报告摘要",
};

const reportTypeLabelMap: Record<string, string> = {
  inspection_summary: "巡检摘要",
  finding_digest: "问题摘要",
  audit_snapshot: "审计快照",
};

const triggerTypeLabelMap: Record<string, string> = {
  manual: "手动",
  scheduled: "定时",
};

const sourceLabelMap: Record<string, string> = {
  manual: "人工上传",
  sync: "同步导入",
};

const resourceTypeLabelMap: Record<string, string> = {
  user: "用户",
  asset: "治理对象",
  config_file: "配置文件",
  parse_run: "解析任务",
  normalized_config: "标准化配置",
  rule_set: "规则集",
  inspection_run: "巡检任务",
  finding: "问题",
  ticket: "工单",
  exception_request: "例外申请",
  report_job: "报告任务",
  report_artifact: "报告产物",
  ai_analysis_job: "AI 分析任务",
  auth: "认证",
  assets: "治理对象",
  configs: "配置",
  rules: "规则",
  inspections: "巡检",
  findings: "问题",
  tickets: "工单",
  exceptions: "例外",
  reports: "报告",
  audit: "审计",
};

const artifactTypeLabelMap: Record<string, string> = {
  markdown: "Markdown 文档",
};

export interface MetricItem {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning";
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function translateStatus(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return statusLabelMap[value] ?? value;
}

export function translateSeverity(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return severityLabelMap[value] ?? value;
}

export function translateAnalysisType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return analysisTypeLabelMap[value] ?? value;
}

export function translateReviewStatus(value?: string | null): string {
  return translateStatus(value);
}

export function translateReportType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return reportTypeLabelMap[value] ?? value;
}

export function translateTriggerType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return triggerTypeLabelMap[value] ?? value;
}

export function translateSource(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return sourceLabelMap[value] ?? value;
}

export function translateResourceType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return resourceTypeLabelMap[value] ?? value;
}

export function translateArtifactType(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return artifactTypeLabelMap[value] ?? value;
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        borderRadius: 16,
        background: "rgba(15, 23, 42, 0.88)",
        color: "#e5eefc",
        overflowX: "auto",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Typography.Title level={4} style={{ margin: 0, fontSize: 18 }}>
        {title}
      </Typography.Title>
      {subtitle ? (
        <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
          {subtitle}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics?: MetricItem[];
}) {
  return (
    <div className="shell-page-intro">
      <div className="shell-page-intro-top">
        <div className="shell-page-copy">
          {eyebrow ? <span className="shell-page-eyebrow">{eyebrow}</span> : null}
          <Typography.Title level={3} className="shell-page-title">
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Paragraph className="shell-page-description">
              {description}
            </Typography.Paragraph>
          ) : null}
        </div>
        {actions ? <div className="shell-page-actions">{actions}</div> : null}
      </div>
      {metrics?.length ? <MetricStrip items={metrics} /> : null}
    </div>
  );
}

export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="shell-metric-grid">
      {items.map((item) => (
        <div
          key={item.label}
          className={`shell-metric-tile${item.tone ? ` shell-metric-tile-${item.tone}` : ""}`}
        >
          <span className="shell-metric-label">{item.label}</span>
          <strong className="shell-metric-value">{item.value}</strong>
          {item.hint ? <span className="shell-metric-hint">{item.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="shell-key-value-list">
      {items.map((item) => (
        <div key={item.label} className="shell-key-value-row">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Toolbar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="shell-toolbar">
      <div className="shell-toolbar-group">{left}</div>
      <div className="shell-toolbar-group shell-toolbar-group-right">{right}</div>
    </div>
  );
}

export function StatusTag({ value }: { value: string | null | undefined }) {
  const colorMap: Record<string, string> = {
    active: "green",
    parsed: "cyan",
    queued: "gold",
    processing: "blue",
    completed: "green",
    failed: "red",
    pending_review: "orange",
    approved: "green",
    rejected: "red",
    pending: "gold",
    open: "blue",
    closed: "green",
    draft: "default",
    skipped: "default",
    exception_approved: "purple",
    maintenance: "orange",
    retired: "default",
    in_progress: "processing",
  };

  return <Tag color={value ? colorMap[value] ?? "default" : "default"}>{translateStatus(value)}</Tag>;
}

export function SeverityTag({ value }: { value: string | null | undefined }) {
  const colorMap: Record<string, string> = {
    critical: "red",
    high: "volcano",
    medium: "gold",
    low: "blue",
  };

  return <Tag color={value ? colorMap[value] ?? "default" : "default"}>{translateSeverity(value)}</Tag>;
}

export function QueryErrorNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "请求失败";
  return <Alert type="error" showIcon message="数据请求失败" description={message} />;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 180 }}>
      <Spin tip={label} />
    </div>
  );
}

export function DraftSummaries({ jobs }: { jobs: AiAnalysisJob[] | undefined }) {
  if (!jobs || jobs.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 AI 草稿摘要" />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {jobs.map((job) => (
        <Alert
          key={job.id}
          type="info"
          showIcon
          message={`${translateAnalysisType(job.analysis_type)} / ${translateReviewStatus(job.review_status)}`}
          description={
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Typography.Text>{job.summary || "摘要生成中。"}</Typography.Text>
              <JsonBlock value={job.details} />
            </Space>
          }
        />
      ))}
    </Space>
  );
}
