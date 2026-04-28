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
  Typography,
} from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import { useAuth } from "../app/auth";
import {
  LoadingBlock,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  SeverityTag,
  StatusTag,
  Toolbar,
  formatDateTime,
  panelStyle,
  translateResourceType,
} from "../app/ui";
import {
  approveException,
  approveTicketReview,
  createTicketReminder,
  createException,
  createTicket,
  downloadTicketAttachment,
  listExceptions,
  listFindingLogClues,
  listFindings,
  listProblemTopics,
  listTicketAttachments,
  listTicketLogClues,
  listTicketReminders,
  listTickets,
  rejectException,
  rejectTicketReview,
  submitTicketReview,
  updateTicket,
  uploadTicketAttachment,
} from "../services/api";
import type {
  ExceptionCreatePayload,
  ExceptionRequest,
  Finding,
  LogClue,
  ProblemTopicFilters,
  ProblemTopicItem,
  Ticket,
  TicketAttachment,
  TicketCreatePayload,
  TicketReminder,
  TicketReminderCreatePayload,
  TicketUpdatePayload,
} from "../types/api";
import type { ThemeMode } from "../theme/theme";

function toIsoDateTime(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

const { Row, Col } = Grid;

export function WorkflowPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [ticketForm] = Form.useForm<TicketCreatePayload & { dueAtInput?: string }>();
  const [ticketUpdateForm] = Form.useForm<TicketUpdatePayload & { dueAtInput?: string }>();
  const [exceptionForm] = Form.useForm<ExceptionCreatePayload & { expiresAtInput?: string }>();
  const [reminderForm] = Form.useForm<TicketReminderCreatePayload>();
  const [topicForm] = Form.useForm<ProblemTopicFilters>();
  const messageApi = Message;
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState(false);
  const [isTicketUpdateModalOpen, setIsTicketUpdateModalOpen] = React.useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = React.useState(false);
  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null);
  const [topicFilters, setTopicFilters] = React.useState<ProblemTopicFilters>({});

  const ticketsQuery = useQuery({
    queryKey: ["tickets", accessToken],
    queryFn: () => listTickets(accessToken!),
    enabled: Boolean(accessToken),
  });
  const exceptionsQuery = useQuery({
    queryKey: ["exceptions", accessToken],
    queryFn: () => listExceptions(accessToken!),
    enabled: Boolean(accessToken),
  });
  const findingsQuery = useQuery({
    queryKey: ["findings", accessToken, "workflow"],
    queryFn: () => listFindings(accessToken!),
    enabled: Boolean(accessToken),
  });
  const problemTopicsQuery = useQuery({
    queryKey: ["problem-topics", accessToken, topicFilters],
    queryFn: () => listProblemTopics(accessToken!, topicFilters),
    enabled: Boolean(accessToken),
  });
  const findingLogCluesQuery = useQuery({
    queryKey: ["finding-log-clues", accessToken, selectedFindingId],
    queryFn: () => listFindingLogClues(accessToken!, selectedFindingId!),
    enabled: Boolean(accessToken && selectedFindingId),
  });
  const attachmentsQuery = useQuery({
    queryKey: ["ticket-attachments", accessToken, selectedTicketId],
    queryFn: () => listTicketAttachments(accessToken!, selectedTicketId!),
    enabled: Boolean(accessToken && selectedTicketId),
  });
  const remindersQuery = useQuery({
    queryKey: ["ticket-reminders", accessToken, selectedTicketId],
    queryFn: () => listTicketReminders(accessToken!, selectedTicketId!),
    enabled: Boolean(accessToken && selectedTicketId),
  });
  const ticketLogCluesQuery = useQuery({
    queryKey: ["ticket-log-clues", accessToken, selectedTicketId],
    queryFn: () => listTicketLogClues(accessToken!, selectedTicketId!),
    enabled: Boolean(accessToken && selectedTicketId),
  });

  React.useEffect(() => {
    const firstTicketId = ticketsQuery.data?.[0]?.id ?? null;
    if (!selectedTicketId || !ticketsQuery.data?.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(firstTicketId);
    }
  }, [selectedTicketId, ticketsQuery.data]);

  const createTicketMutation = useMutation({
    mutationFn: (payload: TicketCreatePayload) => createTicket(accessToken!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      setIsTicketModalOpen(false);
      ticketForm.resetFields();
      messageApi.success("整改工单已创建。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "整改工单创建失败。");
    },
  });

  const createExceptionMutation = useMutation({
    mutationFn: (payload: ExceptionCreatePayload) => createException(accessToken!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exceptions"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      setIsExceptionModalOpen(false);
      exceptionForm.resetFields();
      messageApi.success("例外申请已创建。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "例外申请创建失败。");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (exceptionId: string) => approveException(accessToken!, exceptionId, "前端闭环页审批通过。"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exceptions"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      messageApi.success("例外申请已批准。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "例外申请批准失败。");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (exceptionId: string) => rejectException(accessToken!, exceptionId, "前端闭环页审批驳回。"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      messageApi.success("例外申请已驳回。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "例外申请驳回失败。");
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: (payload: TicketUpdatePayload) => updateTicket(accessToken!, selectedTicketId!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      setIsTicketUpdateModalOpen(false);
      ticketUpdateForm.resetFields();
      messageApi.success("工单已更新。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "工单更新失败。");
    },
  });

  const submitTicketReviewMutation = useMutation({
    mutationFn: (ticket: Ticket) =>
      submitTicketReview(accessToken!, ticket.id, {
        resolution_note: ticket.resolution_note || "整改已完成，提交复核。",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      messageApi.success("工单已提交复核。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "提交复核失败。");
    },
  });

  const approveTicketReviewMutation = useMutation({
    mutationFn: (ticketId: string) => approveTicketReview(accessToken!, ticketId, "复核通过，允许销项。"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      messageApi.success("工单复核已通过。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "工单复核通过失败。");
    },
  });

  const rejectTicketReviewMutation = useMutation({
    mutationFn: (ticketId: string) => rejectTicketReview(accessToken!, ticketId, "复核驳回，请补充整改证据。"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
      ]);
      messageApi.success("工单复核已驳回。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "工单复核驳回失败。");
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (payload: { ticketId: string; file: File }) =>
      uploadTicketAttachment(accessToken!, payload.ticketId, payload.file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-attachments"] });
      setAttachmentFile(null);
      messageApi.success("工单附件已上传。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "工单附件上传失败。");
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: (payload: TicketReminderCreatePayload) => createTicketReminder(accessToken!, selectedTicketId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-reminders"] });
      reminderForm.resetFields();
      messageApi.success("催办记录已创建。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "催办记录创建失败。");
    },
  });

  const handleDownloadAttachment = async (attachment: TicketAttachment) => {
    if (!accessToken || !selectedTicketId) {
      return;
    }
    try {
      const { blob, filename } = await downloadTicketAttachment(accessToken, selectedTicketId, attachment.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "工单附件下载失败。");
    }
  };

  const findingColumns: TableColumnProps<Finding>[] = [
    { title: "问题标题", dataIndex: "title", key: "title" },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", render: formatDateTime },
  ];

  const ticketColumns: TableColumnProps<Ticket>[] = [
    { title: "工单号", dataIndex: "id", key: "id", render: (value) => <Typography.Text code>{value.slice(0, 8)}</Typography.Text> },
    { title: "处理人", dataIndex: "assignee", key: "assignee" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "复核", key: "review_status", render: (_, record) => <StatusTag value={record.review_status} /> },
    { title: "截止时间", dataIndex: "due_at", key: "due_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            size="mini"
            disabled={record.status === "closed" || record.status === "pending_review"}
            loading={submitTicketReviewMutation.isPending}
            onClick={() => submitTicketReviewMutation.mutate(record)}
          >
            提交复核
          </Button>
          <Button
            size="mini"
            type="primary"
            disabled={record.status !== "pending_review"}
            loading={approveTicketReviewMutation.isPending}
            onClick={() => approveTicketReviewMutation.mutate(record.id)}
          >
            通过
          </Button>
          <Button
            size="mini"
            status="danger"
            disabled={record.status !== "pending_review"}
            loading={rejectTicketReviewMutation.isPending}
            onClick={() => rejectTicketReviewMutation.mutate(record.id)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const exceptionColumns: TableColumnProps<ExceptionRequest>[] = [
    { title: "例外单", dataIndex: "id", key: "id", render: (value) => <Typography.Text code>{value.slice(0, 8)}</Typography.Text> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "到期时间", dataIndex: "expires_at", key: "expires_at", render: formatDateTime },
    { title: "审批意见", dataIndex: "review_comment", key: "review_comment" },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            disabled={record.status !== "pending"}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate(record.id)}
          >
            批准
          </Button>
          <Button
            size="small"
            status="danger"
            disabled={record.status !== "pending"}
            loading={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate(record.id)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const attachmentColumns: TableColumnProps<TicketAttachment>[] = [
    { title: "文件名", dataIndex: "filename", key: "filename" },
    {
      title: "大小",
      dataIndex: "size_bytes",
      key: "size_bytes",
      render: (value) => `${Math.max(1, Math.ceil(Number(value) / 1024))} KB`,
    },
    { title: "上传时间", dataIndex: "created_at", key: "created_at", render: formatDateTime },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Button size="mini" type="primary" onClick={() => void handleDownloadAttachment(record)}>
          下载
        </Button>
      ),
    },
  ];

  const reminderColumns: TableColumnProps<TicketReminder>[] = [
    { title: "催办对象", dataIndex: "reminded_to", key: "reminded_to", render: (value) => value || "-" },
    { title: "催办内容", dataIndex: "message", key: "message" },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", render: formatDateTime },
  ];

  const topicColumns: TableColumnProps<ProblemTopicItem>[] = [
    { title: "问题", dataIndex: "title", key: "title" },
    { title: "对象", dataIndex: "asset_name", key: "asset_name", render: (value) => value || "-" },
    { title: "对象类型", dataIndex: "asset_type", key: "asset_type", render: (value) => value || "-" },
    { title: "责任单位", dataIndex: "owner", key: "owner", render: (value) => value || "-" },
    { title: "规则", dataIndex: "rule_name", key: "rule_name", render: (value) => value || "-" },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "工单", dataIndex: "ticket_id", key: "ticket_id", render: (value) => (value ? <Typography.Text code>{value.slice(0, 8)}</Typography.Text> : "-") },
    { title: "日志线索", dataIndex: "log_clue_count", key: "log_clue_count" },
    { title: "最近日志", dataIndex: "latest_log_time", key: "latest_log_time", render: formatDateTime },
  ];

  const logClueColumns: TableColumnProps<LogClue>[] = [
    { title: "来源", dataIndex: "source", key: "source", width: 120 },
    { title: "等级", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "关联对象", dataIndex: "resource_type", key: "resource_type", render: translateResourceType },
    { title: "关键词", dataIndex: "keyword", key: "keyword" },
    { title: "说明", dataIndex: "message", key: "message" },
    { title: "日志时间", dataIndex: "event_time", key: "event_time", render: formatDateTime },
  ];

  const selectedTicket = ticketsQuery.data?.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const pendingExceptions = (exceptionsQuery.data ?? []).filter((item) => item.status === "pending").length;

  React.useEffect(() => {
    if (selectedTicket?.finding_id && selectedTicket.finding_id !== selectedFindingId) {
      setSelectedFindingId(selectedTicket.finding_id);
    }
  }, [selectedFindingId, selectedTicket?.finding_id]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="闭环处置"
          title="闭环处置"
          description="处理发现、工单、例外申请和审批结果。"
          metrics={[
            {
              label: "整改工单",
              value: ticketsQuery.data?.length ?? 0,
              hint: "当前已生成的处置工单",
              tone: "accent",
            },
            {
              label: "待审例外",
              value: pendingExceptions,
              hint: "仍待审批的例外申请",
              tone: pendingExceptions > 0 ? "warning" : "success",
            },
            {
              label: "已跟踪问题",
              value: findingsQuery.data?.total ?? 0,
              hint: "已进入闭环视图的问题总量",
            },
            {
              label: "当前选中工单",
              value: selectedTicket ? selectedTicket.id.slice(0, 8) : "-",
              hint: selectedTicket ? selectedTicket.assignee : "尚未选中工单",
            },
          ]}
        />
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="问题专题视图" subtitle="按规则、对象类型、责任单位、状态和风险等级筛选问题，并查看日志线索覆盖情况。" />
        <Form
          form={topicForm}
          layout="vertical"
          onSubmit={(values) => {
            const nextFilters: ProblemTopicFilters = {};
            if (values.rule_set_id?.trim()) {
              nextFilters.rule_set_id = values.rule_set_id.trim();
            }
            if (values.asset_type) {
              nextFilters.asset_type = values.asset_type;
            }
            if (values.owner?.trim()) {
              nextFilters.owner = values.owner.trim();
            }
            if (values.status) {
              nextFilters.status = values.status;
            }
            if (values.severity) {
              nextFilters.severity = values.severity;
            }
            setTopicFilters(nextFilters);
          }}
        >
          <Row gutter={[12, 0]}>
            <Col xs={24} md={6} xl={5}>
              <Form.Item field="rule_set_id" label="规则 ID">
                <Input placeholder="可粘贴规则 ID" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} xl={4}>
              <Form.Item field="asset_type" label="对象类型">
                <Select
                  allowClear
                  options={[
                    { label: "CSW", value: "CSW" },
                    { label: "BSW", value: "BSW" },
                    { label: "OMSW", value: "OMSW" },
                    { label: "OMFW", value: "OMFW" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} xl={5}>
              <Form.Item field="owner" label="责任单位">
                <Input placeholder="如 ops-team" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} xl={4}>
              <Form.Item field="severity" label="风险等级">
                <Select
                  allowClear
                  options={[
                    { label: "严重", value: "critical" },
                    { label: "高", value: "high" },
                    { label: "中", value: "medium" },
                    { label: "低", value: "low" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} xl={4}>
              <Form.Item field="status" label="问题状态">
                <Select
                  allowClear
                  options={[
                    { label: "待处理", value: "open" },
                    { label: "已建工单", value: "ticketed" },
                    { label: "待复核", value: "remediation_submitted" },
                    { label: "已关闭", value: "closed" },
                    { label: "例外已批准", value: "exception_approved" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={2}>
              <Form.Item label="操作">
                <Space>
                  <Button type="primary" htmlType="submit">
                    筛选
                  </Button>
                  <Button
                    onClick={() => {
                      topicForm.resetFields();
                      setTopicFilters({});
                    }}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Table
          rowKey="finding_id"
          columns={topicColumns}
          data={problemTopicsQuery.data?.items ?? []}
          loading={problemTopicsQuery.isLoading}
          pagination={false}
          size="small"
          onRow={(record) => ({
            onClick: () => {
              setSelectedFindingId(record.finding_id);
              setSelectedTicketId(record.ticket_id);
            },
            style: selectedRowStyle(record.finding_id === selectedFindingId),
          })}
        />
        {problemTopicsQuery.error ? <QueryErrorNotice error={problemTopicsQuery.error} /> : null}
      </section>

      <section style={panelStyle(mode)}>
        <Toolbar
          left={
            <>
              <Button type="primary" disabled={!selectedFindingId} onClick={() => setIsTicketModalOpen(true)}>
                创建工单
              </Button>
              <Button
                disabled={!selectedTicket}
                onClick={() => {
                  if (!selectedTicket) {
                    return;
                  }
                  ticketUpdateForm.setFieldsValue({
                    assignee: selectedTicket.assignee,
                    status: selectedTicket.status,
                    dueAtInput: selectedTicket.due_at ? selectedTicket.due_at.slice(0, 16) : undefined,
                    resolution_note: selectedTicket.resolution_note,
                  });
                  setIsTicketUpdateModalOpen(true);
                }}
              >
                更新工单
              </Button>
              <Button type="outline" disabled={!selectedTicketId} onClick={() => setIsExceptionModalOpen(true)}>
                创建例外
              </Button>
            </>
          }
          right={
            <>
              {selectedFindingId ? <Typography.Text type="secondary">已选问题：{selectedFindingId.slice(0, 8)}</Typography.Text> : null}
              {selectedTicket ? <StatusTag value={selectedTicket.status} /> : null}
            </>
          }
        />
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={10}>
            <SectionTitle title="问题列表" subtitle="选择问题后创建或补充工单。" />
            {findingsQuery.isLoading ? (
              <LoadingBlock label="正在加载问题列表" />
            ) : findingsQuery.error ? (
              <QueryErrorNotice error={findingsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={findingColumns}
                data={findingsQuery.data?.items ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedFindingId(record.id);
                    setSelectedTicketId(ticketsQuery.data?.find((ticket) => ticket.finding_id === record.id)?.id ?? null);
                  },
                  style: selectedRowStyle(record.id === selectedFindingId),
                })}
              />
            )}
          </Col>
          <Col xs={24} xl={14}>
            <SectionTitle title="工单列表" subtitle="更新处置状态，必要时发起例外申请。" />
            {ticketsQuery.isLoading ? (
              <LoadingBlock label="正在加载工单" />
            ) : ticketsQuery.error ? (
              <QueryErrorNotice error={ticketsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={ticketColumns}
                data={ticketsQuery.data ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedTicketId(record.id),
                  style: selectedRowStyle(record.id === selectedTicketId),
                })}
              />
            )}
          </Col>
        </Row>
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="日志证据链" subtitle="按当前选中的问题和工单回溯关联日志线索，包含问题、工单和对象级日志。" />
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={12}>
            <Toolbar
              left={<Typography.Text style={{ fontWeight: 700 }}>当前问题线索</Typography.Text>}
              right={
                selectedFindingId ? (
                  <Typography.Text type="secondary">{selectedFindingId.slice(0, 8)}</Typography.Text>
                ) : null
              }
            />
            {selectedFindingId ? (
              <Table
                rowKey="id"
                columns={logClueColumns}
                data={findingLogCluesQuery.data ?? []}
                loading={findingLogCluesQuery.isLoading}
                pagination={false}
                size="small"
              />
            ) : (
              <Typography.Text type="secondary">请先选择一个问题。</Typography.Text>
            )}
          </Col>
          <Col xs={24} xl={12}>
            <Toolbar
              left={<Typography.Text style={{ fontWeight: 700 }}>当前工单线索</Typography.Text>}
              right={
                selectedTicketId ? (
                  <Typography.Text type="secondary">{selectedTicketId.slice(0, 8)}</Typography.Text>
                ) : null
              }
            />
            {selectedTicketId ? (
              <Table
                rowKey="id"
                columns={logClueColumns}
                data={ticketLogCluesQuery.data ?? []}
                loading={ticketLogCluesQuery.isLoading}
                pagination={false}
                size="small"
              />
            ) : (
              <Typography.Text type="secondary">请先选择一张工单。</Typography.Text>
            )}
          </Col>
        </Row>
        {findingLogCluesQuery.error ? <QueryErrorNotice error={findingLogCluesQuery.error} /> : null}
        {ticketLogCluesQuery.error ? <QueryErrorNotice error={ticketLogCluesQuery.error} /> : null}
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="工单详情" subtitle="集中留存处理说明、整改附件和催办记录。" />
        {selectedTicket ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} xl={8}>
                <div className="shell-key-value-list">
                  <div className="shell-key-value-row">
                    <span>工单号</span>
                    <strong>{selectedTicket.id.slice(0, 8)}</strong>
                  </div>
                  <div className="shell-key-value-row">
                    <span>处理人</span>
                    <strong>{selectedTicket.assignee}</strong>
                  </div>
                  <div className="shell-key-value-row">
                    <span>状态</span>
                    <StatusTag value={selectedTicket.status} />
                  </div>
                  <div className="shell-key-value-row">
                    <span>复核状态</span>
                    <StatusTag value={selectedTicket.review_status} />
                  </div>
                  <div className="shell-key-value-row">
                    <span>处理说明</span>
                    <strong>{selectedTicket.resolution_note || "尚未填写"}</strong>
                  </div>
                </div>
              </Col>
              <Col xs={24} xl={16}>
                <Space direction="vertical" size="medium" style={{ width: "100%" }}>
                  <Toolbar
                    left={
                      <>
                        <input
                          className="shell-input"
                          type="file"
                          onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                        />
                        <Button
                          type="primary"
                          disabled={!attachmentFile}
                          loading={uploadAttachmentMutation.isPending}
                          onClick={() => {
                            if (selectedTicketId && attachmentFile) {
                              uploadAttachmentMutation.mutate({ ticketId: selectedTicketId, file: attachmentFile });
                            }
                          }}
                        >
                          上传附件
                        </Button>
                      </>
                    }
                    right={
                      attachmentFile ? (
                        <Typography.Text type="secondary">待上传：{attachmentFile.name}</Typography.Text>
                      ) : null
                    }
                  />
                  <Table
                    rowKey="id"
                    columns={attachmentColumns}
                    data={attachmentsQuery.data ?? []}
                    loading={attachmentsQuery.isLoading}
                    pagination={false}
                    size="small"
                  />
                </Space>
              </Col>
            </Row>

            <Row gutter={[24, 24]}>
              <Col xs={24} xl={8}>
                <Form
                  form={reminderForm}
                  layout="vertical"
                  onSubmit={(values) => {
                    createReminderMutation.mutate({
                      message: values.message,
                      reminded_to: values.reminded_to || selectedTicket.assignee,
                    });
                  }}
                >
                  <Form.Item field="reminded_to" label="催办对象">
                    <Input placeholder={selectedTicket.assignee} />
                  </Form.Item>
                  <Form.Item field="message" label="催办内容" rules={[{ required: true, message: "请输入催办内容" }]}>
                    <Input.TextArea rows={4} placeholder="请补充整改证据或更新处理进度。" />
                  </Form.Item>
                  <Button type="primary" loading={createReminderMutation.isPending} onClick={() => void reminderForm.submit()}>
                    发起催办
                  </Button>
                </Form>
              </Col>
              <Col xs={24} xl={16}>
                <Table
                  rowKey="id"
                  columns={reminderColumns}
                  data={remindersQuery.data ?? []}
                  loading={remindersQuery.isLoading}
                  pagination={false}
                  size="small"
                />
              </Col>
            </Row>
          </Space>
        ) : (
          <Typography.Text type="secondary">请先选择一张工单查看详情。</Typography.Text>
        )}
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="例外申请" subtitle="集中处理待复核、已通过和已驳回记录。" />
        {exceptionsQuery.isLoading ? (
          <LoadingBlock label="正在加载例外申请" />
        ) : exceptionsQuery.error ? (
          <QueryErrorNotice error={exceptionsQuery.error} />
        ) : (
          <Table rowKey="id" columns={exceptionColumns} data={exceptionsQuery.data ?? []} pagination={false} size="small" />
        )}
      </section>

      <Modal
        visible={isTicketModalOpen}
        title="创建整改工单"
        okText="创建"
        confirmLoading={createTicketMutation.isPending}
        onCancel={() => {
          setIsTicketModalOpen(false);
          ticketForm.resetFields();
        }}
        onOk={() => {
          void ticketForm.submit();
        }}
      >
        <Form
          form={ticketForm}
          layout="vertical"
          initialValues={{ assignee: "运维组" }}
          onSubmit={(values) => {
            if (!selectedFindingId) {
              messageApi.warning("请先选择一个问题。");
              return;
            }
            createTicketMutation.mutate({
              finding_id: selectedFindingId,
              assignee: values.assignee,
              due_at: toIsoDateTime(values.dueAtInput),
            });
          }}
        >
          <Form.Item field="assignee" label="处理人" rules={[{ required: true, message: "请输入处理人" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="dueAtInput" label="截止时间">
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isTicketUpdateModalOpen}
        title="更新工单"
        okText="保存"
        confirmLoading={updateTicketMutation.isPending}
        onCancel={() => {
          setIsTicketUpdateModalOpen(false);
          ticketUpdateForm.resetFields();
        }}
        onOk={() => {
          void ticketUpdateForm.submit();
        }}
      >
        <Form
          form={ticketUpdateForm}
          layout="vertical"
          onSubmit={(values) => {
            updateTicketMutation.mutate({
              assignee: values.assignee,
              status: values.status,
              due_at: toIsoDateTime(values.dueAtInput),
              resolution_note: values.resolution_note ?? null,
            });
          }}
        >
          <Form.Item field="assignee" label="处理人" rules={[{ required: true, message: "请输入处理人" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="status" label="状态" rules={[{ required: true, message: "请选择工单状态" }]}>
            <Select
              options={[
                { label: "待处理", value: "open" },
                { label: "处理中", value: "in_progress" },
                { label: "待复核", value: "pending_review" },
                { label: "已关闭", value: "closed" },
                { label: "例外已批准", value: "exception_approved" },
              ]}
            />
          </Form.Item>
          <Form.Item field="dueAtInput" label="截止时间">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item field="resolution_note" label="处理说明">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isExceptionModalOpen}
        title="创建例外申请"
        okText="提交"
        confirmLoading={createExceptionMutation.isPending}
        onCancel={() => {
          setIsExceptionModalOpen(false);
          exceptionForm.resetFields();
        }}
        onOk={() => {
          void exceptionForm.submit();
        }}
      >
        <Form
          form={exceptionForm}
          layout="vertical"
          onSubmit={(values) => {
            const expiresAt = toIsoDateTime(values.expiresAtInput);
            if (!selectedTicketId) {
              messageApi.warning("请先选择一张工单。");
              return;
            }
            if (!expiresAt) {
              messageApi.warning("请输入有效的到期时间。");
              return;
            }
            createExceptionMutation.mutate({
              ticket_id: selectedTicketId,
              reason: values.reason,
              expires_at: expiresAt,
            });
          }}
        >
          <Form.Item field="reason" label="申请原因" rules={[{ required: true, message: "请输入例外原因" }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item field="expiresAtInput" label="到期时间" rules={[{ required: true, message: "请输入到期时间" }]}>
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
