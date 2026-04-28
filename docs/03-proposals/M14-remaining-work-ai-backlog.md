# M14 Remaining Work AI Execution Backlog

## 用途

本文件用于承接当前项目剩余未完成事项。每个条目都按 AI 可执行任务描述，包含目标、边界、建议修改位置、验收标准、回归要求和可直接复制的执行 Prompt。

执行顺序建议从 `M14-01` 到 `M14-12`。除非用户明确要求合并，否则每轮只做一个任务，避免跨模块改动过大导致回归困难。

当前执行备注：
- `M14-01` 到 `M14-10` 已按后续实现轮次完成核心闭环。
- 原 backlog 中的迁移严谨化已在用户口径 `M14-11：数据库迁移与部署验收硬化` 中完成。
- 用户口径 `M14-12` 已合并完成性能验收、三次点击易用性验收和前端包体积收口。

## M0 全局控制 Prompt

```text
你正在实现“核心网配置安全合规平台”，仓库为 Monorepo，三域为 frontend、backend、data-service。

固定技术栈：
- frontend：React + Vite + TypeScript + Arco Design，不引入新的大型 UI 库。
- backend：Python 3.12 + FastAPI + SQLAlchemy + PostgreSQL。
- data-service：Python 3.12，独立 worker 服务，通过 PostgreSQL job_queue 协同。
- 部署：Docker Compose。

边界规则：
- frontend 只能调用 backend 的 /api/v1/*，不能直接访问 data-service。
- backend 负责用户侧 API、认证授权、流程编排、审计、元数据。
- data-service 负责解析、规则执行、调度、报告生成、AI 摘要，不直接给前端提供业务接口。
- 不修改已有路由、枚举值、数据库字段含义，除非任务明确要求迁移。
- 用户可见文案保持中文。
- UI 保持蓝黑赛博科技风，默认深色，浅色主题可用。
- 新增能力必须补充测试；至少运行受影响域的最小回归。

每次执行要求：
1. 先阅读相关 docs、现有 API、模型、前端页面和测试。
2. 给出最小实现方案后直接改代码。
3. 保持目录边界清晰，不把 data-service 逻辑塞进 backend。
4. 更新或新增测试。
5. 同步更新相关文档或本 Backlog 状态。
6. 最后说明已跑的回归命令和未覆盖风险。
```

## M14-01 台账导入与基础数据采集正式化

对应需求：`FR-003`、`FR-004`、`FR-005`

目标：
- 策略、账号、例外、绕行、模板等台账具备分类导入、字段校验、行级错误反馈。
- 周期基础数据采集不只是写入任务记录，需要有可扩展 collector adapter 边界。

范围：
- backend 增强台账导入 API、校验模型、错误返回。
- data-service 增加 collector adapter 接口和一个本地 mock collector。
- frontend 在平台页提供分类导入入口、校验结果表、采集任务状态。

非范围：
- 不接真实第三方系统。
- 不引入消息队列或外部 ETL 平台。

建议修改：
- `apps/backend/app/api/v1/platform.py`
- `apps/backend/app/models/entities.py`
- `apps/backend/app/schemas/`
- `apps/data-service/app/jobs/`
- `apps/data-service/app/workers/`
- `apps/frontend/src/pages/platform.tsx`
- `apps/backend/tests/`
- `apps/data-service/tests/`

验收标准：
- 每类台账都有独立 `catalog_type` 校验规则。
- 非法行返回行号、字段名、错误原因。
- 可创建基础数据采集任务并由 data-service 写入采集日志。
- 前端能看到导入成功数、失败数、失败明细。

