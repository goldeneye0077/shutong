import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "antd/es/button";
import Col from "antd/es/col";
import Descriptions from "antd/es/descriptions";
import Empty from "antd/es/empty";
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
  listAssets,
  listConfigAiSummaries,
  listConfigs,
  listNormalizedConfigs,
  listParseRuns,
  updateAsset,
  uploadConfig,
} from "../services/api";
import type { Asset, AssetCreatePayload, AssetUpdatePayload, ConfigFile, ParseRun } from "../types/api";
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
];

function selectedRowStyle(selected: boolean): React.CSSProperties | undefined {
  if (!selected) {
    return undefined;
  }

  return { cursor: "pointer", background: "var(--shell-row-hover)" };
}

export function AssetsPage({ mode }: { mode: ThemeMode }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [assetForm] = Form.useForm<AssetCreatePayload>();
  const [assetEditForm] = Form.useForm<AssetUpdatePayload>();
  const [uploadForm] = Form.useForm<{ source: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = React.useState<string | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = React.useState(false);
  const [isAssetEditModalOpen, setIsAssetEditModalOpen] = React.useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  const assetsQuery = useQuery({
    queryKey: ["assets", accessToken, "page"],
    queryFn: () => listAssets(accessToken!),
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
    mutationFn: (payload: { assetId: string; source: string; file: File }) => uploadConfig(accessToken!, payload),
    onSuccess: async (configFile) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["configs"] }),
        queryClient.invalidateQueries({ queryKey: ["parse-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["normalized-configs"] }),
        queryClient.invalidateQueries({ queryKey: ["config-ai"] }),
      ]);
      setSelectedConfigId(configFile.id);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      uploadForm.resetFields();
      messageApi.success("配置快照已上传，解析任务已入队。");
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

  const assetColumns: ColumnsType<Asset> = [
    { title: "对象名称", dataIndex: "name", key: "name" },
    { title: "类型", dataIndex: "asset_type", key: "asset_type" },
    { title: "厂商", dataIndex: "vendor", key: "vendor" },
    { title: "责任人", dataIndex: "owner", key: "owner" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
  ];

  const configColumns: ColumnsType<ConfigFile> = [
    { title: "版本", dataIndex: "version", key: "version" },
    { title: "文件名", dataIndex: "filename", key: "filename" },
    { title: "来源", dataIndex: "source", key: "source", render: translateSource },
    { title: "处理状态", key: "processing_status", render: (_, record) => <StatusTag value={record.processing_status} /> },
  ];

  const parseColumns: ColumnsType<ParseRun> = [
    { title: "解析器", dataIndex: "parser_name", key: "parser_name" },
    { title: "状态", key: "status", render: (_, record) => <StatusTag value={record.status} /> },
    { title: "行数", dataIndex: "line_count", key: "line_count" },
    { title: "告警", dataIndex: "warning_count", key: "warning_count" },
    { title: "完成时间", dataIndex: "completed_at", key: "completed_at", render: formatDateTime },
  ];

  const selectedAsset = assetsQuery.data?.items.find((item) => item.id === selectedAssetId) ?? null;
  const selectedConfig = configsQuery.data?.items.find((item) => item.id === selectedConfigId) ?? null;
  const normalized = normalizedQuery.data?.[0];
  const totalWarnings = (parseRunsQuery.data ?? []).reduce((count, item) => count + item.warning_count, 0);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {contextHolder}

      <section style={panelStyle(mode)}>
        <PageHeader
          eyebrow="Assets"
          title="对象与配置"
          description="把治理对象、配置快照、解析记录和标准化结果放在同一条浏览链路里，方便从对象直接追到配置质量。"
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
              label: "AI 草稿",
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
                上传配置
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
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={11}>
            <SectionTitle title="治理对象" subtitle="先选对象，再看它的配置版本与解析结果。" />
            {assetsQuery.isLoading ? (
              <LoadingBlock label="正在加载治理对象" />
            ) : assetsQuery.error ? (
              <QueryErrorNotice error={assetsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={assetColumns}
                dataSource={assetsQuery.data?.items ?? []}
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
            <SectionTitle title="配置版本" subtitle="配置文件上传后会进入解析队列，状态变化会自动刷新。" />
            {configsQuery.isLoading ? (
              <LoadingBlock label="正在加载配置版本" />
            ) : configsQuery.error ? (
              <QueryErrorNotice error={configsQuery.error} />
            ) : (
              <Table
                rowKey="id"
                columns={configColumns}
                dataSource={configsQuery.data?.items ?? []}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedConfigId(record.id),
                  style: selectedRowStyle(record.id === selectedConfigId),
                })}
              />
            )}
          </Col>
        </Row>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={13}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="解析记录" subtitle="按版本查看 parser 执行历史，便于快速定位排队、失败或告警过多的快照。" />
            {parseRunsQuery.isLoading ? (
              <LoadingBlock label="正在加载解析记录" />
            ) : parseRunsQuery.error ? (
              <QueryErrorNotice error={parseRunsQuery.error} />
            ) : (
              <Table rowKey="id" columns={parseColumns} dataSource={parseRunsQuery.data ?? []} pagination={false} size="small" />
            )}
          </section>
        </Col>
        <Col xs={24} xl={11}>
          <section style={panelStyle(mode)}>
            <SectionTitle title="标准化结果" subtitle="从原始配置抽取出来的主机名、接口量与指标摘要都在这里统一展示。" />
            {normalizedQuery.isLoading ? (
              <LoadingBlock label="正在加载标准化结果" />
            ) : normalizedQuery.error ? (
              <QueryErrorNotice error={normalizedQuery.error} />
            ) : !normalized ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前版本还没有标准化结果" />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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
                  items={[
                    { key: "asset", label: "当前对象", children: selectedAsset?.name ?? "-" },
                    { key: "config", label: "当前配置", children: selectedConfig?.filename ?? "-" },
                  ]}
                />
                <JsonBlock value={normalized.indicators} />
              </Space>
            )}
          </section>
        </Col>
      </Row>

      <section style={panelStyle(mode)}>
        <SectionTitle title="AI 草稿摘要" subtitle="AI 只做辅助归纳，默认保持待人工确认状态，不直接成为最终结论。" />
        {aiQuery.isLoading ? (
          <LoadingBlock label="正在加载 AI 草稿" />
        ) : aiQuery.error ? (
          <QueryErrorNotice error={aiQuery.error} />
        ) : (
          <DraftSummaries jobs={aiQuery.data} />
        )}
      </section>

      <Modal
        open={isAssetModalOpen}
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
          onFinish={(values) => {
            createAssetMutation.mutate(values);
          }}
        >
          <Form.Item name="name" label="对象名称" rules={[{ required: true, message: "请输入对象名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="asset_type" label="对象类型" rules={[{ required: true, message: "请选择对象类型" }]}>
            <Select options={assetTypeOptions} />
          </Form.Item>
          <Form.Item name="vendor" label="厂商" rules={[{ required: true, message: "请输入厂商" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="owner" label="责任人" rules={[{ required: true, message: "请输入责任人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scenario" label="场景" rules={[{ required: true, message: "请输入场景" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isAssetEditModalOpen}
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
          onFinish={(values) => {
            updateAssetMutation.mutate(values);
          }}
        >
          <Form.Item name="name" label="对象名称" rules={[{ required: true, message: "请输入对象名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="asset_type" label="对象类型" rules={[{ required: true, message: "请选择对象类型" }]}>
            <Select options={assetTypeOptions} />
          </Form.Item>
          <Form.Item name="vendor" label="厂商" rules={[{ required: true, message: "请输入厂商" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="owner" label="责任人" rules={[{ required: true, message: "请输入责任人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scenario" label="场景" rules={[{ required: true, message: "请输入场景" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isUploadModalOpen}
        title="上传配置快照"
        okText="上传"
        okButtonProps={{ disabled: !selectedAssetId }}
        confirmLoading={uploadConfigMutation.isPending}
        onCancel={() => {
          setIsUploadModalOpen(false);
          setUploadFile(null);
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
          onFinish={(values) => {
            if (!selectedAssetId || !uploadFile) {
              messageApi.warning("请先选择治理对象并上传配置文件。");
              return;
            }
            uploadConfigMutation.mutate({ assetId: selectedAssetId, source: values.source, file: uploadFile });
          }}
        >
          <Form.Item label="当前治理对象">
            <Input value={selectedAsset ? `${selectedAsset.name} / ${selectedAsset.asset_type}` : ""} disabled />
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true, message: "请选择来源" }]}>
            <Select options={[{ label: "人工上传", value: "manual" }, { label: "同步导入", value: "sync" }]} />
          </Form.Item>
          <Form.Item label="配置文件" required>
            <input
              className="shell-input"
              type="file"
              accept=".txt,.cfg,.conf,.log"
              onChange={(event) => {
                setUploadFile(event.target.files?.[0] ?? null);
              }}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
              上传后会先由 backend 落库并创建队列任务，再交由 data-service 进行解析与标准化。
            </Typography.Paragraph>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
