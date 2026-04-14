# 系统总览

## 1. 设计原则

- 单仓 Monorepo，代码、文档、proposal 和部署配置统一管理
- 三域拆分：`frontend`、`backend`、`data-service`
- frontend 只访问 backend；backend 与 data-service 通过数据库与共享存储协作
- 首版优先保证边界清晰，不追求一次性打满所有集成

## 2. 部署拓扑

```text
Browser
  -> Frontend (Vite/React)
    -> Backend (FastAPI)
      -> PostgreSQL
      -> Storage/uploads + Storage/exports
      -> job_queue
    Data-Service (FastAPI internal + worker loop)
      -> PostgreSQL
      -> Storage/uploads + Storage/exports
```

## 3. 调用关系

- 浏览器只访问 frontend 与 backend
- frontend 所有业务数据来自 backend `/api/v1`
- backend 创建 job 并读写用户侧状态
- data-service 读取 job、执行处理并写回结果

## 4. 共享资源

- 共享数据库：PostgreSQL
- 共享文件系统：`storage/uploads`、`storage/exports`
- 共享契约：backend OpenAPI -> `packages/api-contracts`
- 共享主题：`packages/ui-tokens`