回归要求：
- `python -m pytest apps/backend/tests/test_backend_api.py -q`
- `python -m pytest apps/data-service/tests/test_data_service.py -q`
- `pnpm --dir apps/frontend lint`

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-01：台账导入与基础数据采集正式化。
先审查现有 ledger_items、scheduled_tasks、platform API 和平台页，然后为不同 catalog_type 增加字段校验与行级错误反馈。
在 data-service 新增 collector adapter 边界和本地 mock collector，不接真实外部系统。
补充 backend/data-service/frontend 最小回归测试，确保非法输入可读、合法导入可查询、采集任务有日志。
```

## M14-02 四类配置解析器与夹具矩阵

对应需求：`FR-007`、`FR-009`、`NFR-005`

目标：
- CSW、BSW、OMSW、OMFW 四类对象有明确 parser adapter 和样例夹具。
- 新增 adapter 不影响既有 adapter。

范围：
- data-service parser adapter 细化。
- 新增四类配置 fixture。
- backend/frontend 只消费已有解析结果，不新增业务接口。

非范围：
- 不做完整厂商全语法解析，只实现验收样例所需关键字段。

建议修改：
- `apps/data-service/app/parsers/`
- `apps/data-service/tests/fixtures/`
- `apps/data-service/tests/test_data_service.py`
- `huawei-firewall-sample.cfg` 可作为 OMFW 参考样例。

验收标准：
- 四类样例均能识别 parser_name。
- 均能生成 normalized_configs。
- warning_markers 保持 line_no、code、message、line 明细。
- parser registry 单测覆盖未知类型 fallback。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-02：四类配置解析器与夹具矩阵。
检查现有 parser registry 和 network parser，把 CSW/BSW/OMSW/OMFW 拆成明确 adapter。
为每类新增最小可验收配置 fixture，并补测试证明四类解析、标准化、warning_markers 都可用。
不要改 frontend/backend API，除非发现类型字段缺失必须补齐。
```

## M14-03 解析结果全局检索

对应需求：`FR-011`

目标：
- 支持按对象、配置版本、关键字段、关键字、风险线索检索 normalized_configs。

范围：
- backend 增加全局检索 API。
- frontend 对象配置页或平台页增加解析结果检索区。

非范围：
- 不引入 Elasticsearch。
- 不做复杂全文检索排序，只用 PostgreSQL/SQLAlchemy 查询完成首版。

建议修改：
- `apps/backend/app/api/v1/assets_configs.py`
- `apps/backend/app/schemas/`
- `apps/frontend/src/services/api.ts`
- `apps/frontend/src/pages/assets.tsx`

验收标准：
- 可按 asset_id、hostname、section、keyword 查询。
- 返回结果包含对象名、配置文件名、解析字段、命中内容。
- 前端可输入关键字并展示结果。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-03：解析结果全局检索。
新增 /api/v1/configs/normalized/search 或等价 REST 接口，支持对象和关键字过滤。
前端增加解析结果检索面板，保持 Arco 蓝黑科技风。
补 backend API 测试和 frontend lint/build。
```

## M14-04 规则版本生命周期

对应需求：`FR-013`

目标：
- 在现有 rule_set_versions 基础上补齐版本对比、回滚、启用状态。

范围：
- backend 增加 rule version diff、rollback API。
- frontend 规则页展示版本差异和回滚按钮。

非范围：
- 不做复杂审批流。
- 不改变当前巡检默认使用 active rule_sets 的行为。

建议修改：
- `apps/backend/app/api/v1/rules_inspections.py`
- `apps/backend/app/models/entities.py`
- `apps/frontend/src/pages/rules.tsx`

验收标准：
- 规则更新生成版本。
- 可查看任意两版本差异。
- 可从历史版本回滚并生成新版本。
- 审计记录 rule.rollback。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-04：规则版本生命周期。
基于现有 rule_set_versions 增加版本 diff 和 rollback。
前端在规则版本列表中加入查看差异和回滚操作。
补 API 测试，确认回滚不会破坏已有巡检结果。
```

## M14-05 周期巡检与责任分派闭环

对应需求：`FR-018`、`FR-020`

目标：
- 周期巡检任务支持创建、启停、编辑、触发、执行日志。
- 巡检任务可按对象责任人分派，并在前端可见。

范围：
- backend 完善 scheduled_tasks 和 inspection assignment 模型。
- data-service 调度器按 enabled/next_run_at 生成任务。
- frontend 提供启停、编辑、责任人展示。

非范围：
- 不引入 Celery/Redis。

建议修改：
- `apps/backend/app/api/v1/platform.py`
- `apps/backend/app/api/v1/rules_inspections.py`
- `apps/data-service/app/workers/`
- `apps/frontend/src/pages/platform.tsx`
- `apps/frontend/src/pages/rules.tsx`

