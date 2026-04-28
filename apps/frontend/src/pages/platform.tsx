import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Message, Modal, Select, Space, Table, Tabs, Tag, Typography } from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import { useAuth } from "../app/auth";
import {
  KeyValueList,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  StatusTag,
  formatDateTime,
  panelStyle,
  translateResourceType,
  translateStatus,
} from "../app/ui";
import {
  createNotification,
  createReportTemplate,
  createScheduledTask,
  createUser,
  deleteReportTemplate,
  diffConfigs,
  importLedgers,
  importLogClues,
  listAiAnalysis,
  listAssets,
  listConfigs,
  listJobs,
  listLedgers,
  listLogClues,
  listNotifications,
  listPermissionMatrix,
  listReportTemplates,
  listRoles,
  listScheduledTaskExecutionLogs,
  listScheduledTasks,
  listSystemParameters,
  listUsers,
  markNotificationRead,
  retryJob,
  reviewAiAnalysis,
  triggerScheduledTask,
  updateRole,
  updateUser,
  updateReportTemplate,
  updateScheduledTask,
  upsertSystemParameter,
} from "../services/api";
import type {
  AiAnalysisJob,
  Asset,
  ConfigDiff,
  ConfigFile,
  JobQueueItem,
  LedgerImportError,
  LedgerImportResult,
  LedgerItem,
  LogClue,
  NotificationItem,
  PermissionDefinitionRead,
  ReportTemplate,
  RoleRead,
  ScheduledTask,
  ScheduledTaskExecutionLog,
  SystemParameter,
  UserRead,
} from "../types/api";
import type { ThemeMode } from "../theme/theme";
import { userHasPermission } from "../app/auth";

const TabPane = Tabs.TabPane;
const TextArea = Input.TextArea;

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

function compactJson(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatCollectionResult(payload: Record<string, unknown>) {
  const result = payload.last_collection_result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return "-";
  }
  const typed = result as { imported_count?: unknown; rejected_count?: unknown; message?: unknown };
  if (typeof typed.message === "string" && typed.message) {
    return typed.message;
  }
  return `成功 ${typed.imported_count ?? 0} 条 / 失败 ${typed.rejected_count ?? 0} 条`;
}

function definitionOptions(items: PermissionDefinitionRead[] = []) {
  return items.map((item) => ({ label: `${item.group} / ${item.label}`, value: item.key }));
}

function compactList(values: string[] = []) {
  return values.length > 4 ? `${values.slice(0, 4).join(" / ")} / +${values.length - 4}` : values.join(" / ");
}

