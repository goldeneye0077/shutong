# M14-12 性能验收报告

- 运行编号：`PERF-20260428013223`
- 开始时间：2026/4/28 09:32:23
- 完成时间：2026/4/28 09:32:25
- Backend：`http://localhost:8000/api/v1`
- Data-Service：`http://localhost:8010`

## 输入规模

- 治理对象：4
- 配置文件：4
- 规则集：2
- 巡检任务：2

## 输出结果

- 问题记录：8
- 报告产物：3
- 报告任务：`d4ddfbef-4ffd-46d6-a2fd-78b28404f43a`
- 队列状态：pending=0，processing=0，failed=0

## 分阶段耗时

| 阶段 | 耗时 |
|------|------|
| 登录与服务可用性 | 147ms |
| 创建治理对象 | 48ms |
| 上传配置文件 | 249ms |
| 解析配置与 AI 摘要 | 771ms |
| 创建规则集 | 20ms |
| 发起巡检任务 | 21ms |
| 执行巡检与 AI 摘要 | 315ms |
| 查询问题结果 | 8ms |
| 生成报告产物 | 145ms |
| 校验报告产物 | 7ms |
| 总计 | 1.73s |

## 验收结论

- 本脚本使用真实 backend、data-service、PostgreSQL 和 job_queue，不 mock 处理逻辑。
- 默认规模用于日常交付验收；可通过 `PERF_ASSET_COUNT`、`PERF_RULE_COUNT` 放大样本。
- JSON 原始结果写入 `tests/performance/.last-result.json`，gzip 后大小约 563 bytes。
