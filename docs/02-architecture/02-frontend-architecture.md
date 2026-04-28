# Frontend 架构

## 1. 技术栈

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Arco UI

## 2. 分层

```text
src/
  app/         # 应用壳、Provider、布局
  routes/      # 路由定义和守卫
  pages/       # 页面装配
  features/    # 业务功能组件
  components/  # 复用 UI 组件
  services/    # API 调用封装
  hooks/       # 前端通用 hooks
  theme/       # 主题 token 和切换逻辑
  types/       # 页面侧类型与 view model
```

## 3. 状态边界

- 远程数据：TanStack Query
- 会话和主题：Context + 本地存储
- 页面临时交互：局部组件状态
- 不预设 Redux/Zustand

## 4. 路由

- `/login`
- `/`
- `/assets`
- `/rules`
- `/workflow`
- `/reports`
- `/audit`
- `/platform`

## 5. 主题要求

- 浅色与深色主题必须共用同一套 token 入口
- 首次进入跟随系统主题
- 用户切换结果持久化到浏览器本地存储
- 所有页面组件必须通过 Arco UI 组件能力或 CSS variable 读取颜色
