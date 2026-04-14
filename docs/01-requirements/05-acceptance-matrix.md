# 需求验收矩阵

| 编号 | 需求摘要 | 归属子系统 | 验收方式 |
| --- | --- | --- | --- |
| FR-001 | 维护 30 个对象的基础台账 | frontend/backend | 页面可增删改查，API 可按类型/状态检索 |
| FR-002 | 批量导入配置文件并记录版本 | frontend/backend | 上传成功后生成 config_files 元数据和版本记录 |
| FR-003 | 导入策略、账号、例外、绕行、模板等台账 | frontend/backend | 每类台账均有导入入口和校验反馈 |
| FR-004 | 支持定时获取部分基础数据 | backend/data-service | 可创建周期任务并记录执行日志 |
| FR-005 | 对导入内容执行格式与字段校验 | backend | 非法输入被拒绝并返回可读错误 |
| FR-006 | 支持配置版本差异查看 | frontend/backend | 用户可查看同对象两个版本的对比结果 |
| FR-007 | 支持四类对象配置解析 | data-service | 四类对象样例可被识别并进入标准化结果 |
| FR-008 | 建立统一标准化数据模型 | data-service | 不同设备类型结果写入统一模型结构 |
| FR-009 | 解析规则可扩展 | data-service | 新增 adapter 不影响既有 adapter 运行 |
| FR-010 | 记录解析异常和失败原因 | data-service/backend | 失败任务写回错误状态并可查询 |
| FR-011 | 支持解析结果检索 | backend/frontend | 前端可按对象和关键字段查询结果 |
| FR-012 | 规则分类管理 | frontend/backend | 规则支持分类、适用范围和状态管理 |
| FR-013 | 规则版本管理 | backend | 规则变更保留版本和生效状态 |
| FR-014 | 风险等级管理 | backend/frontend | 规则与 findings 支持高/中/低筛选 |
| FR-015 | 批量自动校验 | backend/data-service | 创建巡检后可批量生成校验结果 |
| FR-016 | 输出问题证据 | data-service/backend/frontend | findings 显示命中规则、对象、证据和建议 |
| FR-017 | 规则持续维护 | backend | 规则新增、停用、调整均保留审计日志 |
| FR-018 | 管理周期巡检任务 | frontend/backend/data-service | 支持创建、启停、查看周期任务 |
| FR-019 | 发起临时巡检任务 | frontend/backend/data-service | 用户可选择对象和规则集发起任务 |
| FR-020 | 按对象和责任人分派任务 | backend/frontend | 任务可明确责任归属并被前端展示 |
| FR-021 | 自动汇总任务结果 | backend/frontend | 同一任务可查看总览和明细 |
| FR-022 | 发送消息提醒 | backend | 关键事件支持提醒接口或预留渠道 |
| FR-023 | 问题派单 | backend/frontend | findings 可生成 ticket 并进入待处理状态 |
| FR-024 | 整改跟踪 | frontend/backend | ticket 显示处理意见、附件、催办记录 |
| FR-025 | 复核销项 | frontend/backend | 复核操作可通过或驳回并写入意见 |
| FR-026 | 例外审批 | frontend/backend | 例外申请具备状态流转和有效期字段 |
| FR-027 | 全流程留痕 | backend | 关键状态变化写入审计事件 |
| FR-028 | 敏感日志接入支撑 | backend/data-service | 可为问题挂接日志线索元数据 |
| FR-029 | 异常告警归集 | data-service/backend | 高风险 findings 可被标记到专题视图 |
| FR-030 | 日志检索留存 | backend | 日志引用与问题、任务、报告存在关联 |
| FR-031 | 导出问题清单 | frontend/backend/data-service | 可生成并下载问题清单导出物 |
| FR-032 | 导出趋势分析报告 | frontend/backend/data-service | 可按周期生成管理摘要报告 |
| FR-033 | 导出迎检资料包 | frontend/backend/data-service | 一次请求生成资料包目录和文件 |
| FR-034 | 本地 AI 辅助分析 | data-service/backend | AI 输出进入待确认状态，不能直接发布 |
| FR-035 | 模板管理 | frontend/backend | 模板可增删改查并具备版本字段 |
| FR-036 | 综合驾驶舱 | frontend/backend | 首页显示覆盖率、整改率、风险热点和趋势 |
| FR-037 | 问题专题视图 | frontend/backend | 可按规则、对象类型、责任单位筛选 |
| FR-038 | 试点效果展示 | frontend/backend | 可展示核查时长、效率提升等指标 |
| FR-039 | 统一认证接入预留与本地登录 | backend/frontend | 本地登录可用，SSO 适配边界已保留 |
| FR-040 | 角色权限管理 | backend/frontend | 不同角色访问权限和菜单可控 |
| FR-041 | 操作审计日志 | backend | 登录、导出、审批、变更均可查询 |
| FR-042 | 参数配置管理 | backend/frontend | 风险等级、分类、模板参数可配置化 |
| NFR-001 | 支持本地部署 | backend/data-service/frontend | compose 可编排启动三域与数据库 |
| NFR-002 | 安全访问和导出留痕 | backend | 所有受保护接口鉴权且导出写审计 |
| NFR-003 | 1 小时内完成月度核查 | data-service/backend | 通过性能测试或目标样例验证 |
| NFR-004 | 失败重试与告警 | data-service/backend | 失败任务保留状态并可重试 |
| NFR-005 | 可扩展解析和规则体系 | data-service/backend | 新解析器和规则可增量接入 |
| NFR-006 | 全链路可追溯 | backend/data-service | 上传、解析、执行、审批、导出均可追踪 |
| NFR-007 | 易用性 | frontend | 高优场景页面 3 次点击内可达 |
| NFR-008 | 配置化可维护 | backend/data-service | 模板、规则、参数优先由配置驱动 |

