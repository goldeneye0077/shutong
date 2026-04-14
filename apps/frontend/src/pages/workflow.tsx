import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "antd/es/button";
import Col from "antd/es/col";
import Form from "antd/es/form";
import Input from "antd/es/input";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import Row from "antd/es/row";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Typography from "antd/es/typography";
import type { ColumnsType } from "antd/es/table";
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
} from "../app/ui";
import {
  approveException,
  createException,
  createTicket,
  listExceptions,
  listFindings,
  listTickets,
  rejectException,
  updateTicket,
} from "../services/api";
import type { ExceptionCreatePayload, ExceptionRequest, Finding, Ticket, TicketCreatePayload, TicketUpdatePayload } from "../types/api";
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

export function WorkflowPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [ticketForm] = Form.useForm<TicketCreatePayload & { dueAtInput?: string }>();
  const [ticketUpdateForm] = Form.useForm<TicketUpdatePayload & { dueAtInput?: string }>();
  const [exceptionForm] = Form.useForm<ExceptionCreatePayload & { expiresAtInput?: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState(false);
  const [isTicketUpdateModalOpen, setIsTicketUpdateModalOpen] = React.useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = React.useState(false);

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

  const findingColumns: ColumnsType<Finding> = [
    { title: "问题标题", dataIndex: "title", key: "title" },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", render: formatDateTime },
  ];

  const ticketColumns: ColumnsType<Ticket> = [
    { title: "工单号", dataIndex: "id", key: "id", render: (value) => <Typography.Text code>{value.slice(0, 8)}</Typography.Text> },
    { title: "处理人", dataIndex: "assignee", key: "assignee" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "截止时间", dataIndex: "due_at", key: "due_at", render: formatDateTime },
  ];

  const exceptionColumns: ColumnsType<ExceptionRequest> = [
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
            danger
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

  const selectedTicket = ticketsQuery.data?.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const pendingExceptions = (exceptionsQuery.data ?? []).filter((item) => item.status === "pending").length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {contextHolder}

      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="Workflow"
          title="闭环处置"
          description="按真正的处置顺序组织页面：先挑问题，再建工单，再根据处理进度决定是否发起例外申请，审批动作直接落在表格里。"
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
              <Button type="primary" ghost disabled={!selectedTicketId} onClick={() => setIsExceptionModalOpen(true)}>
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
            <SectionTitle title="问题列表" subtitle="先从问题出发选择处置对象，再创建或补充工单。" />
            {findingsQuery.isLoading ? (
              <LoadingBlock label="正在加载问题列表" />
            ) : findingsQuery.error ? (
              <QueryErrorNotice error={findingsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={findingColumns}
                dataSource={findingsQuery.data?.items ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedFindingId(record.id),
                  style: selectedRowStyle(record.id === selectedFindingId),
                })}
              />
            )}
          </Col>
          <Col xs={24} xl={14}>
            <SectionTitle title="工单列表" subtitle="工单状态更新和例外申请都以当前选中工单为操作对象。" />
            {ticketsQuery.isLoading ? (
              <LoadingBlock label="正在加载工单" />
            ) : ticketsQuery.error ? (
              <QueryErrorNotice error={ticketsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={ticketColumns}
                dataSource={ticketsQuery.data ?? []}
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
        <SectionTitle title="例外申请" subtitle="审批动作直接留在列表中，方便安全复核人员集中处理待办。" />
        {exceptionsQuery.isLoading ? (
          <LoadingBlock label="正在加载例外申请" />
        ) : exceptionsQuery.error ? (
          <QueryErrorNotice error={exceptionsQuery.error} />
        ) : (
          <Table rowKey="id" columns={exceptionColumns} dataSource={exceptionsQuery.data ?? []} pagination={false} size="small" />
        )}
      </section>

      <Modal
        open={isTicketModalOpen}
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
          initialValues={{ assignee: "ops-team" }}
          onFinish={(values) => {
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
          <Form.Item name="assignee" label="处理人" rules={[{ required: true, message: "请输入处理人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dueAtInput" label="截止时间">
            <input className="shell-input" type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isTicketUpdateModalOpen}
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
          onFinish={(values) => {
            updateTicketMutation.mutate({
              assignee: values.assignee,
              status: values.status,
              due_at: toIsoDateTime(values.dueAtInput),
              resolution_note: values.resolution_note ?? null,
            });
          }}
        >
          <Form.Item name="assignee" label="处理人" rules={[{ required: true, message: "请输入处理人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择工单状态" }]}>
            <select className="shell-select">
              <option value="open">待处理</option>
              <option value="in_progress">处理中</option>
              <option value="closed">已关闭</option>
              <option value="exception_approved">例外已批准</option>
            </select>
          </Form.Item>
          <Form.Item name="dueAtInput" label="截止时间">
            <input className="shell-input" type="datetime-local" />
          </Form.Item>
          <Form.Item name="resolution_note" label="处理说明">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isExceptionModalOpen}
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
          onFinish={(values) => {
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
          <Form.Item name="reason" label="申请原因" rules={[{ required: true, message: "请输入例外原因" }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="expiresAtInput" label="到期时间" rules={[{ required: true, message: "请输入到期时间" }]}>
            <input className="shell-input" type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
