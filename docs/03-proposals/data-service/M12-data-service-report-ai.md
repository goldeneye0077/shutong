# M12 Data-Service Report AI

## 目标

实现报告产物生成和 AI 后置分析任务。

## 范围

- 问题清单导出
- 管理摘要导出
- 迎检资料包导出
- AI 摘要/归纳任务
- 报告产物元数据写回

## 非范围

- 直接发布 AI 结论
- 对外暴露下载接口

## 前置依赖

- `M0`
- `M9`
- `M10`
- `M11`

## 允许修改目录

- `apps/data-service`

## 测试要求

- 三类报告生成
- AI 任务状态流转

## 完成定义

- backend 可查询导出状态和产物信息
- AI 结果必须保留待确认状态

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Data-Service Report AI。只允许修改 apps/data-service。
必须完成：问题清单、管理摘要、迎检资料包导出和 AI 后置分析任务。
不得让 AI 输出绕过人工确认。
```

