import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfigProvider from "antd/es/config-provider";
import zhCN from "antd/es/locale/zh_CN";
import antdTheme from "antd/es/theme";
import { Route, Routes } from "react-router-dom";
import { LoadingBlock } from "./ui";
import { themeTokens, type ThemeMode } from "../theme/theme";

const DashboardPage = React.lazy(async () => ({ default: (await import("../pages/dashboard")).DashboardPage }));
const AssetsPage = React.lazy(async () => ({ default: (await import("../pages/assets")).AssetsPage }));
const RulesPage = React.lazy(async () => ({ default: (await import("../pages/rules")).RulesPage }));
const WorkflowPage = React.lazy(async () => ({ default: (await import("../pages/workflow")).WorkflowPage }));
const ReportsPage = React.lazy(async () => ({ default: (await import("../pages/reports")).ReportsPage }));
const AuditPage = React.lazy(async () => ({ default: (await import("../pages/audit")).AuditPage }));

export function WorkspaceFrame({
  mode,
  setMode: _,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  const [queryClient] = React.useState(() => new QueryClient());
  const isDark = mode === "dark";
  const tokens = themeTokens[mode];

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: tokens,
        }}
      >
        <React.Suspense fallback={<LoadingBlock label="页面加载中" />}>
          <Routes>
            <Route path="/" element={<DashboardPage mode={mode} />} />
            <Route path="/assets" element={<AssetsPage mode={mode} />} />
            <Route path="/rules" element={<RulesPage mode={mode} />} />
            <Route path="/workflow" element={<WorkflowPage mode={mode} />} />
            <Route path="/reports" element={<ReportsPage mode={mode} />} />
            <Route path="/audit" element={<AuditPage mode={mode} />} />
            <Route
              path="*"
              element={
                <div className="shell-panel">
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>页面不存在</h3>
                  <p style={{ margin: 0, color: "var(--shell-muted)" }}>当前路径不在这套前端工作台路由范围内。</p>
                </div>
              }
            />
          </Routes>
        </React.Suspense>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
