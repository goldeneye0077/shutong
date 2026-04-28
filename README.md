# 数通核心网配置安全合规平台

这是一个按三域落地的核心网配置安全合规平台，采用 Monorepo 管理：

- `frontend`：React + Vite + TypeScript + Arco Design，提供蓝黑科技风控制台、亮/暗主题、对象配置、规则巡检、闭环处置、报告和审计页面。
- `backend`：Python 3.12 + FastAPI + SQLAlchemy，提供 `/api/v1/*` 公共业务 API、认证授权、RBAC、审计、文件/任务元数据和流程编排。
- `data-service`：独立 Python 服务，负责配置解析、标准化、规则执行、周期调度、报告产物和 AI 摘要任务。

## 发布候选状态

当前仓库已进入 M15 发布候选收口阶段。建议交付前至少执行：

```powershell
pnpm release:check
pnpm test:regression
pnpm test:acceptance
```

如果需要完整 Mock 业务闭环，再执行：

```powershell
pnpm test:mock:e2e:compose
```

## 快速启动

1. 安装依赖：

```powershell
pnpm install
```

2. 准备环境变量：

```powershell
Copy-Item .env.example .env
```

共享或生产类环境必须修改 `.env` 中的 `POSTGRES_PASSWORD`、`BACKEND_SECRET_KEY`、`BACKEND_BOOTSTRAP_ADMIN_PASSWORD`。

3. 启动服务：

```powershell
docker compose up --build -d
```

4. 检查健康状态：

```powershell
docker compose ps
pnpm deploy:check
```

5. 打开系统：

- 前端：http://localhost:5173
- 后端 OpenAPI：http://localhost:8000/api/v1/docs
- data-service 健康检查：http://localhost:8010/internal/health
- 默认演示账号：`admin / admin123`

## 常用命令

```powershell
pnpm deploy:check       # 检查三域服务、登录和前端页面
pnpm migrations:check   # 检查 Alembic baseline 可建核心表
pnpm contracts:check    # 检查 OpenAPI 契约是否漂移
pnpm bundle:report      # 生成前端包体积报告
pnpm test:regression    # backend/data-service/迁移/契约/frontend 全量回归
pnpm test:acceptance    # 部署验收 + 性能样例 + 三次点击 + 包体积预算
pnpm seed:demo          # 写入一套中文演示数据
pnpm demo:reset         # 清空业务演示数据并重建一套发布候选演示数据
```

## 目录结构

```text
apps/
  frontend/       React 控制台
  backend/        FastAPI 公共业务 API
  data-service/   内部任务处理服务
packages/
  api-contracts/  OpenAPI 快照和生成类型
docs/
  01-requirements/
  02-architecture/
  03-proposals/
  04-structure/
infra/scripts/    契约、迁移、部署、包体积和发布候选检查脚本
tests/
  mock-e2e/       完整业务 Mock 端到端
  performance/    真实服务性能验收样例
  usability/      三次点击可达性验收
storage/
  uploads/        上传配置和附件
  exports/        报告产物
```

## 三域边界

- frontend 只能访问 backend 的 `/api/v1/*`。
- backend 负责用户侧 API、认证授权、流程编排、审计和任务元数据。
- data-service 不向前端开放业务接口，只通过 PostgreSQL `job_queue`、结果表和共享文件卷协作。
- 文件流：frontend 上传 -> backend 保存文件和元数据 -> backend 创建任务 -> data-service 处理 -> backend 提供结果查询/下载 -> frontend 展示。

## 演示数据说明

推荐使用 `pnpm seed:demo` 生成一套中文演示数据。
`pnpm test:performance` 会写入 `PERF-*` 数据，`pnpm test:mock:e2e` 会写入 `MOCK-E2E-*` 数据，这些命令适合测试库或演示库，不建议直接跑在正式演示库上。

如果需要把当前演示库恢复为一套干净数据，可执行：

```powershell
pnpm demo:reset
```

该命令会清空业务数据、上传文件和报告产物，但会保留账号、角色、系统参数和报告模板。

不要在未确认数据可删除前执行：

```powershell
docker compose down -v
```

该命令会删除 PostgreSQL 卷。

## 交付文档

- [生产化交付检查清单](docs/04-structure/production-delivery-checklist.md)
- [发布候选检查清单](docs/04-structure/release-candidate-checklist.md)
- [性能验收报告](docs/04-structure/performance-acceptance-report.md)
- [前端包体积报告](docs/04-structure/frontend-bundle-report.md)
