# M4 Frontend Workflow Reports Dashboard

## 目标

交付整改闭环、例外审批、报告导出和驾驶舱页面。

## 范围

- ticket 处理页
- 例外申请和审批页
- 报告导出页
- 综合驾驶舱和专题卡片

## 非范围

- 真正的文件生成
- AI 结果自动发布

## 前置依赖

- `M0`
- `M1`
- backend 需提供 workflow、report、audit 相关 API

## 允许修改目录

- `apps/frontend`
- `packages/api-contracts`

## 测试要求

- 审批表单交互
- 导出状态显示
- 驾驶舱主题适配

## 完成定义

- 用户可完成 ticket 处理、例外审批、报告发起与驾驶舱查看

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Frontend Workflow Reports Dashboard 模块。只允许修改 apps/frontend 和 packages/api-contracts。
必须完成：整改闭环页面、例外审批页面、报告导出页面、驾驶舱页面，并确保双主题表现一致。
```

