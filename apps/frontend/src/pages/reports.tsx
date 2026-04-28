import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Grid,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import { useAuth } from "../app/auth";
import { getActiveRefetchInterval } from "../app/polling";
import {
  DraftSummaries,
  JsonBlock,
  KeyValueList,
  LoadingBlock,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  StatusTag,
  Toolbar,
  formatDateTime,
  panelStyle,
  translateArtifactType,
  translateReportType,
} from "../app/ui";
import {
  createReport,
  downloadReportArtifact,
  listReportAiSummaries,
  listReportArtifacts,
  listReports,
  listReportTemplates,
} from "../services/api";
import type { ReportArtifact, ReportJob, ReportTemplate } from "../types/api";
import type { ThemeMode } from "../theme/theme";

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

const { Row, Col } = Grid;
const TextArea = Input.TextArea;

interface ReportFormValues {
  report_type: string;
  template_id?: string;
  parameters: string;
}

function parseJsonObject(value: string, fallback: Record<string, unknown> = {}) {
  if (!value.trim()) {
    return fallback;
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("请输入 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

function getArtifactDisplayName(record: ReportArtifact) {
  const label = record.artifact_metadata.artifact_label;
  return typeof label === "string" && label ? label : translateArtifactType(record.artifact_type);
}

export function ReportsPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [reportForm] = Form.useForm<ReportFormValues>();
  const messageApi = Message;
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);

  const reportsQuery = useQuery({
    queryKey: ["reports", accessToken, "reports-page"],
    queryFn: () => listReports(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: (query) =>
      getActiveRefetchInterval((((query.state.data as ReportJob[] | undefined) ?? []).map((item) => item.status))),
  });

  React.useEffect(() => {
    const firstReportId = reportsQuery.data?.[0]?.id ?? null;
    if (!selectedReportId || !reportsQuery.data?.some((item) => item.id === selectedReportId)) {
      setSelectedReportId(firstReportId);
    }
  }, [reportsQuery.data, selectedReportId]);

  const selectedReportStatus = reportsQuery.data?.find((item) => item.id === selectedReportId)?.status;

  const artifactsQuery = useQuery({
    queryKey: ["report-artifacts", accessToken, selectedReportId],
    queryFn: () => listReportArtifacts(accessToken!, selectedReportId!),
    enabled: Boolean(accessToken && selectedReportId),
    refetchInterval: getActiveRefetchInterval([selectedReportStatus]),
  });
  const aiQuery = useQuery({
    queryKey: ["report-ai", accessToken, selectedReportId],
    queryFn: () => listReportAiSummaries(accessToken!, selectedReportId!),
    enabled: Boolean(accessToken && selectedReportId),
    refetchInterval: getActiveRefetchInterval([selectedReportStatus]),
  });
  const templatesQuery = useQuery({
    queryKey: ["report-templates", accessToken, "reports-page"],
    queryFn: () => listReportTemplates(accessToken!),
    enabled: Boolean(accessToken),
  });

  const createReportMutation = useMutation({
    mutationFn: (values: ReportFormValues) =>
      createReport(accessToken!, {
        report_type: values.report_type,
        template_id: values.template_id || null,
        parameters: parseJsonObject(values.parameters, {}),
      }),
    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["report-artifacts"] }),
        queryClient.invalidateQueries({ queryKey: ["report-ai"] }),
      ]);
      setSelectedReportId(report.id);
      setIsReportModalOpen(false);
      reportForm.resetFields();
      messageApi.success("报告任务已入队。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "报告任务创建失败。");
    },
  });

  const reportColumns: TableColumnProps<ReportJob>[] = [
    { title: "报告类型", dataIndex: "report_type", key: "report_type", render: translateReportType },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "完成时间", dataIndex: "completed_at", key: "completed_at", render: formatDateTime },
  ];

  const artifactColumns: TableColumnProps<ReportArtifact>[] = [
    { title: "产物", key: "artifact_type", render: (_, record) => getArtifactDisplayName(record) },
    {
      title: "服务端路径",
      dataIndex: "file_path",
      key: "file_path",
      render: (value) => <Typography.Text copyable={{ text: value }}>{value}</Typography.Text>,
    },
    { title: "生成时间", dataIndex: "created_at", key: "created_at", render: formatDateTime },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Button
          size="small"
          onClick={async () => {
            if (!accessToken || !selectedReportId) {
              return;
            }
            const { blob, filename } = await downloadReportArtifact(accessToken, selectedReportId, record.id);
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            window.URL.revokeObjectURL(url);
          }}
        >
          下载
        </Button>
      ),
    },
  ];

  const reportItems = reportsQuery.data ?? [];
  const artifactItems = artifactsQuery.data ?? [];
  const activeTemplates = (templatesQuery.data ?? []).filter((item: ReportTemplate) => item.status === "active");
  const selectedReport = reportItems.find((item) => item.id === selectedReportId) ?? null;
  const activeReports = reportItems.filter((item) => item.status === "queued" || item.status === "processing").length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="报告中心"
          title="报告中心"
          description="发起报告、查看产物、下载文件和复核智能草稿。"
          actions={
            <Space size={[8, 8]} wrap>
              {selectedReport ? <Tag color="blue">{translateReportType(selectedReport.report_type)}</Tag> : null}
              {selectedReport ? <StatusTag value={selectedReport.status} /> : null}
            </Space>
          }
          metrics={[
            {
              label: "报告任务",
              value: reportItems.length,
              hint: "当前工作台已生成或在途的报告数",
              tone: "accent",
            },
            {
              label: "在途报告",
              value: activeReports,
              hint: "仍在排队或生成中的任务",
              tone: activeReports > 0 ? "warning" : "success",
            },
            {
              label: "报告产物",
              value: artifactItems.length,
              hint: "当前选中报告的可下载产物数",
            },
            {
              label: "智能草稿",
              value: aiQuery.data?.length ?? 0,
              hint: "待人工复核的摘要草稿",
            },
          ]}
        />
      </section>

      <section style={panelStyle(mode)}>
        <Toolbar
          left={
            <Button type="primary" onClick={() => setIsReportModalOpen(true)}>
              生成报告
            </Button>
          }
          right={
            selectedReport ? (
              <Typography.Text type="secondary">最新完成时间：{formatDateTime(selectedReport.completed_at)}</Typography.Text>
            ) : null
          }
        />
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={15}>
            <SectionTitle title="报告任务" subtitle="选择任务后查看产物和草稿摘要。" />
            {reportsQuery.isLoading ? (
              <LoadingBlock label="正在加载报告任务" />
            ) : reportsQuery.error ? (
              <QueryErrorNotice error={reportsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={reportColumns}
                data={reportItems}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedReportId(record.id),
                  style: selectedRowStyle(record.id === selectedReportId),
                })}
              />
            )}
          </Col>
          <Col xs={24} xl={9}>
            <SectionTitle title="当前任务摘要" subtitle="快速判断任务状态和产物可用性。" />
            <KeyValueList
              items={[
                { label: "报告类型", value: translateReportType(selectedReport?.report_type) },
                { label: "任务状态", value: selectedReport ? <StatusTag value={selectedReport.status} /> : "-" },
                { label: "完成时间", value: formatDateTime(selectedReport?.completed_at) },
                { label: "产物数量", value: artifactItems.length },
              ]}
            />
          </Col>
        </Row>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={15}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="报告产物" subtitle="下载由后端授权并记录审计。" />
            {artifactsQuery.isLoading ? (
              <LoadingBlock label="正在加载报告产物" />
            ) : artifactsQuery.error ? (
              <QueryErrorNotice error={artifactsQuery.error} />
            ) : (
              <Space direction="vertical" size="medium" style={{ width: "100%" }}>
                <Table rowKey="id" columns={artifactColumns} data={artifactItems} pagination={false} size="small" />
                {artifactItems[0] ? <JsonBlock value={artifactItems[0].artifact_metadata} /> : null}
              </Space>
            )}
          </section>
        </Col>
        <Col xs={24} xl={9}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="智能报告草稿" subtitle="辅助摘要需人工确认后使用。" />
            {aiQuery.isLoading ? (
              <LoadingBlock label="正在加载智能草稿" />
            ) : aiQuery.error ? (
              <QueryErrorNotice error={aiQuery.error} />
            ) : (
              <DraftSummaries jobs={aiQuery.data} />
            )}
          </section>
        </Col>
      </Row>

      <Modal
        visible={isReportModalOpen}
        title="生成报告"
        okText="加入队列"
        confirmLoading={createReportMutation.isPending}
        onCancel={() => {
          setIsReportModalOpen(false);
          reportForm.resetFields();
        }}
        onOk={() => {
          void reportForm.submit();
        }}
      >
        <Form
          form={reportForm}
          layout="vertical"
          initialValues={{
            report_type: "inspection_summary",
            parameters: JSON.stringify(
              { finding_list_limit: 100, include_closed_findings: true, package_include_evidence_manifest: true },
              null,
              2,
            ),
          }}
          onSubmit={(values) => {
            createReportMutation.mutate(values);
          }}
        >
          <Form.Item field="report_type" label="报告类型" rules={[{ required: true, message: "请选择报告类型" }]}>
            <Select
              options={[
                { label: "巡检摘要", value: "inspection_summary" },
                { label: "问题摘要", value: "finding_digest" },
                { label: "审计快照", value: "audit_snapshot" },
                { label: "迎检资料包", value: "inspection_package" },
              ]}
            />
          </Form.Item>
          <Form.Item field="template_id" label="报告模板">
            <Select
              allowClear
              loading={templatesQuery.isLoading}
              placeholder="不选则使用该类型最新启用模板"
              options={activeTemplates.map((template) => ({
                label: `${translateReportType(template.template_type)} / ${template.name} / ${template.version}`,
                value: template.id,
              }))}
            />
          </Form.Item>
          <Form.Item field="parameters" label="生成参数 JSON" rules={[{ required: true, message: "请输入生成参数 JSON" }]}>
            <TextArea autoSize={{ minRows: 5, maxRows: 9 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
