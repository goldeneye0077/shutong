# M7 Backend Rules Inspection API

## 目标

实现规则集管理、巡检任务创建、任务状态查询和 findings 查询接口。

## 范围

- rule_sets API
- inspection_runs API
- findings 查询
- 状态汇总接口
- 写入规则执行类 job_queue 任务

## 非范围

- 规则引擎实现

## 前置依赖

- `M0`
- `M5`
- `M6`

## 允许修改目录

- `apps/backend`

## 测试要求

- 规则 CRUD
- 巡检任务创建
- findings 查询筛选

## 完成定义

- 用户可发起巡检并查询执行状态和问题结果

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Backend Rules Inspection API。只允许修改 apps/backend。
必须完成：规则管理、巡检任务 API、状态查询、findings 查询和任务创建。
不得在 backend 中实现规则计算。
```

