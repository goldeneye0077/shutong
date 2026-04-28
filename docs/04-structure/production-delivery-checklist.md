# 生产化交付检查清单

## 权限与账号
- 本地可运行路径为 `admin / admin123`，首次登录后应创建正式管理员并修改默认密码。
- 角色由菜单权限 `menu_items` 和操作权限 `permissions` 共同控制。
- 前端会按菜单权限隐藏导航、按操作权限隐藏或禁用关键按钮；后端通过权限点做最终拦截。
- 权限点支持 `*`、精确权限如 `assets:read`、资源通配如 `assets:*`。

## API 契约
- 修改后端 schema 或 API 后运行 `pnpm contracts:sync`。
- 提交前运行 `pnpm contracts:check`，确认 `packages/api-contracts/openapi.json` 和 `generated.ts` 未漂移。

## 数据库迁移
- 当前显式 baseline migration 位于 `apps/backend/alembic/versions/20260427_0001_initial_schema.py`。
- 新增表、字段、索引或约束必须新增 Alembic migration，不再只依赖 `Base.metadata.create_all()`。
- `Base.metadata.create_all()` 仅作为本地演示和测试兜底；正式升级路径应使用 `alembic upgrade head`。
- 提交前运行 `pnpm migrations:check`，该命令会在临时 SQLite 库上执行 Alembic upgrade 并校验核心表是否齐全。

## Docker 部署验收
- 本地预览使用 `docker compose up --build -d`。
- 服务启动后运行 `pnpm deploy:check`，检查 backend summary、登录、`/auth/me`、data-service health/capabilities 和 frontend HTML。
- 如果端口不是默认值，可通过 `.env.example` 中的 `FRONTEND_URL`、`BACKEND_URL`、`DATA_SERVICE_URL` 覆盖验收地址。
- Compose 中 backend、data-service、frontend 都配置健康检查；frontend 依赖 backend 健康后再启动。

## 演示库固化
- 最终演示前运行 `pnpm demo:reset` 可清空业务演示数据并重建一套固定前缀的发布候选演示数据。
- 该命令不删除 Docker 卷，不清理账号/角色/系统参数/报告模板。
- `pnpm test:acceptance`、`pnpm test:performance`、`pnpm test:mock:e2e` 会写入测试数据，完整回归后建议再次运行 `pnpm demo:reset`。

## 回归
- 发布候选轻量自检运行 `pnpm release:check`。
- 常规交付前运行 `pnpm test:regression`。
- 该命令会顺序执行 backend pytest、data-service pytest、migration check、API 契约检查、frontend lint、frontend build。
- 生产验收补充运行 `pnpm test:acceptance`，会顺序执行 Docker 部署验收、性能样例、三次点击可达性和包体积预算检查。
- mock 端到端验证使用 `pnpm test:mock:e2e:compose`，会启动独立 Compose project 并清理测试卷。

## 服务边界
- frontend 只访问 backend `/api/v1/*`。
- data-service 不向前端暴露业务接口，只通过 PostgreSQL `job_queue`、结果表和共享文件卷协作。
- 后台 worker 由 data-service 消费 `job_queue`，报告产物写入 `storage/exports`。
