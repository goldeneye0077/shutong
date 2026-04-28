import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Descriptions,
  Empty,
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
  translateSource,
} from "../app/ui";
import {
  createAsset,
  deleteAsset,
  diffConfigs,
  listAssets,
  listConfigAiSummaries,
  listConfigs,
  listNormalizedConfigs,
  listParseRuns,
  searchNormalizedConfigs,
  updateAsset,
  uploadConfigsBulk,
} from "../services/api";
import type {
  Asset,
  AssetCreatePayload,
  AssetUpdatePayload,
  ConfigDiff,
  ConfigFile,
  NormalizedConfigSearchItem,
  ParseRun,
  ParseWarning,
} from "../types/api";
import type { ThemeMode } from "../theme/theme";

const assetTypeOptions = [
  { label: "CSW", value: "CSW" },
  { label: "OMFW", value: "OMFW" },
  { label: "CMNET", value: "CMNET" },
  { label: "PE", value: "PE" },
];

const statusOptions = [
  { label: "启用", value: "active" },
  { label: "维护中", value: "maintenance" },
  { label: "已退役", value: "retired" },
  { label: "已删除", value: "deleted" },
];

const { Row, Col } = Grid;

interface ParseWarningRow extends ParseWarning {
  key: string;
  parser_name: string;
}

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

function isParseWarning(value: unknown): value is ParseWarning {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ParseWarning>;
  return (
    typeof item.line_no === "number" &&
    typeof item.code === "string" &&
    typeof item.message === "string" &&
    typeof item.line === "string"
  );
}

function getParseWarnings(parseRuns: ParseRun[] | undefined): ParseWarningRow[] {
  return (parseRuns ?? []).flatMap((run) => {
    const warnings = run.summary.warnings;
    if (!Array.isArray(warnings)) {
      return [];
    }

    return warnings.filter(isParseWarning).map((warning, index) => ({
      ...warning,
      key: `${run.id}-${warning.line_no}-${warning.code}-${index}`,
      parser_name: run.parser_name,
    }));
  });
}