验收标准：
- 可启停周期任务。
- 到期任务由 data-service 生成 inspection run。
- inspection run 展示责任人或责任归属。
- 任务执行写审计或执行日志。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-05：周期巡检与责任分派闭环。
补齐 scheduled_tasks 的启停、编辑、执行日志 UI 和 API。
让 data-service 只处理 enabled 且到期的任务，并生成 inspection run。
任务责任归属优先来自 asset.owner，前端展示责任人。
补 backend/data-service 测试和 frontend 回归。
```

## M14-06 消息中心闭环

对应需求：`FR-022`

目标：
- 顶部提醒图标不再只是装饰，具备未读数、下拉列表、标记已读。

范围：
- backend 通知 API 补 unread_count、mark-read。
- frontend AppShell 接入通知查询。
- data-service 失败任务和关键完成事件写通知。

非范围：
- 不接短信、邮件、企业微信等外部渠道。

建议修改：
- `apps/backend/app/api/v1/platform.py`
- `apps/data-service/app/jobs/`
- `apps/frontend/src/app/AppShell.tsx`
- `apps/frontend/src/services/api.ts`

验收标准：
- 顶部显示未读数量。
- 点击可查看最近通知。
- 可标记单条或全部已读。
- 任务失败自动产生通知。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-06：消息中心闭环。
把现有 notifications 从平台页扩展到顶部消息中心，补 unread_count 和 mark-read API。
关键任务失败、报告生成完成、AI 待复核生成通知。
保持前端中文文案和科技风样式。
```

## M14-07 工单附件与催办记录

对应需求：`FR-024`

目标：
- ticket 显示处理意见、附件、催办记录。

范围：
- backend 增加 ticket_attachments、ticket_reminders 或等价表。
- frontend 工单详情区支持上传附件、查看附件、发起催办。
- backend 下载附件需要鉴权和审计。

非范围：
- 不实现复杂文件预览。

建议修改：
- `apps/backend/app/models/entities.py`
- `apps/backend/app/api/v1/workflow.py`
- `apps/frontend/src/pages/workflow.tsx`
- `storage/uploads/`

验收标准：
- 工单可上传附件。
- 附件可下载并产生 audit。
- 可新增催办记录。
- 工单详情展示处理意见、附件和催办时间线。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-07：工单附件与催办记录。
为 ticket 增加附件和催办记录，文件写入 storage/uploads 并保留元数据。
前端在闭环处置页增加工单详情面板，展示附件、催办记录、处理意见。
补上传/下载/审计测试。
```

## M14-08 日志证据链与问题专题视图

对应需求：`FR-028`、`FR-030`、`FR-037`

目标：
- 日志线索能关联 finding/ticket/report。
- 提供问题专题视图，按规则、对象类型、责任单位筛选。

范围：
- backend 增强 log_clues 查询和关联字段。
- frontend 增加专题视图或在闭环页增加专题筛选。

非范围：
- 不做海量日志检索引擎。

建议修改：
- `apps/backend/app/api/v1/platform.py`
- `apps/backend/app/api/v1/rules_inspections.py`
- `apps/frontend/src/pages/workflow.tsx`
- `apps/frontend/src/pages/platform.tsx`

验收标准：
- finding/ticket 可查看关联日志线索。
- 按规则、对象类型、责任单位筛选问题。
- 查询操作有审计或检索留痕。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-08：日志证据链与问题专题视图。
在不引入外部搜索引擎的前提下，增强 log_clues 与 finding/ticket 的关联查询。
前端增加问题专题视图，支持规则、对象类型、责任单位筛选。
补 API 测试和页面 smoke 回归。
```

## M14-09 报告、模板、参数正式化

对应需求：`FR-031`、`FR-032`、`FR-033`、`FR-035`、`FR-042`

目标：
- 报告产物从单一 Markdown 摘要升级为问题清单、统计摘要、迎检资料包。
- 模板支持增删改查和版本字段。
- 参数能被规则、报告或页面实际消费。

范围：
- backend 完善 report_templates、system_parameters API。
- data-service 报告生成器支持多产物。
- frontend 报告中心支持模板选择、产物列表、下载。

非范围：
- 不强制实现 PDF，如成本过高可先 CSV/Markdown/ZIP。

建议修改：
- `apps/backend/app/api/v1/platform.py`
- `apps/backend/app/api/v1/workflow.py`
- `apps/data-service/app/reports/generator.py`
- `apps/frontend/src/pages/reports.tsx`
- `apps/frontend/src/pages/platform.tsx`

