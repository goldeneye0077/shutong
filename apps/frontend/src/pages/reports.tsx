import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "antd/es/button";
import Col from "antd/es/col";
import Form from "antd/es/form";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import Row from "antd/es/row";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import type { ColumnsType } from "antd/es/table";
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
import { createReport, downloadReportArtifact, listReportAiSummaries, listReportArtifacts, listReports } from "../services/api";
import type { ReportArtifact, ReportJob } from "../types/api";
import type { ThemeMode } from "../theme/theme";

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

export function ReportsPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [reportForm] = Form.useForm<{ report_type: string }>();
  const [messageApi, contextHolder] = message.useMessage();
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

  const createReportMutation = useMutation({
    mutationFn: (reportType: string) => createReport(accessToken!, { report_type: reportType }),
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

  const reportColumns: ColumnsType<ReportJob> = [
    { title: "报告类型", dataIndex: "report_type", key: "report_type", render: translateReportType },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "完成时间", dataIndex: "completed_at", key: "completed_at", render: formatDateTime },
  ];

  const artifactColumns: ColumnsType<ReportArtifact> = [
    { title: "产物类型", dataIndex: "artifact_type", key: "artifact_type", render: translateArtifactType },
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
  const selectedReport = reportItems.find((item) => item.id === selectedReportId) ?? null;
  const activeReports = reportItems.filter((item) => item.status === "queued" || item.status === "processing").length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {contextHolder}

      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="Reports"
          title="报告中心"
          description="把报告发起、产物下载和 AI 草稿归纳集中到一个面板里，保持一眼就能判断任务是否完成、产物是否可用。"
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
              label: "AI 草稿",
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
            <SectionTitle title="报告任务" subtitle="选择一个任务后，右侧会同步展示当前报告的产物与草稿摘要。" />
            {reportsQuery.isLoading ? (
              <LoadingBlock label="正在加载报告任务" />
            ) : reportsQuery.error ? (
              <QueryErrorNotice error={reportsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={reportColumns}
                dataSource={reportItems}
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
            <SectionTitle title="当前任务摘要" subtitle="把当前选中报告的关键状态压缩到一列里，便于判断是否可对外使用。" />
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
            <SectionTitle title="报告产物" subtitle="产物由 data-service 生成，文件下载统一经过 backend 授权与审计。" />
            {artifactsQuery.isLoading ? (
              <LoadingBlock label="正在加载报告产物" />
            ) : artifactsQuery.error ? (
              <QueryErrorNotice error={artifactsQuery.error} />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Table rowKey="id" columns={artifactColumns} dataSource={artifactItems} pagination={false} size="small" />
                {artifactItems[0] ? <JsonBlock value={artifactItems[0].artifact_metadata} /> : null}
              </Space>
            )}
          </section>
        </Col>
        <Col xs={24} xl={9}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="AI 报告草稿" subtitle="即使报告已经完成，AI 摘要仍保持人工复核前置，不直接当作正式结论。" />
            {aiQuery.isLoading ? (
              <LoadingBlock label="正在加载 AI 草稿" />
            ) : aiQuery.error ? (
              <QueryErrorNotice error={aiQuery.error} />
            ) : (
              <DraftSummaries jobs={aiQuery.data} />
            )}
          </section>
        </Col>
      </Row>

      <Modal
        open={isReportModalOpen}
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
          initialValues={{ report_type: "inspection_summary" }}
          onFinish={(values) => {
            createReportMutation.mutate(values.report_type);
          }}
        >
          <Form.Item name="report_type" label="报告类型" rules={[{ required: true, message: "请选择报告类型" }]}>
            <Select
              options={[
                { label: "巡检摘要", value: "inspection_summary" },
                { label: "问题摘要", value: "finding_digest" },
                { label: "审计快照", value: "audit_snapshot" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
