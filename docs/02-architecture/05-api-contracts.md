# API 契约规范

## 1. 资源组

- `auth`
- `assets`
- `configs`
- `rules`
- `inspections`
- `findings`
- `tickets`
- `exceptions`
- `reports`
- `audit`
- `ledgers`
- `scheduled-tasks`
- `notifications`
- `log-clues`
- `report-templates`
- `system-parameters`
- `ai-analysis`
- `jobs`

## 2. URL 规范

- 根前缀：`/api/v1`
- 集合：`GET /assets`
- 详情：`GET /assets/{asset_id}`
- 创建：`POST /assets`
- 更新：`PATCH /assets/{asset_id}`
- 删除：`DELETE /assets/{asset_id}`，首版采用软删除留痕
- 状态动作：`POST /tickets/{ticket_id}/submit-review`、`POST /tickets/{ticket_id}/review/approve`、`POST /tickets/{ticket_id}/review/reject`

## 3. 公共响应

- 当前实现以 FastAPI response_model 和 OpenAPI schema 为准，成功响应直接返回资源对象、列表或分页对象。
- 错误响应遵循 FastAPI `detail` 模型，前端负责将常见鉴权和权限错误映射为中文提示。
- 若后续要求统一 `code/message/data/request_id` 包裹，应作为独立兼容改造执行，避免破坏现有前端与测试契约。

## 4. 契约生成

- backend OpenAPI 是唯一公共契约源
- 生成结果输出到 `packages/api-contracts`
- `packages/api-contracts/generated.ts` 由 `pnpm contracts:sync` 从后端 OpenAPI 生成
- `packages/api-contracts/index.ts` 保留前端稳定消费的类型门面，新增接口时需要同步更新或重新生成

## 5. 迁移约束

- 当前 Alembic 已建立 baseline，用于正式迭代的迁移入口。
- 演示环境仍保留 `Base.metadata.create_all()` 和少量兼容列补齐，保证本地已有数据库可继续启动。
- 后续生产变更应优先新增 Alembic 增量 migration，不再依赖运行期自动建表作为唯一手段。
