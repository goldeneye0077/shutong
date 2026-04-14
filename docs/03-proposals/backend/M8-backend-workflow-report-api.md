# M8 Backend Workflow Report API

## 目标

实现 ticket、exception、report、audit 资源和审批流 API。

## 范围

- tickets API
- exceptions API
- report_jobs API
- audit_events 查询 API
- 审批动作与导出任务创建

## 非范围

- 导出物生成
- AI 摘要生成

## 前置依赖

- `M0`
- `M5`
- `M7`

## 允许修改目录

- `apps/backend`

## 测试要求

- ticket 状态流转
- 例外审批
- 报告任务创建
- 审计查询

## 完成定义

- 审批与导出均可通过公共 API 驱动，并写审计日志

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Backend Workflow Report API。只允许修改 apps/backend。
必须完成：tickets、exceptions、report_jobs、audit_events 资源与审批动作。
不得让 backend 直接生成报告文件内容。
```

