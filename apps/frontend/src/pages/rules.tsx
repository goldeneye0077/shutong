import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "antd/es/button";
import Col from "antd/es/col";
import Form from "antd/es/form";
import Input from "antd/es/input";
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
  LoadingBlock,
  PageHeader,
  QueryErrorNotice,
  SectionTitle,
  SeverityTag,
  StatusTag,
  Toolbar,
  formatDateTime,
  panelStyle,
  translateTriggerType,
} from "../app/ui";
import {
  createInspection,
  createRule,
  listAssets,
  listFindings,
  listInspectionAiSummaries,
  listInspections,
  listRuleResults,
  listRules,
  updateRule,
} from "../services/api";
import type {
  Finding,
  InspectionCreatePayload,
  InspectionRun,
  RuleRunResult,
  RuleSet,
  RuleSetCreatePayload,
  RuleSetUpdatePayload,
} from "../types/api";
import type { ThemeMode } from "../theme/theme";

const riskOptions = [
  { label: "严重", value: "critical" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

export function RulesPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [ruleForm] = Form.useForm<RuleSetCreatePayload & { definitionText: string }>();
  const [ruleEditForm] = Form.useForm<RuleSetUpdatePayload & { definitionText: string }>();
  const [inspectionForm] = Form.useForm<InspectionCreatePayload>();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = React.useState<string | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = React.useState(false);
  const [isRuleEditModalOpen, setIsRuleEditModalOpen] = React.useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = React.useState(false);

  const rulesQuery = useQuery({
    queryKey: ["rules", accessToken],
    queryFn: () => listRules(accessToken!),
    enabled: Boolean(accessToken),
  });
  const assetsQuery = useQuery({
    queryKey: ["assets", accessToken, "rule-page-assets"],
    queryFn: () => listAssets(accessToken!),
    enabled: Boolean(accessToken),
  });
  const inspectionsQuery = useQuery({
    queryKey: ["inspections", accessToken, "rules-page"],
    queryFn: () => listInspections(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: (query) =>
      getActiveRefetchInterval(
        (((query.state.data as { items?: InspectionRun[] } | undefined)?.items ?? []).map((item) => item.status)),
      ),
  });

  React.useEffect(() => {
    const firstRuleId = rulesQuery.data?.[0]?.id ?? null;
    if (!selectedRuleId || !rulesQuery.data?.some((item) => item.id === selectedRuleId)) {
      setSelectedRuleId(firstRuleId);
    }
  }, [rulesQuery.data, selectedRuleId]);

  React.useEffect(() => {
    const firstInspectionId = inspectionsQuery.data?.items[0]?.id ?? null;
    if (!selectedInspectionId || !inspectionsQuery.data?.items.some((item) => item.id === selectedInspectionId)) {
      setSelectedInspectionId(firstInspectionId);
    }
  }, [inspectionsQuery.data, selectedInspectionId]);

  const selectedInspectionStatus = inspectionsQuery.data?.items.find((item) => item.id === selectedInspectionId)?.status;

  const findingsQuery = useQuery({
    queryKey: ["findings", accessToken, selectedInspectionId],
    queryFn: () => listFindings(accessToken!, selectedInspectionId!),
    enabled: Boolean(accessToken && selectedInspectionId),
    refetchInterval: getActiveRefetchInterval([selectedInspectionStatus]),
  });
  const resultsQuery = useQuery({
    queryKey: ["rule-results", accessToken, selectedInspectionId],
    queryFn: () => listRuleResults(accessToken!, selectedInspectionId!),
    enabled: Boolean(accessToken && selectedInspectionId),
    refetchInterval: getActiveRefetchInterval([selectedInspectionStatus]),
  });
  const aiQuery = useQuery({
    queryKey: ["inspection-ai", accessToken, selectedInspectionId],
    queryFn: () => listInspectionAiSummaries(accessToken!, selectedInspectionId!),
    enabled: Boolean(accessToken && selectedInspectionId),
    refetchInterval: getActiveRefetchInterval([selectedInspectionStatus]),
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: RuleSetCreatePayload) => createRule(accessToken!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
      setIsRuleModalOpen(false);
      ruleForm.resetFields();
      messageApi.success("规则集已创建。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "规则集创建失败。");
    },
  });

  const createInspectionMutation = useMutation({
    mutationFn: (payload: InspectionCreatePayload) => createInspection(accessToken!, payload),
    onSuccess: async (inspection) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inspections"] }),
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
        queryClient.invalidateQueries({ queryKey: ["rule-results"] }),
        queryClient.invalidateQueries({ queryKey: ["inspection-ai"] }),
      ]);
      setSelectedInspectionId(inspection.id);
      setIsInspectionModalOpen(false);
      inspectionForm.resetFields();
      messageApi.success("巡检任务已入队。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "巡检任务创建失败。");
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: (payload: RuleSetUpdatePayload) => updateRule(accessToken!, selectedRuleId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
      setIsRuleEditModalOpen(false);
      ruleEditForm.resetFields();
      messageApi.success("规则集已更新。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "规则集更新失败。");
    },
  });

  const ruleColumns: ColumnsType<RuleSet> = [
    { title: "规则集", dataIndex: "name", key: "name" },
    { title: "分类", dataIndex: "category", key: "category" },
    { title: "风险级别", key: "risk_level", render: (_, record) => <SeverityTag value={record.risk_level} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
  ];

  const inspectionColumns: ColumnsType<InspectionRun> = [
    { title: "巡检任务", dataIndex: "name", key: "name" },
    { title: "触发方式", dataIndex: "trigger_type", key: "trigger_type", render: translateTriggerType },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "对象数量", key: "asset_scope", render: (_, record) => record.asset_scope.length },
  ];

  const findingColumns: ColumnsType<Finding> = [
    { title: "问题标题", dataIndex: "title", key: "title" },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", render: formatDateTime },
  ];

  const resultColumns: ColumnsType<RuleRunResult> = [
    { title: "对象 ID", key: "asset_id", dataIndex: "asset_id" },
    {
      title: "命中结果",
      key: "matched",
      render: (_, record) => (record.matched ? <Tag color="volcano">命中</Tag> : <Tag color="green">通过</Tag>),
    },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "摘要", dataIndex: "summary", key: "summary" },
  ];

  const selectedRule = (rulesQuery.data ?? []).find((rule) => rule.id === selectedRuleId) ?? null;
  const selectedInspection = inspectionsQuery.data?.items.find((inspection) => inspection.id === selectedInspectionId) ?? null;
  const activeInspections = (inspectionsQuery.data?.items ?? []).filter(
    (inspection) => inspection.status === "queued" || inspection.status === "processing",
  ).length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {contextHolder}

      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="Rules & Inspections"
          title="规则与巡检"
          description="按照企业后台更常见的主从工作流来重排：左边维护规则集，右边发起巡检，下面直接接发现、执行结果和 AI 草稿。"
          actions={
            <Space size={[8, 8]} wrap>
              {selectedRule ? <Tag color="blue">{selectedRule.name}</Tag> : null}
              {selectedInspection ? <Tag color="gold">{selectedInspection.name}</Tag> : null}
            </Space>
          }
          metrics={[
            {
              label: "规则集",
              value: rulesQuery.data?.length ?? 0,
              hint: "当前可用规则元数据",
              tone: "accent",
            },
            {
              label: "在途巡检",
              value: activeInspections,
              hint: "排队中与处理中任务",
              tone: activeInspections > 0 ? "warning" : "success",
            },
            {
              label: "发现问题",
              value: findingsQuery.data?.total ?? 0,
              hint: "当前所选巡检回写的问题数",
            },
            {
              label: "命中记录",
              value: (resultsQuery.data ?? []).filter((item) => item.matched).length,
              hint: "规则执行结果中的命中项",
            },
          ]}
        />
      </section>

      <section style={panelStyle(mode)}>
        <Toolbar
          left={
            <>
              <Button type="primary" onClick={() => setIsRuleModalOpen(true)}>
                新建规则集
              </Button>
              <Button
                disabled={!selectedRule}
                onClick={() => {
                  if (!selectedRule) {
                    return;
                  }
                  ruleEditForm.setFieldsValue({
                    name: selectedRule.name,
                    category: selectedRule.category,
                    version: selectedRule.version,
                    risk_level: selectedRule.risk_level,
                    status: selectedRule.status,
                    scope: selectedRule.scope,
                    definitionText: JSON.stringify(selectedRule.definition, null, 2),
                  });
                  setIsRuleEditModalOpen(true);
                }}
              >
                编辑规则集
              </Button>
              <Button type="primary" ghost onClick={() => setIsInspectionModalOpen(true)}>
                发起巡检
              </Button>
            </>
          }
          right={
            <>
              {selectedRule ? <Typography.Text type="secondary">版本：{selectedRule.version}</Typography.Text> : null}
              {selectedInspection ? <StatusTag value={selectedInspection.status} /> : null}
            </>
          }
        />
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={10}>
            <SectionTitle title="规则集" subtitle="规则定义继续保存在 backend，前端只负责维护元数据与发起动作。" />
            {rulesQuery.isLoading ? (
              <LoadingBlock label="正在加载规则集" />
            ) : rulesQuery.error ? (
              <QueryErrorNotice error={rulesQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={ruleColumns}
                dataSource={rulesQuery.data ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedRuleId(record.id),
                  style: selectedRowStyle(record.id === selectedRuleId),
                })}
              />
            )}
          </Col>
          <Col xs={24} xl={14}>
            <SectionTitle title="巡检任务" subtitle="巡检先在 backend 写入排队记录，再交给 data-service 独立执行。" />
            {inspectionsQuery.isLoading ? (
              <LoadingBlock label="正在加载巡检任务" />
            ) : inspectionsQuery.error ? (
              <QueryErrorNotice error={inspectionsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={inspectionColumns}
                dataSource={inspectionsQuery.data?.items ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedInspectionId(record.id),
                  style: selectedRowStyle(record.id === selectedInspectionId),
                })}
              />
            )}
          </Col>
        </Row>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={12}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="巡检发现" subtitle="展示规则命中后回写到 backend 的问题结果，方便直接进入闭环处理。" />
            {findingsQuery.isLoading ? (
              <LoadingBlock label="正在加载问题列表" />
            ) : findingsQuery.error ? (
              <QueryErrorNotice error={findingsQuery.error} />
            ) : (
              <Table rowKey="id" columns={findingColumns} dataSource={findingsQuery.data?.items ?? []} pagination={false} size="small" />
            )}
          </section>
        </Col>
        <Col xs={24} xl={12}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="规则执行结果" subtitle="每条记录对应一个治理对象上的执行结论，适合快速判断命中范围与摘要。" />
            {resultsQuery.isLoading ? (
              <LoadingBlock label="正在加载规则执行结果" />
            ) : resultsQuery.error ? (
              <QueryErrorNotice error={resultsQuery.error} />
            ) : (
              <Table rowKey="id" columns={resultColumns} dataSource={resultsQuery.data ?? []} pagination={false} size="small" />
            )}
          </section>
        </Col>
      </Row>

      <section style={panelStyle(mode)}>
        <SectionTitle title="AI 巡检草稿" subtitle="AI 只做归纳，不参与最终判定，保持人工复核前置。" />
        {aiQuery.isLoading ? (
          <LoadingBlock label="正在加载 AI 草稿" />
        ) : aiQuery.error ? (
          <QueryErrorNotice error={aiQuery.error} />
        ) : (
          <DraftSummaries jobs={aiQuery.data} />
        )}
      </section>

      <Modal
        open={isRuleModalOpen}
        title="新建规则集"
        okText="创建"
        confirmLoading={createRuleMutation.isPending}
        onCancel={() => {
          setIsRuleModalOpen(false);
          ruleForm.resetFields();
        }}
        onOk={() => {
          void ruleForm.submit();
        }}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          initialValues={{
            category: "firewall",
            version: "v1",
            risk_level: "high",
            status: "active",
            scope: "OMFW",
            definitionText: JSON.stringify({ must_not_have_any_any: true }, null, 2),
          }}
          onFinish={(values) => {
            try {
              const definition = JSON.parse(values.definitionText || "{}") as Record<string, unknown>;
              createRuleMutation.mutate({
                name: values.name,
                category: values.category,
                version: values.version,
                risk_level: values.risk_level,
                status: values.status,
                scope: values.scope,
                definition,
              });
            } catch {
              messageApi.error("规则定义必须是合法 JSON。");
            }
          }}
        >
          <Form.Item name="name" label="规则集名称" rules={[{ required: true, message: "请输入规则集名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: "请输入分类" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: "请输入版本号" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="risk_level" label="风险级别" rules={[{ required: true, message: "请选择风险级别" }]}>
            <Select options={riskOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "启用", value: "active" }, { label: "草稿", value: "draft" }]} />
          </Form.Item>
          <Form.Item name="scope" label="适用范围" rules={[{ required: true, message: "请输入适用范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="definitionText"
            label="规则定义 JSON"
            rules={[{ required: true, message: "请输入规则 JSON 定义" }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isRuleEditModalOpen}
        title="编辑规则集"
        okText="保存"
        confirmLoading={updateRuleMutation.isPending}
        onCancel={() => {
          setIsRuleEditModalOpen(false);
          ruleEditForm.resetFields();
        }}
        onOk={() => {
          void ruleEditForm.submit();
        }}
      >
        <Form
          form={ruleEditForm}
          layout="vertical"
          onFinish={(values) => {
            try {
              const definition = JSON.parse(values.definitionText || "{}") as Record<string, unknown>;
              updateRuleMutation.mutate({
                name: values.name,
                category: values.category,
                version: values.version,
                risk_level: values.risk_level,
                status: values.status,
                scope: values.scope,
                definition,
              });
            } catch {
              messageApi.error("规则定义必须是合法 JSON。");
            }
          }}
        >
          <Form.Item name="name" label="规则集名称" rules={[{ required: true, message: "请输入规则集名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: "请输入分类" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: "请输入版本号" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="risk_level" label="风险级别" rules={[{ required: true, message: "请选择风险级别" }]}>
            <Select options={riskOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "启用", value: "active" }, { label: "草稿", value: "draft" }]} />
          </Form.Item>
          <Form.Item name="scope" label="适用范围" rules={[{ required: true, message: "请输入适用范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="definitionText"
            label="规则定义 JSON"
            rules={[{ required: true, message: "请输入规则 JSON 定义" }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isInspectionModalOpen}
        title="发起巡检"
        okText="加入队列"
        confirmLoading={createInspectionMutation.isPending}
        onCancel={() => {
          setIsInspectionModalOpen(false);
          inspectionForm.resetFields();
        }}
        onOk={() => {
          void inspectionForm.submit();
        }}
      >
        <Form
          form={inspectionForm}
          layout="vertical"
          initialValues={{ trigger_type: "manual" }}
          onFinish={(values) => {
            createInspectionMutation.mutate(values);
          }}
        >
          <Form.Item name="name" label="巡检名称" rules={[{ required: true, message: "请输入巡检名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trigger_type" label="触发方式" rules={[{ required: true, message: "请选择触发方式" }]}>
            <Select options={[{ label: "手动", value: "manual" }, { label: "定时", value: "scheduled" }]} />
          </Form.Item>
          <Form.Item name="rule_set_id" label="规则集" rules={[{ required: true, message: "请选择规则集" }]}>
            <Select
              options={(rulesQuery.data ?? []).map((rule) => ({
                label: `${rule.name} / ${rule.version}`,
                value: rule.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="asset_scope" label="治理对象范围" rules={[{ required: true, message: "请至少选择一个治理对象" }]}>
            <Select
              mode="multiple"
              options={(assetsQuery.data?.items ?? []).map((asset) => ({
                label: `${asset.name} / ${asset.asset_type}`,
                value: asset.id,
              }))}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            巡检创建后会先在 backend 记录排队状态，再交由 data-service 独立执行与回写。
          </Typography.Paragraph>
        </Form>
      </Modal>
    </Space>
  );
}
