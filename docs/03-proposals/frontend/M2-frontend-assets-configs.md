# M2 Frontend Assets Configs

## 目标

交付对象台账、配置导入、版本列表和差异入口页面。

## 范围

- 资产列表页
- 资产详情页
- 配置上传页
- 配置版本列表与状态展示
- 基础筛选和分页

## 非范围

- 真正的配置差异计算
- 解析结果详情

## 前置依赖

- `M0`
- `M1`
- backend 需提供资产和配置元数据 API

## 允许修改目录

- `apps/frontend`
- `packages/api-contracts`

## 测试要求

- 列表页加载和筛选
- 上传表单交互

## 完成定义

- 用户可查看对象列表、打开详情、上传配置文件并看到任务状态

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Frontend Assets Configs 模块。只允许修改 apps/frontend 和 packages/api-contracts。
必须完成：对象台账列表、详情页、配置上传入口、版本列表、筛选分页、任务状态展示。
不得实现解析计算逻辑。所有数据都来自 backend API。
```