验收标准：
- 问题清单可下载。
- 迎检资料包包含 summary、finding list、evidence manifest。
- 模板可创建、编辑、删除或停用，并有 version。
- 参数配置至少被一个报告或规则路径实际使用。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-09：报告、模板、参数正式化。
把报告生成从单一 Markdown 摘要扩展为问题清单和迎检资料包。
完善模板 CRUD/version，参数配置需要被报告或规则逻辑实际读取。
前端报告中心支持模板选择和多个产物下载。
补 data-service 报告测试、backend API 测试、frontend lint/build。
```

## M14-10 SSO 预留与权限矩阵

对应需求：`FR-039`、`FR-040`

目标：
- 明确 SSO adapter 配置边界。
- 角色权限管理具备菜单和资源动作矩阵。

范围：
- backend 增加 auth provider 配置结构或 adapter stub。
- backend/frontend 增加角色权限矩阵管理。
- AppShell 菜单按权限矩阵过滤。

非范围：
- 不接真实 SSO 服务。

建议修改：
- `apps/backend/app/api/v1/auth.py`
- `apps/backend/app/core/`
- `apps/frontend/src/pages/platform.tsx`
- `apps/frontend/src/app/AppShell.tsx`

验收标准：
- 可配置 local/sso_stub provider。
- 角色可配置菜单权限和资源动作权限。
- 不同角色登录菜单可控。
- 无权限 API 返回 403。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-10：SSO 预留与权限矩阵。
不要接真实 SSO，只实现清晰的 provider 配置和 sso_stub adapter 边界。
补角色-菜单-动作权限矩阵 API 和前端管理 UI。
验证不同角色菜单和 API 权限均生效。
```

## M14-11 性能与易用性验收

对应需求：`NFR-003`、`NFR-007`

目标：
- 给出可运行性能样例，验证目标规模下处理耗时。
- 给出高频场景 3 次点击内可达的自动化或文档化验收。

范围：
- 新增性能脚本和样例数据生成。
- 新增 Playwright 可达性 smoke。
- 输出测试报告 Markdown。

非范围：
- 不做生产压测平台。

建议修改：
- `tests/performance/`
- `tests/mock-e2e/`
- `docs/`

验收标准：
- 可一键生成 N 个资产、M 个配置、K 条规则并统计处理耗时。
- 输出性能报告。
- Playwright 覆盖登录后到达对象、规则、闭环、报告、审计的点击路径。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-11：性能与易用性验收。
新增轻量性能脚本，使用真实 backend/data-service/PostgreSQL，不 mock 处理逻辑。
新增 Playwright 点击路径验收，证明高频页面 3 次点击内可达。
输出 docs 下的测试报告模板。
```

## M14-12 迁移严谨化与前端包体积优化

对应需求：工程交付项、`NFR-004`、`NFR-005`、`NFR-008`

目标：
- Alembic 不再只依赖 create_all/drop_all baseline。
- 前端减少 Arco 大 chunk 风险。
- 失败任务具备更清晰的重试策略和告警记录。

范围：
- backend/data-service 迁移脚本拆分。
- frontend 继续组件按需、路由懒加载、图标按需。
- job retry 增加 attempts/backoff/max_attempts 策略说明和测试。

非范围：
- 不为了包体积替换 Arco UI。

建议修改：
- `apps/backend/alembic/versions/`
- `apps/frontend/vite.config.ts`
- `apps/frontend/src/pages/`
- `apps/backend/app/api/v1/platform.py`
- `apps/data-service/app/workers/`

验收标准：
- 新增字段走显式 Alembic migration。
- `pnpm --dir apps/frontend build` 仍通过，主要业务页面保持懒加载。
- failed job 可重试，超过限制有通知记录。

执行 Prompt：

```text
使用 M0 全局控制 Prompt。实现 M14-12：迁移严谨化与前端包体积优化。
先审查现有 Alembic baseline 和 Vite chunk 配置。
把迁移策略补成可持续增量模式，不破坏现有演示数据库。
继续优化 Arco 相关 chunk，但不替换 UI 库。
完善 job retry 的 attempts/backoff/max_attempts 测试。
```

## 推荐执行顺序

1. `M14-01` 台账导入与采集正式化
2. `M14-02` 四类配置解析器与夹具矩阵
3. `M14-03` 解析结果全局检索
4. `M14-04` 规则版本生命周期
5. `M14-05` 周期巡检与责任分派闭环
6. `M14-06` 消息中心闭环
7. `M14-07` 工单附件与催办记录
8. `M14-08` 日志证据链与问题专题视图
9. `M14-09` 报告、模板、参数正式化
10. `M14-10` SSO 预留与权限矩阵
11. `M14-11` 性能与易用性验收
12. `M14-12` 迁移严谨化与前端包体积优化

## 每轮完成定义

- 代码、测试、文档同步完成。
- 不引入跨域越界调用。
- 不破坏现有 mock E2E 主链路。
- 至少运行对应域最小回归。
- 若无法完成某项，必须记录阻塞原因、已完成范围、下一步建议。
