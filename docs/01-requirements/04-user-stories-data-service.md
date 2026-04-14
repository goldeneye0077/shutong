# Data-Service 系统故事

## 1. 服务目标

data-service 是内部处理域，负责消费 `job_queue`、执行解析和规则引擎、生成报告与 AI 后置分析结果，并将结果写回 PostgreSQL 与导出目录。

## 2. 系统故事

### 2.1 任务认领

- 作为 data-service，我希望以 `SELECT ... FOR UPDATE SKIP LOCKED` 的方式认领任务，以便多实例下不重复处理同一任务。
- 作为 data-service，我希望为任务保留状态、尝试次数和错误原因，以便实现可观测和幂等重试。

### 2.2 配置解析与标准化

- 作为 data-service，我希望针对 CSW、BSW、OMSW、OMFW 使用可扩展 parser adapter，以便兼容多类型配置语法。
- 作为 data-service，我希望将配置解析结果映射为统一结构，以便规则引擎和后续报告复用。
- 作为 data-service，我希望记录解析失败和字段缺失信息，以便 backend 和 frontend 提供问题提示。

### 2.3 规则执行与调度

- 作为 data-service，我希望按规则版本和对象范围执行巡检，以便支持临时任务和周期任务共存。
- 作为 data-service，我希望把规则命中结果写回 findings 和结果表，以便闭环与驾驶舱消费。

### 2.4 报告与 AI

- 作为 data-service，我希望按导出任务生成问题清单、管理摘要和迎检资料，以便 backend 只做状态协调。
- 作为 data-service，我希望将 AI 归纳作为独立任务类型处理，并要求人工确认后才能对外使用，以便严格控制边界。

## 3. 验收标准

- data-service 不需要前端直接访问即可独立完成任务处理。
- 同一任务在并发 worker 下不能被重复消费。
- 解析、规则执行、报告生成、AI 分析四类任务的输入输出边界清晰。
- 失败任务保留错误上下文，允许后续重试和复盘。

