# Backend 架构

## 1. 技术栈

- Python 3.12
- FastAPI
- SQLAlchemy 2.x
- Pydantic v2
- Alembic
- PostgreSQL

## 2. 职责

- 本地认证与 RBAC
- 公开 API 与 OpenAPI 契约
- 对象台账、配置文件元数据、规则元数据
- 巡检任务元数据、问题闭环状态、例外审批状态
- 报告任务状态、下载信息
- 审计日志
- job_queue 写入与结果读取

## 3. 目录职责

```text
app/
  api/v1/         # REST 路由
  core/           # 配置、安全、异常
  db/             # 会话、基础 ORM 配置
  models/         # 数据模型
  schemas/        # 请求/响应模型
  repositories/   # 数据访问
  services/       # 业务服务
  workflows/      # 审批流与任务流编排
  audit/          # 审计辅助
```

## 4. API 规范

- 所有公开接口位于 `/api/v1`
- 分页统一返回 `items`, `total`, `page`, `page_size`
- 错误统一返回 `code`, `message`, `details`, `request_id`
- 上传统一采用 `multipart/form-data`
- 导出统一采用异步任务，不在主请求中直接生成大文件