export function AssetsPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [assetForm] = Form.useForm<AssetCreatePayload>();
  const [assetEditForm] = Form.useForm<AssetUpdatePayload>();
  const [uploadForm] = Form.useForm<{ source: string }>();
  const messageApi = Message;
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = React.useState<string | null>(null);
  const [assetSearch, setAssetSearch] = React.useState("");
  const [assetTypeFilter, setAssetTypeFilter] = React.useState<string | undefined>();
  const [assetStatusFilter, setAssetStatusFilter] = React.useState<string | undefined>();
  const [isAssetModalOpen, setIsAssetModalOpen] = React.useState(false);
  const [isAssetEditModalOpen, setIsAssetEditModalOpen] = React.useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [uploadFiles, setUploadFiles] = React.useState<File[]>([]);
  const [baseConfigId, setBaseConfigId] = React.useState<string | undefined>();
  const [compareConfigId, setCompareConfigId] = React.useState<string | undefined>();
  const [diffResult, setDiffResult] = React.useState<ConfigDiff | null>(null);
  const [normalizedSearchKeyword, setNormalizedSearchKeyword] = React.useState("");
  const [normalizedSearchSection, setNormalizedSearchSection] = React.useState<string | undefined>();

  const assetsQuery = useQuery({
    queryKey: ["assets", accessToken, "page", assetSearch, assetTypeFilter, assetStatusFilter],
    queryFn: () =>
      listAssets(accessToken!, {
        search: assetSearch.trim() || undefined,
        asset_type: assetTypeFilter,
        status: assetStatusFilter,
        include_deleted: assetStatusFilter === "deleted",
      }),
    enabled: Boolean(accessToken),
  });

  React.useEffect(() => {
    const firstAssetId = assetsQuery.data?.items[0]?.id ?? null;
    if (!selectedAssetId || !assetsQuery.data?.items.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(firstAssetId);
    }
  }, [assetsQuery.data, selectedAssetId]);

  const configsQuery = useQuery({
    queryKey: ["configs", accessToken, selectedAssetId],
    queryFn: () => listConfigs(accessToken!, selectedAssetId!),
    enabled: Boolean(accessToken && selectedAssetId),
    refetchInterval: (query) =>
      getActiveRefetchInterval(
        (((query.state.data as { items?: ConfigFile[] } | undefined)?.items ?? []).map((item) => item.processing_status)),
      ),
  });

  React.useEffect(() => {
    const firstConfigId = configsQuery.data?.items[0]?.id ?? null;
    if (!selectedConfigId || !configsQuery.data?.items.some((config) => config.id === selectedConfigId)) {
      setSelectedConfigId(firstConfigId);
    }
  }, [configsQuery.data, selectedConfigId]);

  React.useEffect(() => {
    const sortedConfigs = (configsQuery.data?.items ?? []).slice().sort((left, right) => left.version - right.version);
    setBaseConfigId(sortedConfigs[0]?.id);
    setCompareConfigId(sortedConfigs[1]?.id ?? sortedConfigs[0]?.id);
    setDiffResult(null);
  }, [configsQuery.data, selectedAssetId]);

  const selectedConfigStatus = configsQuery.data?.items.find((item) => item.id === selectedConfigId)?.processing_status;

  const parseRunsQuery = useQuery({
    queryKey: ["parse-runs", accessToken, selectedConfigId],
    queryFn: () => listParseRuns(accessToken!, selectedConfigId!),
    enabled: Boolean(accessToken && selectedConfigId),
    refetchInterval: getActiveRefetchInterval([selectedConfigStatus]),
  });
  const normalizedQuery = useQuery({
    queryKey: ["normalized-configs", accessToken, selectedConfigId],
    queryFn: () => listNormalizedConfigs(accessToken!, selectedConfigId!),
    enabled: Boolean(accessToken && selectedConfigId),
    refetchInterval: getActiveRefetchInterval([selectedConfigStatus]),
  });
  const normalizedSearchQuery = useQuery({
    queryKey: ["normalized-config-search", accessToken, selectedAssetId, normalizedSearchKeyword, normalizedSearchSection],
    queryFn: () =>
      searchNormalizedConfigs(accessToken!, {
        asset_id: selectedAssetId ?? undefined,
        keyword: normalizedSearchKeyword.trim() || undefined,
        section: normalizedSearchSection,
      }),
    enabled: Boolean(accessToken && selectedAssetId),
  });
  const aiQuery = useQuery({
    queryKey: ["config-ai", accessToken, selectedConfigId],
    queryFn: () => listConfigAiSummaries(accessToken!, selectedConfigId!),
    enabled: Boolean(accessToken && selectedConfigId),
    refetchInterval: getActiveRefetchInterval([selectedConfigStatus]),
  });

  const createAssetMutation = useMutation({
    mutationFn: (payload: AssetCreatePayload) => createAsset(accessToken!, payload),
    onSuccess: async (asset) => {
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      setSelectedAssetId(asset.id);
      setIsAssetModalOpen(false);
      assetForm.resetFields();
      messageApi.success("治理对象已创建。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "治理对象创建失败。");
    },
  });

  const uploadConfigMutation = useMutation({
    mutationFn: (payload: { assetId: string; source: string; files: File[] }) => uploadConfigsBulk(accessToken!, payload),
    onSuccess: async (configFiles) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["configs"] }),
        queryClient.invalidateQueries({ queryKey: ["parse-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["normalized-configs"] }),
        queryClient.invalidateQueries({ queryKey: ["config-ai"] }),
      ]);
      setSelectedConfigId(configFiles[configFiles.length - 1]?.id ?? null);
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      uploadForm.resetFields();
      messageApi.success(`已上传 ${configFiles.length} 个配置快照，解析任务已入队。`);
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "配置上传失败。");
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: (payload: AssetUpdatePayload) => updateAsset(accessToken!, selectedAssetId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      setIsAssetEditModalOpen(false);
      assetEditForm.resetFields();
      messageApi.success("治理对象已更新。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "治理对象更新失败。");
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: () => deleteAsset(accessToken!, selectedAssetId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      setSelectedAssetId(null);
      setSelectedConfigId(null);
      messageApi.success("治理对象已删除，可在已删除筛选中查看留痕。");
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "治理对象删除失败。");
    },
  });

  const diffMutation = useMutation({
    mutationFn: () => diffConfigs(accessToken!, baseConfigId!, compareConfigId!),
    onSuccess: (result) => {
      setDiffResult(result);
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : "配置差异计算失败。");
    },
  });

  const assetColumns: TableColumnProps<Asset>[] = [
    { title: "对象名称", dataIndex: "name", key: "name" },
    { title: "类型", dataIndex: "asset_type", key: "asset_type" },
    { title: "厂商", dataIndex: "vendor", key: "vendor" },
    { title: "责任人", dataIndex: "owner", key: "owner" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
  ];

  const configColumns: TableColumnProps<ConfigFile>[] = [
    { title: "版本", dataIndex: "version", key: "version" },
    { title: "文件名", dataIndex: "filename", key: "filename" },
    { title: "来源", dataIndex: "source", key: "source", render: translateSource },
    { title: "处理状态", key: "processing_status", render: (_, record) => <StatusTag value={record.processing_status} /> },
  ];

  const parseColumns: TableColumnProps<ParseRun>[] = [
    { title: "解析器", dataIndex: "parser_name", key: "parser_name" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "行数", dataIndex: "line_count", key: "line_count" },
    { title: "告警", dataIndex: "warning_count", key: "warning_count" },
    { title: "完成时间", dataIndex: "completed_at", key: "completed_at", render: formatDateTime },
  ];

  const warningColumns: TableColumnProps<ParseWarningRow>[] = [
    { title: "行号", dataIndex: "line_no", key: "line_no", width: 88 },
    {
      title: "告警代码",
      dataIndex: "code",
      key: "code",
      width: 180,
      render: (value) => <Tag color="orangered">{value}</Tag>,
    },
    { title: "说明", dataIndex: "message", key: "message" },
    {
      title: "配置行",
      dataIndex: "line",
      key: "line",
      render: (value) => <Typography.Text code>{value}</Typography.Text>,
    },
  ];
  const normalizedSearchColumns: TableColumnProps<NormalizedConfigSearchItem>[] = [
    { title: "对象", dataIndex: "asset_name", key: "asset_name", width: 160 },
    { title: "配置文件", dataIndex: "filename", key: "filename", width: 180 },
    { title: "主机名", dataIndex: "hostname", key: "hostname", width: 160 },
    {
      title: "命中区域",
      dataIndex: "matched_sections",
      key: "matched_sections",
      width: 180,
      render: (value: string[]) => value.map((item) => <Tag key={item}>{item}</Tag>),
    },
    {
      title: "命中内容",
      dataIndex: "matched_content",
      key: "matched_content",
      render: (value: string[]) => (
        <Space direction="vertical" size={2}>
          {value.slice(0, 3).map((item, index) => (
            <Typography.Text key={`${item}-${index}`} code>
              {item}
            </Typography.Text>
          ))}
        </Space>
      ),
    },
  ];

  const selectedAsset = assetsQuery.data?.items.find((item) => item.id === selectedAssetId) ?? null;
  const selectedConfig = configsQuery.data?.items.find((item) => item.id === selectedConfigId) ?? null;
  const configOptions = (configsQuery.data?.items ?? [])
    .slice()
    .sort((left, right) => left.version - right.version)
    .map((config) => ({
      label: `v${config.version} / ${config.filename}`,
      value: config.id,
    }));
  const normalized = normalizedQuery.data?.[0];
  const totalWarnings = (parseRunsQuery.data ?? []).reduce((count, item) => count + item.warning_count, 0);
  const parseWarnings = React.useMemo(() => getParseWarnings(parseRunsQuery.data), [parseRunsQuery.data]);
  const hasLegacyWarningCount = totalWarnings > 0 && parseWarnings.length === 0;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="对象配置"
          title="对象配置"
          description="维护治理对象、配置版本、解析记录和标准化结果。"
          actions={
            <Space size={[8, 8]} wrap>
              {selectedAsset ? <Tag color="blue">{selectedAsset.name}</Tag> : null}
              {selectedConfig ? <Tag color="gold">v{selectedConfig.version}</Tag> : null}
            </Space>
          }
          metrics={[
            {
              label: "治理对象",
              value: assetsQuery.data?.total ?? 0,
              hint: "当前纳入管理的对象数",
              tone: "accent",
            },
            {
              label: "配置版本",
              value: configsQuery.data?.total ?? 0,
              hint: "当前对象已上传的快照数",
            },
            {
              label: "解析告警",
              value: totalWarnings,
              hint: "当前选中配置累计告警",
              tone: totalWarnings > 0 ? "warning" : "success",
            },
            {
              label: "智能草稿",
              value: aiQuery.data?.length ?? 0,
              hint: "配置解析辅助摘要",
            },
          ]}
        />
      </section>

      <section style={panelStyle(mode)}>
        <Toolbar
          left={
            <>
              <Button type="primary" onClick={() => setIsAssetModalOpen(true)}>
                新建治理对象
              </Button>
              <Button
                disabled={!selectedAsset}
                onClick={() => {
                  if (!selectedAsset) {
                    return;
                  }
                  assetEditForm.setFieldsValue({
                    name: selectedAsset.name,
                    asset_type: selectedAsset.asset_type,
                    vendor: selectedAsset.vendor,
                    status: selectedAsset.status,
                    owner: selectedAsset.owner,
                    scenario: selectedAsset.scenario,
                  });
                  setIsAssetEditModalOpen(true);
                }}
              >
                编辑对象
              </Button>
              <Button disabled={!selectedAssetId} onClick={() => setIsUploadModalOpen(true)}>
                批量上传配置
              </Button>
              <Button
                status="danger"
                disabled={!selectedAssetId || selectedAsset?.status === "deleted"}
                loading={deleteAssetMutation.isPending}
                onClick={() => {
                  if (!selectedAsset) {
                    return;
                  }
                  Modal.confirm({
                    title: "删除治理对象",
                    content: `确认删除 ${selectedAsset.name}？系统会保留审计留痕和历史配置。`,
                    okButtonProps: { status: "danger" },
                    onOk: () => {
                      deleteAssetMutation.mutate();
                    },
                  });
                }}
              >
                删除对象
              </Button>
            </>
          }
          right={
            <>
              {selectedAsset ? <Typography.Text type="secondary">对象：{selectedAsset.asset_type} / {selectedAsset.owner}</Typography.Text> : null}
              {selectedConfig ? <StatusTag value={selectedConfig.processing_status} /> : null}
            </>
          }
        />
        <Toolbar
          left={
            <>
              <Input
                allowClear
                placeholder="搜索对象名称"
                value={assetSearch}
                style={{ width: 220 }}
                onChange={setAssetSearch}
              />
              <Select
                allowClear
                placeholder="对象类型"
                value={assetTypeFilter}
                options={assetTypeOptions}
                style={{ width: 150 }}
                onChange={setAssetTypeFilter}
              />
              <Select
                allowClear
                placeholder="状态"
                value={assetStatusFilter}
                options={statusOptions}
                style={{ width: 150 }}
                onChange={setAssetStatusFilter}
              />
            </>
          }
          right={<Typography.Text type="secondary">支持按名称、类型和状态筛选。</Typography.Text>}
        />
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={11}>
            <SectionTitle title="治理对象" subtitle="选择对象后查看配置版本与解析状态。" />
            {assetsQuery.isLoading ? (
              <LoadingBlock label="正在加载治理对象" />
            ) : assetsQuery.error ? (
              <QueryErrorNotice error={assetsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={assetColumns}
                data={assetsQuery.data?.items ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedAssetId(record.id),
                  style: selectedRowStyle(record.id === selectedAssetId),
                })}
              />
            )}
          </Col>
          <Col xs={24} xl={13}>
            <SectionTitle title="配置版本" subtitle="上传后进入解析队列，状态自动刷新。" />
            {configsQuery.isLoading ? (
              <LoadingBlock label="正在加载配置版本" />
            ) : configsQuery.error ? (
              <QueryErrorNotice error={configsQuery.error} />
            ) : (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Table
                  rowKey="id"
                  columns={configColumns}
                  data={configsQuery.data?.items ?? []}
                  pagination={false}
                  size="small"
                  onRow={(record) => ({
                    onClick: () => setSelectedConfigId(record.id),
                    style: selectedRowStyle(record.id === selectedConfigId),
                  })}
                />
                <div>
                  <SectionTitle title="版本差异" subtitle="选择同一对象的两个配置版本，查看新增与删除的配置行。" />
                  <Space wrap>
                    <Select
                      placeholder="基准版本"
                      value={baseConfigId}
                      options={configOptions}
                      style={{ width: 220 }}
                      onChange={(value) => {
                        setBaseConfigId(value);
                        setDiffResult(null);
                      }}
                    />
                    <Select
                      placeholder="对比版本"
                      value={compareConfigId}
                      options={configOptions}
                      style={{ width: 220 }}
                      onChange={(value) => {
                        setCompareConfigId(value);
                        setDiffResult(null);
                      }}
                    />
                    <Button
                      type="primary"
                      disabled={!baseConfigId || !compareConfigId || baseConfigId === compareConfigId}
                      loading={diffMutation.isPending}
                      onClick={() => diffMutation.mutate()}
                    >
                      查看差异
                    </Button>
                  </Space>
                  {diffResult ? (
                    <Space direction="vertical" size="medium" style={{ width: "100%", marginTop: 14 }}>
                      <KeyValueList
                        items={[
                          { label: "新增行", value: diffResult.added.length },
                          { label: "删除行", value: diffResult.removed.length },
                          { label: "变化总数", value: diffResult.changed_count },
                        ]}
                      />
                      <JsonBlock value={{ added: diffResult.added, removed: diffResult.removed }} />
                    </Space>
                  ) : null}
                </div>
              </Space>
            )}
          </Col>
        </Row>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={13}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="解析记录" subtitle="查看解析器执行历史、失败原因和告警数量。" />
            {parseRunsQuery.isLoading ? (
              <LoadingBlock label="正在加载解析记录" />
            ) : parseRunsQuery.error ? (
              <QueryErrorNotice error={parseRunsQuery.error} />
            ) : (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Table rowKey="id" columns={parseColumns} data={parseRunsQuery.data ?? []} pagination={false} size="small" />
                {parseWarnings.length ? (
                  <div>
                    <SectionTitle title="告警详情" subtitle="按解析器回传的原始行号定位配置风险。" />
                    <Table
                      rowKey="key"
                      columns={warningColumns}
                      data={parseWarnings}
                      pagination={false}
                      size="small"
                    />
                  </div>
                ) : hasLegacyWarningCount ? (
                  <Alert
                    type="warning"
                    content="当前解析记录只有告警数量，没有告警明细。请重新上传或重新解析该配置后查看行号、代码和配置行。"
                  />
                ) : null}
              </Space>
            )}
          </section>
        </Col>
        <Col xs={24} xl={11}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="标准化结果" subtitle="展示主机名、接口量和指标摘要。" />
            {normalizedQuery.isLoading ? (
              <LoadingBlock label="正在加载标准化结果" />
            ) : normalizedQuery.error ? (
              <QueryErrorNotice error={normalizedQuery.error} />
            ) : !normalized ? (
              <Empty description="当前版本还没有标准化结果" />
            ) : (
              <Space direction="vertical" size="medium" style={{ width: "100%" }}>
                <KeyValueList
                  items={[
                    { label: "主机名", value: normalized.hostname || "-" },
                    { label: "配置版本", value: normalized.config_version },
                    { label: "接口数量", value: normalized.interface_count },
                    { label: "更新时间", value: formatDateTime(normalized.updated_at) },
                  ]}
                />
                <Descriptions
                  size="small"
                  column={1}
                  data={[
                    { key: "asset", label: "当前对象", value: selectedAsset?.name ?? "-" },
                    { key: "config", label: "当前配置", value: selectedConfig?.filename ?? "-" },
                  ]}
                />
                <JsonBlock value={normalized.indicators} />
              </Space>
            )}
          </section>
        </Col>
      </Row>

      <section style={panelStyle(mode)}>
        <SectionTitle title="解析结果检索" subtitle="按当前对象、关键字和结果区域检索标准化配置，不依赖外部搜索引擎。" />
        <Toolbar
          left={
            <>
              <Input
                allowClear
                placeholder="输入主机名、接口、ACL、告警代码或关键字"
                value={normalizedSearchKeyword}
                style={{ width: 340 }}
                onChange={setNormalizedSearchKeyword}
              />
              <Select
                allowClear
                placeholder="命中区域"
                value={normalizedSearchSection}
                style={{ width: 160 }}
                options={[
                  { label: "接口", value: "interfaces" },
                  { label: "ACL/策略", value: "acl" },
                  { label: "告警", value: "warnings" },
                  { label: "关键字", value: "keywords" },
                  { label: "摘要", value: "summary" },
                ]}
                onChange={setNormalizedSearchSection}
              />
            </>
          }
          right={<Typography.Text type="secondary">默认限定当前治理对象：{selectedAsset?.name ?? "-"}</Typography.Text>}
        />
        {normalizedSearchQuery.isLoading ? (
          <LoadingBlock label="正在检索解析结果" />
        ) : normalizedSearchQuery.error ? (
          <QueryErrorNotice error={normalizedSearchQuery.error} />
        ) : (
          <Table
            rowKey="id"
            columns={normalizedSearchColumns}
            data={normalizedSearchQuery.data?.items ?? []}
            pagination={false}
            size="small"
          />
        )}
      </section>

      <section style={panelStyle(mode)}>
        <SectionTitle title="智能草稿摘要" subtitle="辅助归纳，需人工确认后采用。" />
        {aiQuery.isLoading ? (
          <LoadingBlock label="正在加载智能草稿" />
        ) : aiQuery.error ? (
          <QueryErrorNotice error={aiQuery.error} />
        ) : (
          <DraftSummaries jobs={aiQuery.data} />
        )}
      </section>

      <Modal
        visible={isAssetModalOpen}
        title="新建治理对象"
        okText="创建"
        confirmLoading={createAssetMutation.isPending}
        onCancel={() => {
          setIsAssetModalOpen(false);
          assetForm.resetFields();
        }}
        onOk={() => {
          void assetForm.submit();
        }}
      >
        <Form
          form={assetForm}
          layout="vertical"
          initialValues={{ asset_type: "CSW", status: "active", vendor: "Huawei", scenario: "monthly-check" }}
          onSubmit={(values) => {
            createAssetMutation.mutate(values);
          }}
        >
          <Form.Item field="name" label="对象名称" rules={[{ required: true, message: "请输入对象名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="asset_type" label="对象类型" rules={[{ required: true, message: "请选择对象类型" }]}>
            <Select options={assetTypeOptions} />
          </Form.Item>
          <Form.Item field="vendor" label="厂商" rules={[{ required: true, message: "请输入厂商" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item field="owner" label="责任人" rules={[{ required: true, message: "请输入责任人" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="scenario" label="场景" rules={[{ required: true, message: "请输入场景" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isAssetEditModalOpen}
        title="编辑治理对象"
        okText="保存"
        confirmLoading={updateAssetMutation.isPending}
        onCancel={() => {
          setIsAssetEditModalOpen(false);
          assetEditForm.resetFields();
        }}
        onOk={() => {
          void assetEditForm.submit();
        }}
      >
        <Form
          form={assetEditForm}
          layout="vertical"
          onSubmit={(values) => {
            updateAssetMutation.mutate(values);
          }}
        >
          <Form.Item field="name" label="对象名称" rules={[{ required: true, message: "请输入对象名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="asset_type" label="对象类型" rules={[{ required: true, message: "请选择对象类型" }]}>
            <Select options={assetTypeOptions} />
          </Form.Item>
          <Form.Item field="vendor" label="厂商" rules={[{ required: true, message: "请输入厂商" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item field="owner" label="责任人" rules={[{ required: true, message: "请输入责任人" }]}>
            <Input />
          </Form.Item>
          <Form.Item field="scenario" label="场景" rules={[{ required: true, message: "请输入场景" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={isUploadModalOpen}
        title="批量上传配置快照"
        okText="上传"
        okButtonProps={{ disabled: !selectedAssetId }}
        confirmLoading={uploadConfigMutation.isPending}
        onCancel={() => {
          setIsUploadModalOpen(false);
          setUploadFiles([]);
          uploadForm.resetFields();
        }}
        onOk={() => {
          void uploadForm.submit();
        }}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{ source: "manual" }}
          onSubmit={(values) => {
            if (!selectedAssetId || uploadFiles.length === 0) {
              messageApi.warning("请先选择治理对象并上传至少一个配置文件。");
              return;
            }
            uploadConfigMutation.mutate({ assetId: selectedAssetId, source: values.source, files: uploadFiles });
          }}
        >
          <Form.Item label="当前治理对象">
            <Input value={selectedAsset ? `${selectedAsset.name} / ${selectedAsset.asset_type}` : ""} disabled />
          </Form.Item>
          <Form.Item field="source" label="来源" rules={[{ required: true, message: "请选择来源" }]}>
            <Select options={[{ label: "人工上传", value: "manual" }, { label: "同步导入", value: "sync" }]} />
          </Form.Item>
          <Form.Item label="配置文件" required>
            <input
              className="shell-input"
              type="file"
              multiple
              accept=".txt,.cfg,.conf,.log"
              onChange={(event) => {
                setUploadFiles(Array.from(event.target.files ?? []));
              }}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
              可一次选择多个配置文件。上传后会逐个生成配置版本并创建解析队列任务。
            </Typography.Paragraph>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
