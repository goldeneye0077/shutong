# M3 Frontend Rules Inspections

## 目标

交付规则管理、巡检任务、执行结果和问题列表页面。

## 范围

- 规则列表与详情
- 巡检任务创建与状态页
- 结果总览
- findings 列表和筛选

## 非范围

- ticket 审批和报告导出

## 前置依赖

- `M0`
- `M1`
- backend 需提供规则与巡检 API

## 允许修改目录

- `apps/frontend`
- `packages/api-contracts`

## 测试要求

- 巡检创建表单
- 结果列表筛选

## 完成定义

- 用户可发起巡检并看到任务状态、问题列表和筛选结果

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Frontend Rules Inspections 模块。只允许修改 apps/frontend 和 packages/api-contracts。
必须完成：规则管理页面、巡检任务页面、结果总览、问题列表与筛选。
不得实现 backend 未提供的本地计算逻辑。
```

