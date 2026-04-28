# 边界与技术约束

## 1. 明确边界

- frontend 不直连数据库，不访问 data-service
- backend 不执行解析和规则计算
- data-service 不提供用户侧审批和登录接口

## 2. 首版禁止项

- 不引入 Redis/Celery
- 不引入 MinIO
- 不引入外部云 AI
- 不实现自动配置下发
- 不跳过人工确认直接发布 AI 结果

## 3. 统一约束

- 技术栈固定：FastAPI、PostgreSQL、React、Vite、Arco UI、Docker Compose
- 目录职责固定，禁止将 frontend 业务逻辑写入 backend 或 data-service
- 所有公共接口必须以 OpenAPI 文档化
- 所有导出和审批动作必须写审计日志
- 所有长任务必须通过异步 job_queue 处理
