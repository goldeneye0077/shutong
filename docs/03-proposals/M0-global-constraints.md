# M0 全局约束与统一执行规范

## 目标

为所有模块执行提供统一控制 Prompt，确保 AI 输出始终落在当前项目的技术栈、目录结构、接口边界和交付要求内。

## 全局约束

- 技术栈固定：`frontend=React+Vite+TypeScript+React Router+TanStack Query+Ant Design`，`backend=Python 3.12+FastAPI+PostgreSQL`，`data-service=Python 3.12+FastAPI internal+PostgreSQL worker`，部署为 `Docker Compose`
- 仓库为单仓 Monorepo，按 `frontend`、`backend`、`data-service` 三域组织
- frontend 只调用 backend `/api/v1/*`
- backend 不执行解析、规则计算和报告生成，只负责公共 API、状态和审计
- data-service 不对前端开放，不承载用户审批界面
- 所有公共契约以 backend OpenAPI 为准
- 所有长任务通过 `job_queue` 异步处理
- 不引入 Redis、Celery、MinIO、外部云 AI

## 完成定义

- 代码、文档、接口和测试都必须落在当前模块允许修改目录内
- 必须补齐最小必要测试
- 必须更新与模块相关的文档或契约
- 不得越界修改其他域的实现

## 全局控制 Prompt

```text
你正在为“核心网数通设备配置安全合规平台”实现一个模块。请严格遵守以下规则：
1. 当前项目是单仓 Monorepo，分为 frontend、backend、data-service 三域。
2. frontend 只能消费 backend 的 /api/v1 公共 API，不得直接调用 data-service 或数据库。
3. backend 负责认证、RBAC、对象台账、流程状态、审计、上传元数据、OpenAPI，不得直接做解析、规则计算、报告生成。
4. data-service 负责 job_queue 消费、解析、标准化、规则执行、报告生成、AI 后置任务，不得暴露给前端。
5. 技术栈固定，不得替换为其他框架或新增 Redis、Celery、MinIO、外部云 AI 服务。
6. 目录职责固定，只能修改当前模块允许的目录。
7. 所有公共接口必须遵循 /api/v1 规范并保持 OpenAPI 可描述。
8. 所有长任务必须异步化并可追踪。
9. 任何 AI 分析结果都必须保留人工确认边界，不能直接发布。
10. 输出必须包含：实现内容、受影响文件、测试内容、未覆盖风险。
```

