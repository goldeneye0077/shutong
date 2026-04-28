import type { ReactNode } from "react";
import { Alert, Empty, Space, Spin, Tag, Typography } from "@arco-design/web-react";
import type { AiAnalysisJob } from "../types/api";

export { getDefaultTheme, panelStyle, surfaceStyle } from "./themeStyles";

const statusLabelMap: Record<string, string> = {
  active: "启用",
  maintenance: "维护中",
  retired: "已退役",
  deleted: "已删除",
  parsed: "已解析",
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  pending_review: "待人工确认",
  not_submitted: "未提交复核",
  remediation_submitted: "整改待复核",
  approved: "已通过",
  rejected: "已驳回",
  pending: "待处理",
  open: "待处理",
  closed: "已关闭",
  draft: "草稿",
  skipped: "已跳过",
  exception_approved: "例外已批准",
  in_progress: "处理中",
  unread: "未读",
  read: "已读",
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
  inspection_package: "迎检资料包",
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
  ai_analysis_job: "智能分析任务",
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
  ledger_item: "台账",
  scheduled_task: "周期任务",
  notification: "消息提醒",
  ticket_attachment: "工单附件",
  ticket_reminder: "催办记录",
  log_clue: "日志线索",
  report_template: "报告模板",
  system_parameter: "系统参数",
  job_queue: "任务队列",
  role: "角色",
};

const artifactTypeLabelMap: Record<string, string> = {
  markdown: "Markdown 文档",
  csv: "CSV 问题清单",
  json: "JSON 统计摘要",
  zip: "ZIP 资料包",
};

const auditActionLabelMap: Record<string, string> = {
  "auth.login": "用户登录",
  "asset.create": "创建对象",
  "asset.update": "更新对象",
  "asset.delete": "删除对象",
  "config.upload": "上传配置",
  "config.bulk_upload": "批量上传配置",
  "config.parse.completed": "配置解析完成",
  "rule.create": "创建规则",
  "rule.update": "更新规则",
  "inspection.create": "创建巡检",
  "inspection.execution.completed": "巡检执行完成",
  "ticket.create": "创建工单",
  "ticket.update": "更新工单",
  "ticket.submit_review": "提交工单复核",
  "ticket.review_approve": "工单复核通过",
  "ticket.review_reject": "工单复核驳回",
  "ticket.attachment_upload": "上传工单附件",
  "ticket.attachment_download": "下载工单附件",
  "ticket.reminder_create": "创建催办记录",
  "ticket.log_clue_trace": "查看工单日志线索",
  "finding.log_clue_trace": "查看问题日志线索",
  "finding.topic_search": "检索问题专题",
  "exception.create": "提交例外",
  "exception.approve": "批准例外",
  "exception.reject": "驳回例外",
  "report.create": "创建报告",
  "report.download": "下载报告",
  "report.generation.completed": "报告生成完成",
  "ai.analysis.completed": "智能分析完成",
  "ledger.import": "导入台账",
  "scheduled_task.create": "创建周期任务",
  "scheduled_task.update": "更新周期任务",
  "scheduled_task.trigger": "触发周期任务",
  "scheduled_task.executed": "周期任务执行",
  "notification.create": "创建提醒",
  "notification.read": "读取提醒",
  "log_clue.import": "导入日志线索",
  "log_clue.search": "检索日志线索",
  "report_template.create": "创建报告模板",
  "report_template.update": "更新报告模板",
  "report_template.delete": "删除报告模板",
  "system_parameter.upsert": "保存系统参数",
  "system_parameter.update": "更新系统参数",
  "ai_analysis.review": "复核智能草稿",
  "job.retry": "重试任务",
  "role.update": "更新角色",
  "user.create": "创建用户",
  "user.update": "更新用户",
};

export interface MetricItem {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning";
}

export interface CommandMetricItem {
  label: string;
  value: ReactNode;
  meta?: string;
  tone?: "cyan" | "blue" | "amber" | "red";
  signal?: ReactNode;
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

export function translateAuditAction(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return auditActionLabelMap[value] ?? value;
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        borderRadius: 16,
        border: "1px solid var(--shell-border)",
        background: "rgba(3, 10, 19, 0.62)",
        color: "var(--shell-text)",
        overflowX: "auto",
        fontSize: 12,
        lineHeight: 1.55,
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
    <div className="shell-section-title">
      <Typography.Title heading={4} style={{ margin: 0, fontSize: 20, letterSpacing: "-0.03em" }}>
        {title}
      </Typography.Title>
      {subtitle ? (
        <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
          {subtitle}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}

export function CommandMetric({ label, value, meta, tone = "cyan", signal }: CommandMetricItem) {
  return (
    <article className={`shell-command-metric shell-command-metric-${tone}`}>
      <div className="shell-command-metric-head">
        <span>{label}</span>
        {signal ? <small aria-hidden="true">{signal}</small> : null}
      </div>
      <strong>{value}</strong>
      {meta ? <p>{meta}</p> : null}
    </article>
  );
}

export function OperatorPanel({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="shell-panel shell-operator-panel">
      <div className="shell-operator-panel-head">
        <div>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Paragraph style={{ margin: "6px 0 0", color: "var(--shell-muted)" }}>
              {subtitle}
            </Typography.Paragraph>
          ) : null}
        </div>
        {aside ? <div className="shell-operator-panel-aside">{aside}</div> : null}
      </div>
      {children}
    </section>
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
          <Typography.Title heading={3} className="shell-page-title">
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
    active: "cyan",
    deleted: "gray",
    parsed: "blue",
    queued: "gold",
    processing: "cyan",
    completed: "arcoblue",
    failed: "red",
    pending_review: "gold",
    not_submitted: "gray",
    remediation_submitted: "gold",
    approved: "blue",
    rejected: "red",
    pending: "gold",
    open: "orange",
    closed: "arcoblue",
    draft: "gray",
    skipped: "gray",
    exception_approved: "arcoblue",
    maintenance: "gold",
    retired: "gray",
    in_progress: "cyan",
  };

  return <Tag color={value ? colorMap[value] ?? "gray" : "gray"}>{translateStatus(value)}</Tag>;
}

export function SeverityTag({ value }: { value: string | null | undefined }) {
  const colorMap: Record<string, string> = {
    critical: "red",
    high: "orangered",
    medium: "gold",
    low: "cyan",
  };

  return <Tag color={value ? colorMap[value] ?? "gray" : "gray"}>{translateSeverity(value)}</Tag>;
}

export function QueryErrorNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "请求失败";
  return <Alert type="error" showIcon title="数据请求失败" content={message} />;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 180 }}>
      <Space direction="vertical" size="small" align="center">
        <Spin />
        <span style={{ color: "var(--shell-muted)", fontSize: 13 }}>{label}</span>
      </Space>
    </div>
  );
}

export function DraftSummaries({ jobs }: { jobs: AiAnalysisJob[] | undefined }) {
  if (!jobs || jobs.length === 0) {
    return <Empty description="暂无智能草稿摘要" />;
  }

  return (
    <Space direction="vertical" size="medium" style={{ width: "100%" }}>
      {jobs.map((job) => (
        <Alert
          key={job.id}
          type="info"
          showIcon
          title={`${translateAnalysisType(job.analysis_type)} / ${translateReviewStatus(job.review_status)}`}
          content={
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
