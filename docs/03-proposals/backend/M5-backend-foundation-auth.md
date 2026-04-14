# M5 Backend Foundation Auth

## 目标

搭建 backend 基线，提供本地登录、RBAC、统一响应模型、OpenAPI 和审计基础能力。

## 范围

- FastAPI app 初始化
- 配置管理
- 本地登录、刷新、当前用户
- RBAC 装饰器或依赖
- 审计事件写入基线

## 非范围

- SSO 真接入
- 复杂业务域模型

## 前置依赖

- `M0`

## 允许修改目录

- `apps/backend`

## 测试要求

- 登录成功/失败
- 角色访问控制

## 完成定义

- `/api/v1/auth/*` 可运行
- OpenAPI 可生成
- 关键操作可写入审计日志

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Backend Foundation Auth。只允许修改 apps/backend。
必须完成：FastAPI 基线、配置、认证、本地登录、刷新、当前用户、RBAC、统一错误模型、审计基线。
不得引入外部认证服务作为首版依赖。
```

