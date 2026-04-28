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
  diffRuleVersions,
  listAssets,
  listFindings,
  listInspectionAiSummaries,
  listInspections,
  listRuleResults,
  listRuleVersions,
  listRules,
  rollbackRuleVersion,
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
  RuleVersionDiff,
  RuleSetVersion,
} from "../types/api";
import type { ThemeMode } from "../theme/theme";

const riskOptions = [
  { label: "严重", value: "critical" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

const { Row, Col } = Grid;

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
  const messageApi = Message;
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = React.useState<string | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = React.useState(false);
  const [isRuleEditModalOpen, setIsRuleEditModalOpen] = React.useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = React.useState(false);
  const [baseRuleVersionId, setBaseRuleVersionId] = React.useState<string | undefined>();
  const [compareRuleVersionId, setCompareRuleVersionId] = React.useState<string | undefined>();
  const [ruleVersionDiff, setRuleVersionDiff] = React.useState<RuleVersionDiff | null>(null);

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
  const ruleVersionsQuery = useQuery({
    queryKey: ["rule-versions", accessToken, selectedRuleId],
    queryFn: () => listRuleVersions(accessToken!, selectedRuleId!),
    enabled: Boolean(accessToken && selectedRuleId),
  });
  React.useEffect(() => {
    const versions = ruleVersionsQuery.data ?? [];
    setCompareRuleVersionId(versions[0]?.id);
    setBaseRuleVersionId(versions[1]?.id ?? versions[0]?.id);
    setRuleVersionDiff(null);
  }, [ruleVersionsQuery.data, selectedRuleId]);

  const createRuleMutation = useMutation({
    mutationFn: (payload: RuleSetCreatePayload) => createRule(accessToken!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
      await queryClient.invalidateQueries({ queryKey: ["rule-versions"] });
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
      await queryClient.invalidateQueries({ queryKey: ["rule-versions"] });
      setIsRuleEditModalOpen(false);
      ruleEditForm.resetFields();
      messageApi.success("规则集已更新。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "规则集更新失败。");
    },
  });

  const diffRuleVersionMutation = useMutation({
    mutationFn: () => diffRuleVersions(accessToken!, selectedRuleId!, baseRuleVersionId!, compareRuleVersionId!),
    onSuccess: (result) => {
      setRuleVersionDiff(result);
      Message.success(`版本差异计算完成：${result.changed_count} 项变化`);
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "规则版本差异计算失败。");
    },
  });

  const rollbackRuleVersionMutation = useMutation({
    mutationFn: (versionId: string) => rollbackRuleVersion(accessToken!, selectedRuleId!, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
      await queryClient.invalidateQueries({ queryKey: ["rule-versions"] });
      setRuleVersionDiff(null);
      messageApi.success("规则已从历史版本回滚，并生成新的版本快照。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "规则版本回滚失败。");
    },
  });

  const ruleColumns: TableColumnProps<RuleSet>[] = [
    { title: "规则集", dataIndex: "name", key: "name" },
    { title: "分类", dataIndex: "category", key: "category" },
    { title: "风险级别", key: "risk_level", render: (_, record) => <SeverityTag value={record.risk_level} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
  ];

  const inspectionColumns: TableColumnProps<InspectionRun>[] = [
    { title: "巡检任务", dataIndex: "name", key: "name" },
    { title: "触发方式", dataIndex: "trigger_type", key: "trigger_type", render: translateTriggerType },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "对象数量", key: "asset_scope", render: (_, record) => record.asset_scope.length },
    {
      title: "责任归属",
      key: "assignment_summary",
      render: (_, record) => (
        <Space wrap size={4}>
          {(record.assignment_summary ?? []).slice(0, 3).map((assignment) => (
            <Tag key={assignment.asset_id} color="blue">
              {assignment.owner} / {assignment.asset_name}
            </Tag>
          ))}
          {(record.assignment_summary ?? []).length > 3 ? <Tag>+{record.assignment_summary.length - 3}</Tag> : null}
        </Space>
      ),
    },
  ];

  const findingColumns: TableColumnProps<Finding>[] = [
    { title: "问题标题", dataIndex: "title", key: "title" },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", render: formatDateTime },
  ];

  const resultColumns: TableColumnProps<RuleRunResult>[] = [
    { title: "对象编号", key: "asset_id", dataIndex: "asset_id" },
    {
      title: "命中结果",
      key: "matched",
      render: (_, record) => (record.matched ? <Tag color="orangered">命中</Tag> : <Tag color="blue">通过</Tag>),
    },
    { title: "严重级别", key: "severity", render: (_, record) => <SeverityTag value={record.severity} /> },
    { title: "摘要", dataIndex: "summary", key: "summary" },
  ];

  const ruleVersionColumns: TableColumnProps<RuleSetVersion>[] = [
    { title: "版本", dataIndex: "version", key: "version" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "生效时间", dataIndex: "effective_from", key: "effective_from", render: formatDateTime },
    { title: "记录时间", dataIndex: "created_at", key: "created_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Button
          size="mini"
          loading={rollbackRuleVersionMutation.isPending}
          onClick={() => {
            Modal.confirm({
              title: "回滚规则版本",
              content: `确认从版本 ${record.version} 回滚？系统会生成新的版本快照，历史记录不会被覆盖。`,
              onOk: () => rollbackRuleVersionMutation.mutate(record.id),
            });
          }}
        >
          回滚
        </Button>
      ),
    },
  ];

  const selectedRule = (rulesQuery.data ?? []).find((rule) => rule.id === selectedRuleId) ?? null;
  const selectedInspection = inspectionsQuery.data?.items.find((inspection) => inspection.id === selectedInspectionId) ?? null;
  const ruleVersionOptions = (ruleVersionsQuery.data ?? []).map((version) => ({
    label: `${version.version} / ${formatDateTime(version.created_at)}`,
    value: version.id,
  }));
  const activeInspections = (inspectionsQuery.data?.items ?? []).filter(
    (inspection) => inspection.status === "queued" || inspection.status === "processing",
  ).length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="规则巡检"
          title="规则巡检"
          description="维护规则集、发起巡检、查看发现和执行结果。"
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
              <Button type="outline" onClick={() => setIsInspectionModalOpen(true)}>
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
            <SectionTitle title="规则集" subtitle="维护规则元数据和启停状态。" />
            {rulesQuery.isLoading ? (
              <LoadingBlock label="正在加载规则集" />
            ) : rulesQuery.error ? (
              <QueryErrorNotice error={rulesQuery.error} />
            ) : (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Table
                  rowKey="id"
                  columns={ruleColumns}
                  data={rulesQuery.data ?? []}
                  pagination={false}
                  size="small"
                  onRow={(record) => ({
                    onClick: () => setSelectedRuleId(record.id),
                    style: selectedRowStyle(record.id === selectedRuleId),
                  })}
                />
                <div>
                  <SectionTitle title="版本历史" subtitle="每次创建或更新都会保留一份规则快照。" />
                  {ruleVersionsQuery.isLoading ? (
                    <LoadingBlock label="正在加载版本历史" />
                  ) : ruleVersionsQuery.error ? (
                    <QueryErrorNotice error={ruleVersionsQuery.error} />
                  ) : (
                    <Space direction="vertical" size="medium" style={{ width: "100%" }}>
                      <Space wrap>
                        <Select
                          placeholder="基准版本"
                          value={baseRuleVersionId}
                          options={ruleVersionOptions}
                          style={{ width: 230 }}
                          onChange={(value) => {
                            setBaseRuleVersionId(value);
                            setRuleVersionDiff(null);
                          }}
                        />
                        <Select
                          placeholder="对比版本"
                          value={compareRuleVersionId}
                          options={ruleVersionOptions}
                          style={{ width: 230 }}
                          onChange={(value) => {
                            setCompareRuleVersionId(value);
                            setRuleVersionDiff(null);
                          }}
                        />
                        <Button
                          type="primary"
                          disabled={!baseRuleVersionId || !compareRuleVersionId || baseRuleVersionId === compareRuleVersionId}
                          loading={diffRuleVersionMutation.isPending}
                          onClick={() => diffRuleVersionMutation.mutate()}
                        >
                          查看差异
                        </Button>
                      </Space>
                      {ruleVersionDiff ? <JsonBlock value={ruleVersionDiff} /> : null}
                      <Table
                        rowKey="id"
                        columns={ruleVersionColumns}
                        data={ruleVersionsQuery.data ?? []}
                        pagination={false}
                        size="small"
                        expandedRowRender={(record) => <JsonBlock value={record.snapshot} />}
                      />
                    </Space>
                  )}
                </div>
              </Space>
            )}
          </Col>
          <Col xs={24} xl={14}>
            <SectionTitle title="巡检任务" subtitle="后端写入队列，数据服务异步执行。" />
            {inspectionsQuery.isLoading ? (
              <LoadingBlock label="正在加载巡检任务" />
            ) : inspectionsQuery.error ? (
              <QueryErrorNotice error={inspectionsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={inspectionColumns}
                data={inspectionsQuery.data?.items ?? []}
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
            <SectionTitle title="巡检发现" subtitle="查看命中问题并进入闭环处置。" />
            {findingsQuery.isLoading ? (
              <LoadingBlock label="正在加载问题列表" />
            ) : findingsQuery.error ? (
              <QueryErrorNotice error={findingsQuery.error} />
            ) : (
              <Table rowKey="id" columns={findingColumns} data={findingsQuery.data?.items ?? []} pagination={false} size="small" />
            )}
          </section>
        </Col>
        <Col xs={24} xl={12}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="规则执行结果" subtitle="按对象查看执行结论、命中范围和摘要。" />
            {resultsQuery.isLoading ? (
              <LoadingBlock label="正在加载规则执行结果" />
            ) : resultsQuery.error ? (
              <QueryErrorNotice error={resultsQuery.error} />
            ) : (
              <Table rowKey="id" columns={resultColumns} data={resultsQuery.data ?? []} pagination={false} size="small" />
            )}
          </section>
        </Col>
      </Row>

      <section style={panelStyle(mode)}>
        <SectionTitle title="智能巡检草稿" subtitle="辅助归纳，最终判定以人工复核为准。" />
        {aiQuery.isLoading ? (
          <LoadingBlock label="正在加载智能草稿" />
        ) : aiQuery.error ? (
          <QueryErrorNotice error={aiQuery.error} />
        ) : (
          <DraftSummaries jobs={aiQuery.data} />
        )}
      </section>

      <Modal
        visible={isRuleModalOpen}
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
          onSubmit={(values) => {
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
              messageApi.error("规则定义必须是合法的结构化规则文本。");
            }
          }}
        >
          <Form.Item field="name" label="规则集名称" rules={[{ required: true, message: "请输入规则集名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="category" label="分类" rules={[{ required: true, message: "请输入分类" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="version" label="版本" rules={[{ required: true, message: "请输入版本号" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="risk_level" label="风险级别" rules={[{ required: true, message: "请选择风险级别" }]}>
            <Select options={riskOptions} />
          </Form.Item>
          <Form.Item field="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "启用", value: "active" }, { label: "草稿", value: "draft" }]} />
          </Form.Item>
          <Form.Item field="scope" label="适用范围" rules={[{ required: true, message: "请输入适用范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            field="definitionText"
            label="结构化规则定义"
            rules={[{ required: true, message: "请输入结构化规则定义" }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isRuleEditModalOpen}
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
          onSubmit={(values) => {
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
              messageApi.error("规则定义必须是合法的结构化规则文本。");
            }
          }}
        >
          <Form.Item field="name" label="规则集名称" rules={[{ required: true, message: "请输入规则集名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="category" label="分类" rules={[{ required: true, message: "请输入分类" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="version" label="版本" rules={[{ required: true, message: "请输入版本号" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="risk_level" label="风险级别" rules={[{ required: true, message: "请选择风险级别" }]}>
            <Select options={riskOptions} />
          </Form.Item>
          <Form.Item field="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "启用", value: "active" }, { label: "草稿", value: "draft" }]} />
          </Form.Item>
          <Form.Item field="scope" label="适用范围" rules={[{ required: true, message: "请输入适用范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            field="definitionText"
            label="结构化规则定义"
            rules={[{ required: true, message: "请输入结构化规则定义" }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isInspectionModalOpen}
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
          onSubmit={(values) => {
            createInspectionMutation.mutate(values);
          }}
        >
          <Form.Item field="name" label="巡检名称" rules={[{ required: true, message: "请输入巡检名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="trigger_type" label="触发方式" rules={[{ required: true, message: "请选择触发方式" }]}>
            <Select options={[{ label: "手动", value: "manual" }, { label: "定时", value: "scheduled" }]} />
          </Form.Item>
          <Form.Item field="rule_set_id" label="规则集" rules={[{ required: true, message: "请选择规则集" }]}>
            <Select
              options={(rulesQuery.data ?? []).map((rule) => ({
                label: `${rule.name} / ${rule.version}`,
                value: rule.id,
              }))}
            />
          </Form.Item>
          <Form.Item field="asset_scope" label="治理对象范围" rules={[{ required: true, message: "请至少选择一个治理对象" }]}>
            <Select
              mode="multiple"
              options={(assetsQuery.data?.items ?? []).map((asset) => ({
                label: `${asset.name} / ${asset.asset_type}`,
                value: asset.id,
              }))}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            巡检创建后会先在后端记录排队状态，再交由数据服务独立执行与回写。
          </Typography.Paragraph>
        </Form>
      </Modal>
    </Space>
  );
}
