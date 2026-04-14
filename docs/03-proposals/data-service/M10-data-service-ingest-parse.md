# M10 Data-Service Ingest Parse

## 目标

实现配置消费、parser adapter、标准化映射和解析异常留痕。

## 范围

- 上传文件消费
- CSW/BSW/OMSW/OMFW adapter 接口
- 标准化模型写入
- 解析错误记录

## 非范围

- 规则执行
- 报告生成

## 前置依赖

- `M0`
- `M9`

## 允许修改目录

- `apps/data-service`

## 测试要求

- 四类对象样例解析
- 解析失败分支

## 完成定义

- parser adapter 可扩展，解析结果写回标准化表

## AI Prompt

```text
先拼接 M0 Prompt，再执行：
实现 Data-Service Ingest Parse。只允许修改 apps/data-service。
必须完成：上传文件消费、四类对象 parser adapter 接口、标准化写回、解析异常留痕。
不得把解析结果直接暴露给前端。
```

