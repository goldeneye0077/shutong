import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { LoadingBlock } from "./ui";
import type { ThemeMode } from "../theme/theme";

const DashboardPage = React.lazy(async () => ({ default: (await import("../pages/dashboard")).DashboardPage }));
const AssetsPage = React.lazy(async () => ({ default: (await import("../pages/assets")).AssetsPage }));
const RulesPage = React.lazy(async () => ({ default: (await import("../pages/rules")).RulesPage }));
const WorkflowPage = React.lazy(async () => ({ default: (await import("../pages/workflow")).WorkflowPage }));
const ReportsPage = React.lazy(async () => ({ default: (await import("../pages/reports")).ReportsPage }));
const AuditPage = React.lazy(async () => ({ default: (await import("../pages/audit")).AuditPage }));
const PlatformPage = React.lazy(async () => ({ default: (await import("../pages/platform")).PlatformPage }));

function MenuProtectedPage({
  menuKey,
  children,
}: {
  menuKey: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const menus = new Set(user?.menu_items ?? []);
  if (menus.size > 0 && !menus.has("*") && !menus.has(menuKey)) {
    return (
      <div className="shell-panel">
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>无权访问</h3>
        <p style={{ margin: 0, color: "var(--shell-muted)" }}>当前角色未开通该菜单，请联系管理员调整角色权限。</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function WorkspaceFrame({
  mode,
  setMode: _,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <React.Suspense fallback={<LoadingBlock label="页面加载中" />}>
          <Routes>
            <Route path="/" element={<MenuProtectedPage menuKey="dashboard"><DashboardPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/assets" element={<MenuProtectedPage menuKey="assets"><AssetsPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/rules" element={<MenuProtectedPage menuKey="rules"><RulesPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/workflow" element={<MenuProtectedPage menuKey="workflow"><WorkflowPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/reports" element={<MenuProtectedPage menuKey="reports"><ReportsPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/audit" element={<MenuProtectedPage menuKey="audit"><AuditPage mode={mode} /></MenuProtectedPage>} />
            <Route path="/platform" element={<MenuProtectedPage menuKey="platform"><PlatformPage mode={mode} /></MenuProtectedPage>} />
            <Route
              path="*"
              element={
                <div className="shell-panel">
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>页面不存在</h3>
                  <p style={{ margin: 0, color: "var(--shell-muted)" }}>
                    当前路径不在这套前端工作台路由范围内。
                  </p>
                </div>
              }
            />
          </Routes>
        </React.Suspense>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
