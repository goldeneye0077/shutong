# M13 Deployment Ops

## 目标

完成三域开发环境的 Docker Compose 编排、环境变量基线、卷挂载和启动顺序规范。

## 范围

- postgres、backend、data-service、frontend 四服务
- 共享 `storage` 卷
- 环境变量样例
- 启动和健康检查策略

## 非范围

- 生产级发布流水线
- 云上部署编排

## 前置依赖

- `M0`
- `M1`
- `M5`
- `M9`

## 允许修改目录

- 根目录
- `infra`

## 测试要求

- compose 文件语法
- 服务依赖顺序
- 健康检查配置

## 完成定义

- 新成员可按 README 和 compose 结构理解三域启动方式

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Deployment Ops 模块。只允许修改仓库根目录和 infra。
必须完成：compose 编排、环境变量说明、卷与网络边界、健康检查和启动顺序。
不得扩展为生产发布流水线设计。
```

