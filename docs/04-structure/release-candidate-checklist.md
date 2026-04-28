# M15 发布候选检查清单

## 发布候选范围
- 三域服务：`frontend`、`backend`、`data-service`。
- 部署基线：`Docker Compose` + PostgreSQL + 本地 `storage` 文件卷。
- 正式验收入口：`pnpm test:regression`、`pnpm test:acceptance`、`pnpm test:mock:e2e:compose`。
- 轻量自检入口：`pnpm release:check`。

## 启动前检查
- `.env.example` 可作为本地启动模板；共享或生产类环境必须修改 `POSTGRES_PASSWORD`、`BACKEND_SECRET_KEY`、`BACKEND_BOOTSTRAP_ADMIN_PASSWORD`。
- 默认本地账号为 `admin / admin123`，仅用于演示和首次初始化。
- 需要先执行 `pnpm install`，确保 Playwright、Vite、前端依赖和根脚本可用。
- 如果要跑浏览器验收，首次环境需要安装浏览器：`pnpm exec playwright install chromium`。

## 启动与验收
- 启动服务：`docker compose up --build -d`。
- 查看健康：`docker compose ps`，四个服务应为 healthy 或 running/healthy。
- 部署验收：`pnpm deploy:check`。
- 常规回归：`pnpm test:regression`。
- 生产验收：`pnpm test:acceptance`。
- Mock 端到端：`pnpm test:mock:e2e:compose`。
- 发布候选轻量自检：`pnpm release:check`。

## 演示数据策略
- 推荐使用 `pnpm seed:demo` 写入一套中文演示数据。
- 推荐在最终演示前运行 `pnpm demo:reset`，清空业务演示数据并重建固定前缀的发布候选演示数据。
- `pnpm demo:reset` 会保留账号、角色、系统参数和报告模板，但会清空业务数据、上传文件和报告产物。
- `pnpm test:performance` 会写入 `PERF-*` 数据和上传/报告文件，只建议在测试或演示库运行。
- `pnpm test:mock:e2e` 会写入 `MOCK-E2E-*` 数据，只建议在测试或演示库运行。
- 不要在正式演示前随意执行 `docker compose down -v`，该命令会删除 PostgreSQL 卷。
- 如需清空演示库，请先确认当前数据不再需要，再单独执行数据清理或重建卷。

## 交付前必看文件
- `README.md`：项目入口、启动、验收和目录说明。
- `docs/04-structure/production-delivery-checklist.md`：生产化交付纪律。
- `docs/04-structure/performance-acceptance-report.md`：最近一次性能验收结果。
- `docs/04-structure/frontend-bundle-report.md`：最近一次前端包体积结果。
- `packages/api-contracts/openapi.json`：当前后端契约快照。

## 已知风险
- 当前仍使用本地账号 + RBAC，统一认证/SSO 是预留边界，不是首版正式路径。
- data-service 通过 PostgreSQL `job_queue` 轮询协作，首版不引入 Redis/Celery。
- 性能验收是轻量样本，不等同于生产压测。
- 报告产物以 Markdown、CSV、JSON、ZIP 为主，PDF/Excel 精排不在当前发布候选范围。
