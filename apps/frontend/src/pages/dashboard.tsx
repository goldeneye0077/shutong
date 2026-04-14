import { useQuery } from "@tanstack/react-query";
import Alert from "antd/es/alert";
import Col from "antd/es/col";
import Row from "antd/es/row";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "../app/auth";
import { getActiveRefetchInterval } from "../app/polling";
import {
  KeyValueList,
  LoadingBlock,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  StatusTag,
  formatDateTime,
  panelStyle,
  translateReportType,
  translateResourceType,
} from "../app/ui";
import { getSystemSummary, listAssets, listFindings, listInspections, listReports } from "../services/api";
import type { InspectionRun, ReportJob } from "../types/api";
import type { ThemeMode } from "../theme/theme";

export function DashboardPage({ mode }: { mode: ThemeMode }) {
  const { accessToken, user } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ["system-summary", accessToken],
    queryFn: () => getSystemSummary(accessToken),
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

  const inspectionItems = inspectionsQuery.data?.items ?? [];
  const reportItems = reportsQuery.data ?? [];
  const findingItems = findingsQuery.data?.items ?? [];
  const pendingInspections = inspectionItems.filter((item) => item.status === "queued" || item.status === "processing").length;
  const pendingReports = reportItems.filter((item) => item.status === "queued" || item.status === "processing").length;
  const openFindings = findingItems.filter((item) => item.status === "open" || item.status === "pending").length;
  const closedFindings = findingItems.filter((item) => item.status === "closed").length;

  const recentInspectionColumns: ColumnsType<InspectionRun> = [
    { title: "巡检任务", dataIndex: "name", key: "name" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "对象数量", key: "assets", render: (_, record) => record.asset_scope.length },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", render: formatDateTime },
  ];

  const recentReportColumns: ColumnsType<ReportJob> = [
    { title: "报告类型", dataIndex: "report_type", key: "report_type", render: translateReportType },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "完成时间", dataIndex: "completed_at", key: "completed_at", render: formatDateTime },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="Ops Command"
          title="核心网配置安全合规态势总览"
          description="把值守最关心的运行面、执行面和风险面压缩到同一个工作区里。你先看到的是信号和状态，再往下才是表格和明细。"
          actions={
            <Space size={[8, 8]} wrap>
              <Tag color="cyan">{user?.username ?? "当前用户"}</Tag>
              <Tag color={user?.is_active ? "green" : "red"}>{user?.is_active ? "账号启用" : "账号停用"}</Tag>
            </Space>
          }
          metrics={[
            {
              label: "治理对象",
              value: assetsQuery.data?.total ?? 0,
              hint: "已纳入当前平台的治理对象总量",
              tone: "accent",
            },
            {
              label: "活动巡检",
              value: pendingInspections,
              hint: "排队中与处理中任务",
              tone: pendingInspections > 0 ? "warning" : "default",
            },
            {
              label: "待处置问题",
              value: openFindings,
              hint: "仍需分派、处理或复核的发现项",
              tone: openFindings > 0 ? "warning" : "success",
            },
            {
              label: "报告队列",
              value: pendingReports,
              hint: "仍在生成链路中的报告任务",
            },
          ]}
        />
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={15}>
          <section style={panelStyle(mode)}>
            <SectionTitle
              title="实时指挥盘"
              subtitle="不靠大而空的炫光背景，而是用更清楚的数值和短句把当前值守态势说透。"
            />
            <div className="shell-telemetry-grid">
              <div className="shell-telemetry-card">
                <h4>值守脉冲</h4>
                <div className="shell-data-stack">
                  <div className="shell-data-strip">
                    <span>解析对象总量</span>
                    <strong>{assetsQuery.data?.total ?? 0}</strong>
                  </div>
                  <div className="shell-data-strip">
                    <span>在途巡检任务</span>
                    <strong>{pendingInspections}</strong>
                  </div>
                  <div className="shell-data-strip">
                    <span>待生成报告</span>
                    <strong>{pendingReports}</strong>
                  </div>
                  <div className="shell-data-strip">
                    <span>已闭环问题</span>
                    <strong>{closedFindings}</strong>
                  </div>
                </div>
              </div>

              <div className="shell-telemetry-card">
                <h4>执行链路</h4>
                <div className="shell-signal-list">
                  <div className="shell-signal-item">
                    <span className="shell-live-dot" />
                    <div>
                      <strong>配置采集与解析</strong>
                      <span>前台上传后写入 backend 元数据，再由 data-service 领取任务并回写标准化结果。</span>
                    </div>
                  </div>
                  <div className="shell-signal-item">
                    <span className="shell-live-dot" />
                    <div>
                      <strong>规则执行与问题回写</strong>
                      <span>巡检任务进入 worker 后执行规则集，命中结果与发现项回写到统一查询面。</span>
                    </div>
                  </div>
                  <div className="shell-signal-item">
                    <span className="shell-live-dot" />
                    <div>
                      <strong>报告与 AI 草稿</strong>
                      <span>报告产物与 AI 摘要都由服务侧生成，前台只展示状态、内容和人工复核入口。</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Col>

        <Col xs={24} xl={9}>
          <section style={panelStyle(mode)}>
            <SectionTitle
              title="系统边界"
              subtitle="科技风只负责让工作台更有秩序感，不改变三域职责边界。"
            />
            {summaryQuery.isLoading ? (
              <LoadingBlock label="正在加载系统摘要" />
            ) : summaryQuery.error ? (
              <QueryErrorNotice error={summaryQuery.error} />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Alert type="success" showIcon message="Frontend" description={summaryQuery.data?.frontend_boundary} />
                <Alert type="info" showIcon message="Backend" description={summaryQuery.data?.backend_boundary} />
                <Alert type="warning" showIcon message="Data-Service" description={summaryQuery.data?.data_service_boundary} />
                <div>
                  <Typography.Text strong>公开资源</Typography.Text>
                  <div style={{ marginTop: 12 }}>
                    <Space size={[8, 8]} wrap>
                      {(summaryQuery.data?.public_resources ?? []).map((item) => (
                        <Tag key={item}>{translateResourceType(item)}</Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              </Space>
            )}
          </section>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={14}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="最近巡检" subtitle="优先盯住仍在运行或刚结束的任务，及时接住状态回写与问题分派。" />
            {inspectionsQuery.isLoading ? (
              <LoadingBlock label="正在加载巡检记录" />
            ) : inspectionsQuery.error ? (
              <QueryErrorNotice error={inspectionsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={recentInspectionColumns}
                dataSource={inspectionItems}
                pagination={false}
                size="small"
              />
            )}
          </section>
        </Col>

        <Col xs={24} xl={10}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="报告队列" subtitle="报告生成仍由 data-service 完成，这里专注于看状态和拿产物。" />
            {reportsQuery.isLoading ? (
              <LoadingBlock label="正在加载报告任务" />
            ) : reportsQuery.error ? (
              <QueryErrorNotice error={reportsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={recentReportColumns}
                dataSource={reportItems}
                pagination={false}
                size="small"
              />
            )}
          </section>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={10}>
          <section style={panelStyle(mode)}>
            <SectionTitle
              title="值守透视"
              subtitle="把值班同学最可能需要抬头确认的关键统计放到最后一屏，减少来回切换。"
            />
            <KeyValueList
              items={[
                { label: "发现项总量", value: findingsQuery.data?.total ?? 0 },
                { label: "待处置问题", value: openFindings },
                { label: "已关闭问题", value: closedFindings },
                { label: "最近巡检更新时间", value: formatDateTime(inspectionItems[0]?.updated_at) },
                { label: "最近报告完成时间", value: formatDateTime(reportItems[0]?.completed_at) },
              ]}
            />
          </section>
        </Col>

        <Col xs={24} xl={14}>
          <section style={panelStyle(mode)}>
            <SectionTitle
              title="当前值守提示"
              subtitle="这里不讲空泛口号，只保留和操作决策直接有关的短提示。"
            />
            <div className="shell-signal-list">
              <div className="shell-signal-item">
                <span className="shell-live-dot" />
                <div>
                  <strong>优先处理仍在运行的巡检任务</strong>
                  <span>当前共有 {pendingInspections} 个任务处于排队或处理中，建议先确认输入对象和规则集是否符合预期。</span>
                </div>
              </div>
              <div className="shell-signal-item">
                <span className="shell-live-dot" />
                <div>
                  <strong>问题闭环压力集中在待处置项</strong>
                  <span>当前共有 {openFindings} 个问题尚未关闭，适合从闭环处置页继续建单、推进和复核。</span>
                </div>
              </div>
              <div className="shell-signal-item">
                <span className="shell-live-dot" />
                <div>
                  <strong>所有 AI 草稿都保持人工确认</strong>
                  <span>即使摘要已经生成，也不会直接作为正式结论发布，流程上仍然要求人工复核。</span>
                </div>
              </div>
            </div>
          </section>
        </Col>
      </Row>
    </Space>
  );
}
