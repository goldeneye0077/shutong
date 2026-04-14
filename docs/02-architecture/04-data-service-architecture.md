# Data-Service 架构

## 1. 技术栈

- Python 3.12
- FastAPI（内部健康检查）
- SQLAlchemy / psycopg
- PostgreSQL 任务队列

## 2. 处理域

- ingest：消费上传文件和导入任务
- parse：调用 parser adapter 解析不同对象类型
- normalize：标准化映射
- rules：规则执行
- scheduler：周期任务生成
- reports：导出物生成
- ai：后置摘要与归纳

## 3. 任务模型

```text
job_queue
  - id
  - job_type
  - payload
  - status
  - attempts
  - available_at
  - locked_by
  - locked_at
  - last_error
```

## 4. 执行策略

- worker 通过 `FOR UPDATE SKIP LOCKED` 抢占任务
- 同类任务幂等处理，失败任务递增 `attempts`
- 结果写回领域表和用户可见状态表
- 内部 HTTP 端点仅用于健康检查与能力探针，不用于业务调用

