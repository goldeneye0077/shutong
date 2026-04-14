# M6 Backend Assets Config Metadata

## 目标

实现对象台账、配置文件元数据、上传接口和版本管理。

## 范围

- assets API
- config_files API
- 文件上传元数据
- 版本列表与状态查询
- 创建解析类 job_queue 任务

## 非范围

- 配置解析和差异计算

## 前置依赖

- `M0`
- `M5`

## 允许修改目录

- `apps/backend`

## 测试要求

- 资产 CRUD
- 配置上传和任务创建

## 完成定义

- 上传文件后生成 config_files 记录和 job_queue 任务

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Backend Assets Config Metadata。只允许修改 apps/backend。
必须完成：assets 和 config_files 资源、上传接口、版本元数据、解析任务创建。
不得在 backend 内直接做解析计算。
```

