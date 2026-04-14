# 仓库结构说明

## 1. 根目录职责

- `apps`：三域应用代码
- `packages`：共享契约与主题令牌
- `docs`：需求、架构、proposal、结构说明
- `infra`：部署和脚本
- `storage`：本地上传与导出目录

## 2. 三域目录约束

### frontend

- 只放页面、组件、前端服务层、主题和交互逻辑
- 不得放数据库模型、解析器、规则引擎

### backend

- 只放公共 API、数据模型、服务、流程和审计
- 不得放 parser adapter、规则执行器和报告生成器

### data-service

- 只放 worker、任务、解析、标准化、规则执行、报告、AI
- 不得放前端页面和公共业务 API

## 3. 文件命名规则

- 文档文件统一使用 `数字-语义名.md`
- proposal 文件统一使用 `M编号-模块名.md`
- API 路由、schema、service 尽量按资源名对齐

## 4. 写入边界

- frontend 模块只能修改 `apps/frontend` 和必要的 `packages`
- backend 模块只能修改 `apps/backend`
- data-service 模块只能修改 `apps/data-service`
- 部署模块只能修改根目录与 `infra`

