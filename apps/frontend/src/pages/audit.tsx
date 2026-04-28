import { useQuery } from "@tanstack/react-query";
import { Space, Table, Typography } from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import { useAuth } from "../app/auth";
import {
  JsonBlock,
  LoadingBlock,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  formatDateTime,
  panelStyle,
  translateAuditAction,
  translateResourceType,
} from "../app/ui";
import { listAuditEvents } from "../services/api";
import type { AuditEvent } from "../types/api";
import type { ThemeMode } from "../theme/theme";

export function AuditPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const auditQuery = useQuery({
    queryKey: ["audit", accessToken],
    queryFn: () => listAuditEvents(accessToken!),
    enabled: Boolean(accessToken),
  });

  const auditItems = auditQuery.data?.items ?? [];
  const systemEvents = auditItems.filter((item) => !item.actor_user_id).length;
  const resourceTypes = new Set(auditItems.map((item) => item.resource_type));

  const auditColumns: TableColumnProps<AuditEvent>[] = [
    { title: "动作", dataIndex: "action", key: "action", render: translateAuditAction },
    { title: "资源类型", dataIndex: "resource_type", key: "resource_type", render: translateResourceType },
    {
      title: "资源编号",
      dataIndex: "resource_id",
      key: "resource_id",
      render: (value) => <Typography.Text code>{value.slice(0, 8)}</Typography.Text>,
    },
    { title: "执行人", dataIndex: "actor_user_id", key: "actor_user_id", render: (value) => value ?? "系统" },
    { title: "时间", dataIndex: "created_at", key: "created_at", render: formatDateTime },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="审计日志"
          title="审计日志"
          description="查看登录、流程变更、报告生成和智能分析任务事件。"
          metrics={[
            {
              label: "审计事件",
              value: auditItems.length,
              hint: "当前已拉取到的事件总量",
              tone: "accent",
            },
            {
              label: "系统动作",
              value: systemEvents,
              hint: "由系统自动触发的事件数",
            },
            {
              label: "资源类型",
              value: resourceTypes.size,
              hint: "当前审计覆盖到的资源种类",
            },
            {
              label: "最近事件",
              value: formatDateTime(auditItems[0]?.created_at),
              hint: "按当前列表排序展示",
            },
          ]}
        />
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="审计事件列表" subtitle="展开行查看事件明细结构化数据。" />
        {auditQuery.isLoading ? (
          <LoadingBlock label="正在加载审计事件" />
        ) : auditQuery.error ? (
          <QueryErrorNotice error={auditQuery.error} />
        ) : (
          <Table
            rowKey="id"
            columns={auditColumns}
            data={auditItems}
            pagination={false}
            size="small"
            expandedRowRender={(record: AuditEvent) => <JsonBlock value={record.details} />}
          />
        )}
      </section>
    </Space>
  );
}
