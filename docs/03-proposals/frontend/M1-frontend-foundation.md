# M1 Frontend Foundation

## 目标

完成 frontend 应用壳、路由骨架、登录页占位、菜单布局、双主题能力和基础 Provider。

## 范围

- Vite + TypeScript 工程基线
- React Router 路由壳
- QueryClientProvider
- Layout、菜单、空白页、错误页
- 浅色/深色主题切换与持久化

## 非范围

- 业务表单和复杂接口对接
- 真正的登录鉴权逻辑

## 前置依赖

- `M0`

## 允许修改目录

- `apps/frontend`
- `packages/ui-tokens`

## 测试要求

- 主题切换逻辑
- 主要路由可渲染

## 完成定义

- 至少包含驾驶舱、资产与配置、规则与巡检、闭环与报告四个一级路由
- 主题切换可在刷新后保持

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Frontend Foundation。只允许修改 apps/frontend 和 packages/ui-tokens。
必须完成：应用壳、基础路由、主布局、菜单、浅色/深色主题切换、登录页占位、错误页占位。
不得实现真实业务逻辑，不得跳过主题能力，不得直接调用 data-service。
输出必须包含测试和后续模块衔接点。
```

