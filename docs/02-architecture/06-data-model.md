# 数据模型

## 1. Backend 主表

| 表名 | 用途 |
| --- | --- |
| users | 本地账号 |
| roles | 角色与权限 |
| assets | 对象台账 |
| config_files | 配置文件与版本元数据 |
| rule_sets | 规则集与版本 |
| inspection_runs | 巡检任务 |
| findings | 问题结果 |
| tickets | 整改工单 |
| exceptions | 例外申请 |
| report_jobs | 导出任务 |
| audit_events | 审计事件 |
| job_queue | 后台任务队列 |

## 2. Data-Service 主表

| 表名 | 用途 |
| --- | --- |
| parse_runs | 解析执行记录 |
| normalized_configs | 标准化配置结果 |
| rule_run_results | 规则执行记录 |
| report_artifacts | 导出产物元数据 |
| ai_analysis_jobs | AI 分析任务记录 |

## 3. 关系约束

- `config_files.asset_id -> assets.id`
- `inspection_runs.rule_set_id -> rule_sets.id`
- `findings.inspection_run_id -> inspection_runs.id`
- `tickets.finding_id -> findings.id`
- `exceptions.ticket_id -> tickets.id`
- `report_artifacts.report_job_id -> report_jobs.id`

