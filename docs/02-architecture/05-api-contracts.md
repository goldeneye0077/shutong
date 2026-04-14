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

## 2. URL 规范

- 根前缀：`/api/v1`
- 集合：`GET /assets`
- 详情：`GET /assets/{asset_id}`
- 创建：`POST /assets`
- 更新：`PATCH /assets/{asset_id}`
- 状态动作：`POST /tickets/{ticket_id}/close`

## 3. 公共响应

```json
{
  "code": "ok",
  "message": "Success",
  "data": {},
  "request_id": "req_xxx"
}
```

## 4. 契约生成

- backend OpenAPI 是唯一公共契约源
- 生成结果输出到 `packages/api-contracts`
- frontend 不手写后端响应类型真源