export function PlatformPage({ mode }: { mode: ThemeMode }) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>();
  const [baseConfigId, setBaseConfigId] = React.useState<string>();
  const [compareConfigId, setCompareConfigId] = React.useState<string>();
  const [diffResult, setDiffResult] = React.useState<ConfigDiff | null>(null);
  const [ledgerImportResult, setLedgerImportResult] = React.useState<LedgerImportResult | null>(null);

  const [ledgerForm] = Form.useForm<{ catalog_type: string; source: string; name: string; owner?: string; content: string }>();
  const [scheduleForm] = Form.useForm<{ name: string; task_type: string; interval_minutes: number; payload: string }>();
  const [scheduleEditForm] = Form.useForm<{ name: string; task_type: string; enabled: string; interval_minutes: number; payload: string }>();
  const [notificationForm] = Form.useForm<{ title: string; message: string; level: string }>();
  const [logForm] = Form.useForm<{
    source: string;
    severity: string;
    keyword: string;
    message: string;
    resource_type?: string;
    resource_id?: string;
    details: string;
  }>();
  const [templateForm] = Form.useForm<{ name: string; template_type: string; version: string; body: string; variables: string }>();
  const [templateEditForm] = Form.useForm<{
    name: string;
    template_type: string;
    version: string;
    status: string;
    body: string;
    variables: string;
  }>();
  const [parameterForm] = Form.useForm<{ key: string; category: string; description?: string; value: string }>();
  const [userForm] = Form.useForm<{ username: string; password: string; full_name?: string; role_id: string }>();
  const [userEditForm] = Form.useForm<{ full_name?: string; password?: string; role_id: string; is_active: string }>();
  const [roleEditForm] = Form.useForm<{ description?: string; permissions: string[]; menu_items: string[] }>();
  const [selectedScheduleTaskId, setSelectedScheduleTaskId] = React.useState<string>();
  const [isScheduleEditModalOpen, setIsScheduleEditModalOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>();
  const [isTemplateEditModalOpen, setIsTemplateEditModalOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string>();
  const [isUserEditModalOpen, setIsUserEditModalOpen] = React.useState(false);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>();
  const [isRoleEditModalOpen, setIsRoleEditModalOpen] = React.useState(false);
  const canManageUsers = userHasPermission(user, "users:*");
  const canManageRoles = userHasPermission(user, "roles:*");
  const assetsQuery = useQuery({
    queryKey: ["assets", accessToken, "platform"],
    queryFn: () => listAssets(accessToken!),
    enabled: Boolean(accessToken),
  });
  const configsQuery = useQuery({
    queryKey: ["configs", accessToken, selectedAssetId, "platform"],
    queryFn: () => listConfigs(accessToken!, selectedAssetId!),
    enabled: Boolean(accessToken && selectedAssetId),
  });
  const ledgersQuery = useQuery({
    queryKey: ["ledgers", accessToken],
    queryFn: () => listLedgers(accessToken!),
    enabled: Boolean(accessToken),
  });
  const schedulesQuery = useQuery({
    queryKey: ["scheduled-tasks", accessToken],
    queryFn: () => listScheduledTasks(accessToken!),
    enabled: Boolean(accessToken),
  });
  const scheduleLogsQuery = useQuery({
    queryKey: ["scheduled-task-logs", accessToken, selectedScheduleTaskId],
    queryFn: () => listScheduledTaskExecutionLogs(accessToken!, selectedScheduleTaskId!),
    enabled: Boolean(accessToken && selectedScheduleTaskId),
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", accessToken],
    queryFn: () => listNotifications(accessToken!),
    enabled: Boolean(accessToken),
  });
  const logsQuery = useQuery({
    queryKey: ["log-clues", accessToken],
    queryFn: () => listLogClues(accessToken!),
    enabled: Boolean(accessToken),
  });
  const templatesQuery = useQuery({
    queryKey: ["report-templates", accessToken],
    queryFn: () => listReportTemplates(accessToken!),
    enabled: Boolean(accessToken),
  });
  const parametersQuery = useQuery({
    queryKey: ["system-parameters", accessToken],
    queryFn: () => listSystemParameters(accessToken!),
    enabled: Boolean(accessToken),
  });
  const rolesQuery = useQuery({
    queryKey: ["roles", accessToken],
    queryFn: () => listRoles(accessToken!),
    enabled: Boolean(accessToken),
  });
  const permissionMatrixQuery = useQuery({
    queryKey: ["permission-matrix", accessToken],
    queryFn: () => listPermissionMatrix(accessToken!),
    enabled: Boolean(accessToken && canManageRoles),
  });
  const usersQuery = useQuery({
    queryKey: ["users", accessToken],
    queryFn: () => listUsers(accessToken!),
    enabled: Boolean(accessToken),
  });
  const aiQuery = useQuery({
    queryKey: ["ai-analysis", accessToken],
    queryFn: () => listAiAnalysis(accessToken!),
    enabled: Boolean(accessToken),
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs", accessToken],
    queryFn: () => listJobs(accessToken!),
    enabled: Boolean(accessToken),
  });
  const queryError = [
    ledgersQuery.error,
    schedulesQuery.error,
    notificationsQuery.error,
    logsQuery.error,
    templatesQuery.error,
    parametersQuery.error,
    rolesQuery.error,
    permissionMatrixQuery.error,
    usersQuery.error,
    aiQuery.error,
    jobsQuery.error,
  ].find(Boolean);

  const invalidatePlatform = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ledgers"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-task-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["log-clues"] }),
      queryClient.invalidateQueries({ queryKey: ["report-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["system-parameters"] }),
      queryClient.invalidateQueries({ queryKey: ["roles"] }),
      queryClient.invalidateQueries({ queryKey: ["permission-matrix"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({ queryKey: ["ai-analysis"] }),
      queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    ]);
  };

  const ledgerMutation = useMutation({
    mutationFn: async (values: { catalog_type: string; source: string; name: string; owner?: string; content: string }) =>
      importLedgers(accessToken!, {
        catalog_type: values.catalog_type,
        source: values.source,
        items: [
          {
            name: values.name,
            owner: values.owner,
            content: parseJsonObject(values.content),
          },
        ],
      }),
    onSuccess: async (result) => {
      setLedgerImportResult(result);
      if (result.rejected_count > 0) {
        Message.warning(`导入完成：成功 ${result.accepted_count} 条，失败 ${result.rejected_count} 条`);
      } else {
        Message.success(`台账已导入 ${result.accepted_count} 条`);
      }
      ledgerForm.resetFields();
      await invalidatePlatform();
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (values: { name: string; task_type: string; interval_minutes: number; payload: string }) =>
      createScheduledTask(accessToken!, {
        name: values.name,
        task_type: values.task_type,
        enabled: true,
        interval_minutes: Number(values.interval_minutes),
        payload: parseJsonObject(values.payload),
        next_run_at: new Date().toISOString(),
      }),
    onSuccess: async () => {
      Message.success("周期任务已创建");
      scheduleForm.resetFields();
      await invalidatePlatform();
    },
  });

  const scheduleUpdateMutation = useMutation({
    mutationFn: async (values: { name: string; task_type: string; enabled: string; interval_minutes: number; payload: string }) =>
      updateScheduledTask(accessToken!, selectedScheduleTaskId!, {
        name: values.name,
        task_type: values.task_type,
        enabled: values.enabled === "true",
        interval_minutes: Number(values.interval_minutes),
        payload: parseJsonObject(values.payload),
      }),
    onSuccess: async () => {
      Message.success("周期任务已更新");
      setIsScheduleEditModalOpen(false);
      scheduleEditForm.resetFields();
      await invalidatePlatform();
    },
  });

  const scheduleToggleMutation = useMutation({
    mutationFn: async (task: ScheduledTask) => updateScheduledTask(accessToken!, task.id, { enabled: !task.enabled }),
    onSuccess: async (_, task) => {
      Message.success(task.enabled ? "周期任务已停用" : "周期任务已启用");
      await invalidatePlatform();
    },
  });

  const diffMutation = useMutation({
    mutationFn: () => diffConfigs(accessToken!, baseConfigId!, compareConfigId!),
    onSuccess: (result) => {
      setDiffResult(result);
      Message.success("差异计算完成");
    },
  });

  const notificationMutation = useMutation({
    mutationFn: (values: { title: string; message: string; level: string }) => createNotification(accessToken!, values),
    onSuccess: async () => {
      Message.success("提醒已创建");
      notificationForm.resetFields();
      await invalidatePlatform();
    },
  });

  const logMutation = useMutation({
    mutationFn: (values: {
      source: string;
      severity: string;
      keyword: string;
      message: string;
      resource_type?: string;
      resource_id?: string;
      details: string;
    }) =>
      importLogClues(accessToken!, [
        {
          source: values.source,
          severity: values.severity,
          keyword: values.keyword,
          message: values.message,
          resource_type: values.resource_type || null,
          resource_id: values.resource_id || null,
          details: parseJsonObject(values.details),
        },
      ]),
    onSuccess: async () => {
      Message.success("日志线索已导入");
      logForm.resetFields();
      await invalidatePlatform();
    },
  });

  const templateMutation = useMutation({
    mutationFn: (values: { name: string; template_type: string; version: string; body: string; variables: string }) =>
      createReportTemplate(accessToken!, {
        name: values.name,
        template_type: values.template_type,
        version: values.version,
        status: "active",
        body: values.body,
        variables: parseJsonObject(values.variables),
      }),
    onSuccess: async () => {
      Message.success("模板已保存");
      templateForm.resetFields();
      await invalidatePlatform();
    },
  });

  const templateUpdateMutation = useMutation({
    mutationFn: (values: {
      name: string;
      template_type: string;
      version: string;
      status: string;
      body: string;
      variables: string;
    }) =>
      updateReportTemplate(accessToken!, selectedTemplateId!, {
        name: values.name,
        template_type: values.template_type,
        version: values.version,
        status: values.status,
        body: values.body,
        variables: parseJsonObject(values.variables),
      }),
    onSuccess: async () => {
      Message.success("模板已更新");
      setIsTemplateEditModalOpen(false);
      setSelectedTemplateId(undefined);
      templateEditForm.resetFields();
      await invalidatePlatform();
    },
  });

  const templateStatusMutation = useMutation({
    mutationFn: ({ template, status }: { template: ReportTemplate; status: string }) =>
      updateReportTemplate(accessToken!, template.id, { status }),
    onSuccess: async (_, variables) => {
      Message.success(variables.status === "active" ? "模板已启用" : "模板已停用");
      await invalidatePlatform();
    },
  });

  const templateDeleteMutation = useMutation({
    mutationFn: (templateId: string) => deleteReportTemplate(accessToken!, templateId),
    onSuccess: async () => {
      Message.success("模板已删除");
      await invalidatePlatform();
    },
  });

  const parameterMutation = useMutation({
    mutationFn: (values: { key: string; category: string; description?: string; value: string }) =>
      upsertSystemParameter(accessToken!, {
        key: values.key,
        category: values.category,
        description: values.description,
        value: parseJsonObject(values.value),
      }),
    onSuccess: async () => {
      Message.success("参数已保存");
      parameterForm.resetFields();
      await invalidatePlatform();
    },
  });

  const userMutation = useMutation({
    mutationFn: (values: { username: string; password: string; full_name?: string; role_id: string }) =>
      createUser(accessToken!, {
        username: values.username,
        password: values.password,
        full_name: values.full_name,
        role_id: values.role_id,
        is_active: true,
      }),
    onSuccess: async () => {
      Message.success("用户已创建");
      userForm.resetFields();
      await invalidatePlatform();
    },
  });

  const userUpdateMutation = useMutation({
    mutationFn: (values: { full_name?: string; password?: string; role_id: string; is_active: string }) =>
      updateUser(accessToken!, selectedUserId!, {
        full_name: values.full_name,
        password: values.password?.trim() ? values.password : null,
        role_id: values.role_id,
        is_active: values.is_active === "true",
      }),
    onSuccess: async () => {
      Message.success("用户已更新");
      setIsUserEditModalOpen(false);
      setSelectedUserId(undefined);
      userEditForm.resetFields();
      await invalidatePlatform();
    },
  });

  const userToggleMutation = useMutation({
    mutationFn: (record: UserRead) => updateUser(accessToken!, record.id, { is_active: !record.is_active }),
    onSuccess: async (_, record) => {
      Message.success(record.is_active ? "用户已停用" : "用户已启用");
      await invalidatePlatform();
    },
  });

  const roleUpdateMutation = useMutation({
    mutationFn: (values: { description?: string; permissions: string[]; menu_items: string[] }) =>
      updateRole(accessToken!, selectedRoleId!, {
        description: values.description,
        permissions: values.permissions,
        menu_items: values.menu_items,
      }),
    onSuccess: async () => {
      Message.success("角色权限已更新");
      setIsRoleEditModalOpen(false);
      setSelectedRoleId(undefined);
      roleEditForm.resetFields();
      await invalidatePlatform();
    },
  });

  const handleJsonError = (error: unknown) => {
    Message.error(error instanceof Error ? error.message : "提交失败");
  };

  const assetOptions = (assetsQuery.data?.items ?? []).map((asset: Asset) => ({ label: asset.name, value: asset.id }));
  const configOptions = (configsQuery.data?.items ?? []).map((config: ConfigFile) => ({
    label: `v${config.version} / ${config.filename}`,
    value: config.id,
  }));
  const roleOptions = (rolesQuery.data ?? []).map((role) => ({ label: role.name, value: role.id }));
  const menuOptions = definitionOptions(permissionMatrixQuery.data?.menus);
  const permissionOptions = definitionOptions(permissionMatrixQuery.data?.permissions);

  const ledgerColumns: TableColumnProps<LedgerItem>[] = [
    { title: "类型", dataIndex: "catalog_type" },
    { title: "名称", dataIndex: "name" },
    { title: "来源", dataIndex: "source" },
    { title: "版本", dataIndex: "version" },
    { title: "导入时间", dataIndex: "created_at", render: formatDateTime },
  ];
  const ledgerErrorColumns: TableColumnProps<LedgerImportError>[] = [
    { title: "行号", dataIndex: "row_no", width: 80 },
    { title: "字段", dataIndex: "field", width: 160 },
    { title: "错误码", dataIndex: "code", width: 160 },
    { title: "说明", dataIndex: "message" },
  ];
  const scheduleColumns: TableColumnProps<ScheduledTask>[] = [
    { title: "任务", dataIndex: "name" },
    { title: "类型", dataIndex: "task_type" },
    { title: "状态", dataIndex: "enabled", render: (value) => <Tag color={value ? "green" : "gray"}>{value ? "启用" : "停用"}</Tag> },
    { title: "间隔", dataIndex: "interval_minutes", render: (value) => `${value} 分钟` },
    { title: "采集结果", render: (_, record) => formatCollectionResult(record.payload) },
    { title: "最近执行", dataIndex: "last_run_at", render: formatDateTime },
    { title: "下次执行", dataIndex: "next_run_at", render: formatDateTime },
    { title: "说明", dataIndex: "last_message" },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="mini" onClick={() => triggerScheduledTask(accessToken!, record.id).then(invalidatePlatform)}>
            立即触发
          </Button>
          <Button
            size="mini"
            onClick={() => {
              setSelectedScheduleTaskId(record.id);
              scheduleEditForm.setFieldsValue({
                name: record.name,
                task_type: record.task_type,
                enabled: String(record.enabled),
                interval_minutes: record.interval_minutes,
                payload: compactJson(record.payload),
              });
              setIsScheduleEditModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button size="mini" loading={scheduleToggleMutation.isPending} onClick={() => scheduleToggleMutation.mutate(record)}>
            {record.enabled ? "停用" : "启用"}
          </Button>
          <Button size="mini" onClick={() => setSelectedScheduleTaskId(record.id)}>
            日志
          </Button>
        </Space>
      ),
    },
  ];
  const scheduleLogColumns: TableColumnProps<ScheduledTaskExecutionLog>[] = [
    { title: "动作", dataIndex: "action", width: 180 },
    { title: "时间", dataIndex: "created_at", width: 190, render: formatDateTime },
    { title: "执行详情", dataIndex: "details", render: (value) => <Typography.Text code>{JSON.stringify(value)}</Typography.Text> },
  ];
  const notificationColumns: TableColumnProps<NotificationItem>[] = [
    { title: "标题", dataIndex: "title" },
    { title: "级别", dataIndex: "level" },
    { title: "状态", dataIndex: "status", render: translateStatus },
    { title: "时间", dataIndex: "created_at", render: formatDateTime },
    {
      title: "操作",
      render: (_, record) =>
        record.status === "unread" ? (
          <Button size="mini" onClick={() => markNotificationRead(accessToken!, record.id).then(invalidatePlatform)}>
            标记已读
          </Button>
        ) : null,
    },
  ];
  const logColumns: TableColumnProps<LogClue>[] = [
    { title: "来源", dataIndex: "source" },
    { title: "等级", dataIndex: "severity" },
    { title: "关键词", dataIndex: "keyword" },
    { title: "关联类型", dataIndex: "resource_type", render: (value) => translateResourceType(value) },
    { title: "关联ID", dataIndex: "resource_id", render: (value) => (value ? <Typography.Text code>{value.slice(0, 8)}</Typography.Text> : "-") },
    { title: "说明", dataIndex: "message" },
  ];
  const templateColumns: TableColumnProps<ReportTemplate>[] = [
    { title: "名称", dataIndex: "name" },
    { title: "类型", dataIndex: "template_type" },
    { title: "版本", dataIndex: "version" },
    { title: "状态", dataIndex: "status", render: translateStatus },
    {
      title: "操作",
      render: (_, record) =>
        record.status === "deleted" ? (
          <Tag color="gray">已删除</Tag>
        ) : (
        <Space>
          <Button
            size="mini"
            onClick={() => {
              setSelectedTemplateId(record.id);
              templateEditForm.setFieldsValue({
                name: record.name,
                template_type: record.template_type,
                version: record.version,
                status: record.status,
                body: record.body,
                variables: compactJson(record.variables),
              });
              setIsTemplateEditModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="mini"
            loading={templateStatusMutation.isPending}
            onClick={() =>
              templateStatusMutation.mutate({
                template: record,
                status: record.status === "active" ? "disabled" : "active",
              })
            }
          >
            {record.status === "active" ? "停用" : "启用"}
          </Button>
          <Button
            size="mini"
            status="danger"
            loading={templateDeleteMutation.isPending}
            onClick={() => {
              Modal.confirm({
                title: "删除报告模板",
                content: `确认删除模板“${record.name}”？删除后报告生成不会再使用它。`,
                onOk: () => templateDeleteMutation.mutate(record.id),
              });
            }}
          >
            删除
          </Button>
        </Space>
        ),
    },
  ];
  const parameterColumns: TableColumnProps<SystemParameter>[] = [
    { title: "键", dataIndex: "key" },
    { title: "分类", dataIndex: "category" },
    { title: "说明", dataIndex: "description" },
    { title: "值", dataIndex: "value", render: (value) => <Typography.Text code>{JSON.stringify(value)}</Typography.Text> },
  ];
  const roleColumns: TableColumnProps<RoleRead>[] = [
    { title: "角色", dataIndex: "name" },
    { title: "说明", dataIndex: "description" },
    { title: "菜单", dataIndex: "menu_items", render: (items: string[]) => compactList(items) },
    { title: "权限点", dataIndex: "permissions", render: (items: string[]) => compactList(items) },
    {
      title: "操作",
      render: (_, record) =>
        canManageRoles ? (
          <Button
            size="mini"
            onClick={() => {
              setSelectedRoleId(record.id);
              roleEditForm.setFieldsValue({
                description: record.description ?? "",
                permissions: record.permissions,
                menu_items: record.menu_items,
              });
              setIsRoleEditModalOpen(true);
            }}
          >
            权限矩阵
          </Button>
        ) : null,
    },
  ];
  const userColumns: TableColumnProps<UserRead>[] = [
    { title: "账号", dataIndex: "username" },
    { title: "姓名", dataIndex: "full_name" },
    { title: "角色", dataIndex: "role_name" },
    { title: "状态", dataIndex: "is_active", render: (value) => <Tag color={value ? "green" : "gray"}>{value ? "启用" : "停用"}</Tag> },
    {
      title: "操作",
      render: (_, record) =>
        canManageUsers ? (
          <Space>
            <Button
              size="mini"
              onClick={() => {
                setSelectedUserId(record.id);
                userEditForm.setFieldsValue({
                  full_name: record.full_name ?? "",
                  password: "",
                  role_id: record.role_id,
                  is_active: String(record.is_active),
                });
                setIsUserEditModalOpen(true);
              }}
            >
              编辑
            </Button>
            <Button size="mini" loading={userToggleMutation.isPending} onClick={() => userToggleMutation.mutate(record)}>
              {record.is_active ? "停用" : "启用"}
            </Button>
          </Space>
        ) : null,
    },
  ];
  const aiColumns: TableColumnProps<AiAnalysisJob>[] = [
    { title: "对象", dataIndex: "target_type" },
    { title: "分析类型", dataIndex: "analysis_type" },
    { title: "审核", dataIndex: "review_status", render: (value) => <StatusTag value={value} /> },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="mini" onClick={() => reviewAiAnalysis(accessToken!, record.id, { review_status: "approved", comment: "前端审核通过" }).then(invalidatePlatform)}>
            通过
          </Button>
          <Button size="mini" status="danger" onClick={() => reviewAiAnalysis(accessToken!, record.id, { review_status: "rejected", comment: "前端审核驳回" }).then(invalidatePlatform)}>
            驳回
          </Button>
        </Space>
      ),
    },
  ];
  const jobColumns: TableColumnProps<JobQueueItem>[] = [
    { title: "类型", dataIndex: "job_type" },
    { title: "状态", dataIndex: "status", render: (value) => <StatusTag value={value} /> },
    { title: "尝试", dataIndex: "attempts" },
    { title: "错误", dataIndex: "last_error" },
    {
      title: "操作",
      render: (_, record) =>
        record.status !== "completed" ? (
          <Button size="mini" onClick={() => retryJob(accessToken!, record.id).then(invalidatePlatform)}>
            重试
          </Button>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <PageHeader
        eyebrow="平台管理"
        title="配置化能力与运行治理"
        description="补齐台账导入、周期调度、提醒、日志线索、模板参数、权限、AI 审核和任务重试。"
      />
      {queryError ? <QueryErrorNotice error={queryError} /> : null}

      <section style={panelStyle(mode)}>
        <Tabs defaultActiveTab="ledgers" destroyOnHide={false}>
          <TabPane key="ledgers" title="台账与差异">
            <div className="shell-workspace-grid">
              <div>
                <SectionTitle title="多类台账导入" subtitle="支持策略、账号、例外、绕行、模板等基础台账。" />
                <Form
                  form={ledgerForm}
                  layout="vertical"
                  initialValues={{ catalog_type: "account", source: "manual", content: compactJson({ username: "NOC-ADMIN", role: "operator" }) }}
                  onSubmit={(values) => ledgerMutation.mutate(values, { onError: handleJsonError })}
                >
                  <Form.Item field="catalog_type" label="台账类型">
                    <Select
                      options={[
                        { label: "策略", value: "strategy" },
                        { label: "账号", value: "account" },
                        { label: "例外", value: "exception" },
                        { label: "绕行", value: "bypass" },
                        { label: "模板", value: "template" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item field="source" label="来源">
                    <Input />
                  </Form.Item>
                  <Form.Item field="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item field="owner" label="责任人">
                    <Input />
                  </Form.Item>
                  <Form.Item field="content" label="结构化内容 JSON">
                    <TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={ledgerMutation.isPending}>
                    导入台账
                  </Button>
                </Form>
                {ledgerImportResult ? (
                  <div style={{ marginTop: 16 }}>
                    <KeyValueList
                      items={[
                        { label: "成功行数", value: ledgerImportResult.accepted_count },
                        { label: "失败行数", value: ledgerImportResult.rejected_count },
                        { label: "导入来源", value: ledgerImportResult.source },
                      ]}
                    />
                    {ledgerImportResult.errors.length > 0 ? (
                      <Table
                        rowKey={(record) => `${record.row_no}-${record.field}-${record.code}`}
                        columns={ledgerErrorColumns}
                        data={ledgerImportResult.errors}
                        pagination={false}
                        size="small"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div>
                <SectionTitle title="配置版本差异" subtitle="选择同一对象的两个配置版本进行行级差异查看。" />
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Select placeholder="选择治理对象" options={assetOptions} value={selectedAssetId} onChange={setSelectedAssetId} />
                  <Select placeholder="基准版本" options={configOptions} value={baseConfigId} onChange={setBaseConfigId} />
                  <Select placeholder="对比版本" options={configOptions} value={compareConfigId} onChange={setCompareConfigId} />
                  <Button
                    type="primary"
                    disabled={!baseConfigId || !compareConfigId}
                    loading={diffMutation.isPending}
                    onClick={() => diffMutation.mutate()}
                  >
                    计算差异
                  </Button>
                  {diffResult ? (
                    <KeyValueList
                      items={[
                        { label: "新增行", value: diffResult.added.length },
                        { label: "删除行", value: diffResult.removed.length },
                        { label: "变化总数", value: diffResult.changed_count },
                      ]}
                    />
                  ) : null}
                  {diffResult ? (
                    <pre className="shell-code-block">{JSON.stringify({ added: diffResult.added, removed: diffResult.removed }, null, 2)}</pre>
                  ) : null}
                </Space>
              </div>
            </div>
            <Table rowKey="id" columns={ledgerColumns} data={ledgersQuery.data?.items ?? []} pagination={false} size="small" />
          </TabPane>

          <TabPane key="schedule" title="周期与提醒">
            <div className="shell-workspace-grid">
              <Form
                form={scheduleForm}
                layout="vertical"
                initialValues={{
                  task_type: "base_data_sync",
                  interval_minutes: 60,
                  payload: compactJson({
                    collector_type: "mock",
                    catalog_type: "account",
                    items: [{ name: "AUTO-ACCOUNT", content: { username: "AUTO-ACCOUNT", role: "operator" } }],
                  }),
                }}
                onSubmit={(values) => scheduleMutation.mutate(values, { onError: handleJsonError })}
              >
                <SectionTitle title="周期任务" subtitle="创建基础数据同步或周期巡检任务。" />
                <Form.Item field="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="task_type" label="任务类型">
                  <Select options={[{ label: "基础数据同步", value: "base_data_sync" }, { label: "周期巡检", value: "periodic_inspection" }]} />
                </Form.Item>
                <Form.Item field="interval_minutes" label="间隔分钟">
                  <Input />
                </Form.Item>
                <Form.Item field="payload" label="任务参数 JSON">
                  <TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={scheduleMutation.isPending}>
                  创建周期任务
                </Button>
              </Form>
              <Form
                form={notificationForm}
                layout="vertical"
                initialValues={{ level: "info" }}
                onSubmit={(values) => notificationMutation.mutate(values)}
              >
                <SectionTitle title="消息提醒" subtitle="人工创建提醒，系统任务也会自动写入提醒。" />
                <Form.Item field="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="message" label="内容" rules={[{ required: true, message: "请输入内容" }]}>
                  <TextArea />
                </Form.Item>
                <Form.Item field="level" label="级别">
                  <Select options={[{ label: "信息", value: "info" }, { label: "警告", value: "warning" }, { label: "错误", value: "error" }]} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={notificationMutation.isPending}>
                  创建提醒
                </Button>
              </Form>
            </div>
            <Table rowKey="id" columns={scheduleColumns} data={schedulesQuery.data ?? []} pagination={false} size="small" />
            {selectedScheduleTaskId ? (
              <div style={{ marginTop: 18 }}>
                <SectionTitle title="执行日志" subtitle="展示该周期任务的触发、编辑和 data-service 执行留痕。" />
                <Table
                  rowKey="id"
                  columns={scheduleLogColumns}
                  data={scheduleLogsQuery.data ?? []}
                  loading={scheduleLogsQuery.isLoading}
                  pagination={false}
                  size="small"
                />
              </div>
            ) : null}
            <Table rowKey="id" columns={notificationColumns} data={notificationsQuery.data ?? []} pagination={false} size="small" />
          </TabPane>

          <TabPane key="logs" title="日志线索">
            <Form
              form={logForm}
              layout="vertical"
              initialValues={{ source: "syslog", severity: "high", details: "{}" }}
              onSubmit={(values) => logMutation.mutate(values, { onError: handleJsonError })}
            >
              <SectionTitle title="敏感日志线索" subtitle="导入可关联到对象、问题、任务或报告的日志线索。" />
              <Form.Item field="source" label="来源">
                <Input />
              </Form.Item>
              <Form.Item field="severity" label="等级">
                <Select options={[{ label: "高", value: "high" }, { label: "中", value: "medium" }, { label: "低", value: "low" }]} />
              </Form.Item>
              <Form.Item field="keyword" label="关键词" rules={[{ required: true, message: "请输入关键词" }]}>
                <Input />
              </Form.Item>
                <Form.Item field="message" label="说明" rules={[{ required: true, message: "请输入说明" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="resource_type" label="关联类型">
                  <Select
                    allowClear
                    options={[
                      { label: "治理对象", value: "asset" },
                      { label: "问题", value: "finding" },
                      { label: "工单", value: "ticket" },
                      { label: "报告任务", value: "report_job" },
                    ]}
                  />
                </Form.Item>
                <Form.Item field="resource_id" label="关联 ID">
                  <Input placeholder="粘贴对象、问题、工单或报告 ID" />
                </Form.Item>
                <Form.Item field="details" label="详情 JSON">
                  <TextArea />
                </Form.Item>
              <Button type="primary" htmlType="submit" loading={logMutation.isPending}>
                导入线索
              </Button>
            </Form>
            <Table rowKey="id" columns={logColumns} data={logsQuery.data ?? []} pagination={false} size="small" />
          </TabPane>

          <TabPane key="templates" title="模板参数">
            <div className="shell-workspace-grid">
              <Form
                form={templateForm}
                layout="vertical"
                initialValues={{ template_type: "inspection_summary", version: "v1", variables: "{}" }}
                onSubmit={(values) => templateMutation.mutate(values, { onError: handleJsonError })}
              >
                <SectionTitle title="报告模板" subtitle="报告生成时优先使用匹配类型的启用模板。" />
                <Form.Item field="name" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="template_type" label="模板类型">
                  <Select
                    options={[
                      { label: "巡检摘要", value: "inspection_summary" },
                      { label: "问题摘要", value: "finding_digest" },
                      { label: "审计快照", value: "audit_snapshot" },
                      { label: "迎检资料包", value: "inspection_package" },
                    ]}
                  />
                </Form.Item>
                <Form.Item field="version" label="版本">
                  <Input />
                </Form.Item>
                <Form.Item field="body" label="模板内容">
                  <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="支持 {{report_id}}、{{finding_total}} 等变量" />
                </Form.Item>
                <Form.Item field="variables" label="变量说明 JSON">
                  <TextArea />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={templateMutation.isPending}>
                  保存模板
                </Button>
              </Form>
              <Form
                form={parameterForm}
                layout="vertical"
                initialValues={{
                  key: "report.settings",
                  category: "report",
                  description: "报告生成默认参数",
                  value: compactJson({
                    finding_list_limit: 100,
                    include_closed_findings: true,
                    package_include_evidence_manifest: true,
                  }),
                }}
                onSubmit={(values) => parameterMutation.mutate(values, { onError: handleJsonError })}
              >
                <SectionTitle title="系统参数" subtitle="风险等级、分类、模板参数等统一配置。" />
                <Form.Item field="key" label="参数键" rules={[{ required: true, message: "请输入参数键" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="category" label="分类">
                  <Input />
                </Form.Item>
                <Form.Item field="description" label="说明">
                  <Input />
                </Form.Item>
                <Form.Item field="value" label="参数值 JSON">
                  <TextArea />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={parameterMutation.isPending}>
                  保存参数
                </Button>
              </Form>
            </div>
            <Table rowKey="id" columns={templateColumns} data={templatesQuery.data ?? []} pagination={false} size="small" />
            <Table rowKey="id" columns={parameterColumns} data={parametersQuery.data ?? []} pagination={false} size="small" />
          </TabPane>

          <TabPane key="users" title="权限与 AI">
            <div className="shell-workspace-grid">
              <Form form={userForm} layout="vertical" onSubmit={(values) => userMutation.mutate(values)}>
                <SectionTitle title="用户角色" subtitle="本地账号、角色菜单和权限信息集中管理。" />
                <Form.Item field="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
                  <Input />
                </Form.Item>
                <Form.Item field="password" label="初始密码" rules={[{ required: true, message: "请输入密码" }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item field="full_name" label="姓名">
                  <Input />
                </Form.Item>
                <Form.Item field="role_id" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
                  <Select options={roleOptions} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={userMutation.isPending}>
                  创建用户
                </Button>
              </Form>
              <div>
                <SectionTitle title="权限矩阵" subtitle="角色控制菜单可见性和后端操作权限；按钮隐藏只是体验，API 会继续校验权限点。" />
                <Typography.Paragraph style={{ color: "var(--shell-muted)" }}>
                  当前已加载 {permissionMatrixQuery.data?.permissions.length ?? 0} 个权限点和 {permissionMatrixQuery.data?.menus.length ?? 0} 个菜单项。
                </Typography.Paragraph>
              </div>
            </div>
            <Table rowKey="id" columns={roleColumns} data={rolesQuery.data ?? []} pagination={false} size="small" />
            <Table rowKey="id" columns={userColumns} data={usersQuery.data ?? []} pagination={false} size="small" />
            <Table rowKey="id" columns={aiColumns} data={aiQuery.data ?? []} pagination={false} size="small" />
          </TabPane>

          <TabPane key="jobs" title="任务重试">
            <SectionTitle title="任务队列" subtitle="失败任务可在保留上下文后重新进入 pending 队列。" />
            <Table rowKey="id" columns={jobColumns} data={jobsQuery.data ?? []} pagination={false} size="small" />
          </TabPane>
        </Tabs>
      </section>

      <Modal
        visible={isScheduleEditModalOpen}
        title="编辑周期任务"
        okText="保存"
        confirmLoading={scheduleUpdateMutation.isPending}
        onCancel={() => {
          setIsScheduleEditModalOpen(false);
          scheduleEditForm.resetFields();
        }}
        onOk={() => {
          void scheduleEditForm.submit();
        }}
      >
        <Form
          form={scheduleEditForm}
          layout="vertical"
          onSubmit={(values) => scheduleUpdateMutation.mutate(values, { onError: handleJsonError })}
        >
          <Form.Item field="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="task_type" label="任务类型" rules={[{ required: true, message: "请选择任务类型" }]}>
            <Select options={[{ label: "基础数据同步", value: "base_data_sync" }, { label: "周期巡检", value: "periodic_inspection" }]} />
          </Form.Item>
          <Form.Item field="enabled" label="启停状态">
            <Select options={[{ label: "启用", value: "true" }, { label: "停用", value: "false" }]} />
          </Form.Item>
          <Form.Item field="interval_minutes" label="间隔分钟">
            <Input />
          </Form.Item>
          <Form.Item field="payload" label="任务参数 JSON">
            <TextArea autoSize={{ minRows: 6, maxRows: 12 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isTemplateEditModalOpen}
        title="编辑报告模板"
        okText="保存"
        confirmLoading={templateUpdateMutation.isPending}
        onCancel={() => {
          setIsTemplateEditModalOpen(false);
          setSelectedTemplateId(undefined);
          templateEditForm.resetFields();
        }}
        onOk={() => {
          void templateEditForm.submit();
        }}
      >
        <Form
          form={templateEditForm}
          layout="vertical"
          onSubmit={(values) => templateUpdateMutation.mutate(values, { onError: handleJsonError })}
        >
          <Form.Item field="name" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="template_type" label="模板类型">
            <Select
              options={[
                { label: "巡检摘要", value: "inspection_summary" },
                { label: "问题摘要", value: "finding_digest" },
                { label: "审计快照", value: "audit_snapshot" },
                { label: "迎检资料包", value: "inspection_package" },
              ]}
            />
          </Form.Item>
          <Form.Item field="version" label="版本">
            <Input />
          </Form.Item>
          <Form.Item field="status" label="状态">
            <Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "disabled" }]} />
          </Form.Item>
          <Form.Item field="body" label="模板内容">
            <TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
          </Form.Item>
          <Form.Item field="variables" label="变量说明 JSON">
            <TextArea autoSize={{ minRows: 3, maxRows: 7 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isUserEditModalOpen}
        title="编辑用户"
        okText="保存"
        confirmLoading={userUpdateMutation.isPending}
        onCancel={() => {
          setIsUserEditModalOpen(false);
          setSelectedUserId(undefined);
          userEditForm.resetFields();
        }}
        onOk={() => {
          void userEditForm.submit();
        }}
      >
        <Form
          form={userEditForm}
          layout="vertical"
          onSubmit={(values) => userUpdateMutation.mutate(values, { onError: handleJsonError })}
        >
          <Form.Item field="full_name" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item field="role_id" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item field="is_active" label="账号状态">
            <Select options={[{ label: "启用", value: "true" }, { label: "停用", value: "false" }]} />
          </Form.Item>
          <Form.Item field="password" label="重置密码">
            <Input.Password placeholder="留空则不修改密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isRoleEditModalOpen}
        title="角色权限矩阵"
        okText="保存"
        confirmLoading={roleUpdateMutation.isPending}
        onCancel={() => {
          setIsRoleEditModalOpen(false);
          setSelectedRoleId(undefined);
          roleEditForm.resetFields();
        }}
        onOk={() => {
          void roleEditForm.submit();
        }}
      >
        <Form
          form={roleEditForm}
          layout="vertical"
          onSubmit={(values) => roleUpdateMutation.mutate(values, { onError: handleJsonError })}
        >
          <Form.Item field="description" label="角色说明">
            <Input />
          </Form.Item>
          <Form.Item field="menu_items" label="可见菜单">
            <Select mode="multiple" allowClear options={menuOptions} placeholder="选择该角色可见菜单" />
          </Form.Item>
          <Form.Item field="permissions" label="操作权限点">
            <Select mode="multiple" allowClear options={permissionOptions} placeholder="选择后端允许的操作权限点" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
