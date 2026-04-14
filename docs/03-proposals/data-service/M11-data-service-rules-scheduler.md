# M11 Data-Service Rules Scheduler

## 目标

实现规则执行、周期巡检调度和结果写回。

## 范围

- 规则执行任务
- 周期任务生成器
- findings 写回
- inspection 状态更新

## 非范围

- 审批流
- 报告导出

## 前置依赖

- `M0`
- `M9`
- `M10`

## 允许修改目录

- `apps/data-service`

## 测试要求

- 规则命中写回
- 周期任务生成
- 幂等重试

## 完成定义

- 周期和临时巡检都可由 data-service 执行并将结果写回后端可见表

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Data-Service Rules Scheduler。只允许修改 apps/data-service。
必须完成：规则执行、周期任务生成、findings 写回、inspection 状态更新。
不得处理 ticket 审批和用户态流程。
```

