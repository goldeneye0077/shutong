# M9 Data-Service Foundation

## 目标

实现 data-service 基线、worker 轮询模型、内部健康检查和共享存储读写能力。

## 范围

- 内部 FastAPI 健康检查
- worker 主循环
- `job_queue` 认领
- 日志和错误记录
- 共享目录访问封装

## 非范围

- 具体解析器和规则引擎

## 前置依赖

- `M0`

## 允许修改目录

- `apps/data-service`

## 测试要求

- job 认领幂等性
- 健康检查

## 完成定义

- data-service 能认领任务并更新状态，不对前端暴露业务接口

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Data-Service Foundation。只允许修改 apps/data-service。
必须完成：worker 基线、job_queue 轮询、内部健康检查、错误记录、共享存储访问。
不得创建前端可见业务 API。
```

