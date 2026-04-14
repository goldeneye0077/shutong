import React from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./auth";
import "./shell.css";
import { getDefaultTheme, surfaceStyle } from "./themeStyles";
import { themeStorageKey, type ThemeMode } from "../theme/theme";

const LoginPage = React.lazy(async () => ({ default: (await import("../pages/login")).LoginPage }));
const WorkspaceFrame = React.lazy(async () => ({
  default: (await import("./WorkspaceFrame")).WorkspaceFrame,
}));

const navItems = [
  {
    key: "dashboard",
    label: "态势总览",
    shortLabel: "01",
    path: "/",
    caption: "值守总盘",
    description: "先看全局态势、在途任务和待处置问题，再进入具体模块。",
  },
  {
    key: "assets",
    label: "对象与配置",
    shortLabel: "02",
    path: "/assets",
    caption: "资产入湖",
    description: "管理治理对象、配置版本、解析结果和标准化快照。",
  },
  {
    key: "rules",
    label: "规则与巡检",
    shortLabel: "03",
    path: "/rules",
    caption: "执行链路",
    description: "创建规则、发起巡检，并跟踪执行中的规则命中情况。",
  },
  {
    key: "workflow",
    label: "闭环处置",
    shortLabel: "04",
    path: "/workflow",
    caption: "处置工位",
    description: "对问题建单、更新状态、提交例外并完成审批闭环。",
  },
  {
    key: "reports",
    label: "报告中心",
    shortLabel: "05",
    path: "/reports",
    caption: "产物输出",
    description: "发起报告生成，跟踪产物状态并下载正式材料。",
  },
  {
    key: "audit",
    label: "审计日志",
    shortLabel: "06",
    path: "/audit",
    caption: "行为追踪",
    description: "查看关键接口访问、下载动作和流程留痕。",
  },
] as const;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function ThemeToggle({
  mode,
  setMode,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  return (
    <button
      className="shell-button shell-button-secondary"
      type="button"
      onClick={() => {
        const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
        setMode(nextMode);
        window.localStorage.setItem(themeStorageKey, nextMode);
      }}
    >
      <span>{mode === "dark" ? "深色模式" : "浅色模式"}</span>
      <span>{mode === "dark" ? "切换到浅色" : "切换到深色"}</span>
    </button>
  );
}

function AppRoutes({
  mode,
  setMode,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  const { accessToken, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentMenuKey =
    location.pathname === "/" ? "dashboard" : location.pathname.split("/")[1] || "dashboard";
  const currentNav = navItems.find((item) => item.key === currentMenuKey) ?? navItems[0];
  const isDark = mode === "dark";

  return (
    <div
      className="shell-root"
      style={
        {
          ...surfaceStyle(mode),
          "--shell-text": isDark ? "#edf7ff" : "#11233c",
          "--shell-muted": isDark ? "#8ea6c8" : "#5d708c",
          "--shell-border": isDark ? "rgba(73, 152, 218, 0.16)" : "rgba(17, 35, 60, 0.1)",
          "--shell-border-strong": isDark ? "rgba(88, 206, 255, 0.34)" : "rgba(15, 140, 255, 0.28)",
          "--shell-sidebar-bg":
            isDark
              ? "linear-gradient(180deg, rgba(4, 12, 24, 0.98), rgba(4, 13, 27, 0.96))"
              : "linear-gradient(180deg, rgba(10, 22, 39, 0.98), rgba(12, 29, 48, 0.96))",
          "--shell-sidebar-text": "#edf7ff",
          "--shell-sidebar-muted": isDark ? "#7d97ba" : "#a5c2e0",
          "--shell-nav-active-bg": isDark ? "rgba(26, 112, 194, 0.18)" : "rgba(15, 140, 255, 0.18)",
          "--shell-nav-active-border": isDark ? "rgba(48, 213, 255, 0.42)" : "rgba(15, 140, 255, 0.36)",
          "--shell-accent": isDark ? "#30d5ff" : "#0f8cff",
          "--shell-accent-strong": isDark ? "#7af1ff" : "#2ba3ff",
          "--shell-accent-soft": isDark ? "rgba(48, 213, 255, 0.14)" : "rgba(15, 140, 255, 0.12)",
          "--shell-pill-bg": isDark ? "rgba(8, 17, 32, 0.76)" : "rgba(255, 255, 255, 0.84)",
          "--shell-button-bg":
            isDark ? "linear-gradient(135deg, #08bdf4 0%, #1e7dff 100%)" : "linear-gradient(135deg, #1297ff 0%, #0f6dff 100%)",
          "--shell-button-text": "#f8fcff",
          "--shell-panel-bg":
            isDark
              ? "linear-gradient(180deg, rgba(7, 18, 34, 0.92), rgba(4, 11, 24, 0.9))"
              : "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(244, 249, 255, 0.96))",
          "--shell-panel-shadow":
            isDark
              ? "0 24px 64px rgba(2, 8, 20, 0.48), inset 0 1px 0 rgba(120, 227, 255, 0.05)"
              : "0 18px 40px rgba(17, 35, 60, 0.08)",
          "--shell-input-bg": isDark ? "rgba(6, 14, 28, 0.94)" : "rgba(255, 255, 255, 0.98)",
          "--shell-main-bg": isDark ? "rgba(2, 9, 19, 0.36)" : "rgba(240, 246, 253, 0.72)",
          "--shell-stat-bg": isDark ? "rgba(6, 14, 28, 0.72)" : "rgba(248, 251, 255, 0.96)",
          "--shell-row-hover": isDark ? "rgba(48, 213, 255, 0.08)" : "rgba(15, 140, 255, 0.06)",
        } as React.CSSProperties
      }
    >
      <Routes>
        <Route
          path="/login"
          element={
            <React.Suspense fallback={<div className="shell-loading">正在载入登录入口...</div>}>
              <LoginPage mode={mode} />
            </React.Suspense>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <div className="shell-frame">
                <aside className="shell-sidebar">
                  <div className="shell-brand">
                    <span className="shell-overline">Core Network Compliance Console</span>
                    <div className="shell-brand-lockup">
                      <span className="shell-brand-mark">CN</span>
                      <div>
                        <h1 className="shell-title">核心网合规科技控制台</h1>
                        <p className="shell-subtitle">
                          用更克制的科技感重做整站壳层，让运维控制台既有信号密度，也保持值守场景的可读性。
                        </p>
                      </div>
                    </div>
                    <div className="shell-brand-pulse">
                      <span className="shell-live-dot" />
                      <span>北向任务总线在线</span>
                    </div>
                  </div>

                  <div className="shell-sidebar-card shell-sidebar-card-glow">
                    <span className="shell-sidebar-card-label">系统形态</span>
                    <strong>Frontend / Backend / Data-Service</strong>
                    <p>
                      前端只承担交互和视图，业务 API 统一收在 backend，解析、规则执行、报告和 AI 摘要都在
                      data-service 内闭环完成。
                    </p>
                    <div className="shell-sidebar-mini-grid">
                      <div>
                        <span>接口基座</span>
                        <strong>/api/v1</strong>
                      </div>
                      <div>
                        <span>执行原则</span>
                        <strong>AI 需复核</strong>
                      </div>
                    </div>
                  </div>

                  <span className="shell-nav-label">导航索引</span>
                  <nav className="shell-nav">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.path}
                        end={item.path === "/"}
                        className={({ isActive }) =>
                          `shell-nav-link${isActive ? " shell-nav-link-active" : ""}`
                        }
                      >
                        <span className="shell-nav-badge">{item.shortLabel}</span>
                        <span className="shell-nav-copy">
                          <strong>{item.label}</strong>
                          <small>{item.caption}</small>
                        </span>
                      </NavLink>
                    ))}
                  </nav>

                  <div className="shell-sidebar-footer">
                    <div className="shell-sidebar-pill">本地联调</div>
                    <div className="shell-sidebar-pill">深色优先</div>
                    <div className="shell-sidebar-pill">审计留痕</div>
                  </div>
                </aside>

                <main className="shell-main">
                  <header className="shell-header">
                    <div className="shell-header-copy">
                      <span className="shell-overline">Current Sector</span>
                      <h2>{currentNav.label}</h2>
                      <p>{currentNav.description}</p>
                    </div>
                    <div className="shell-header-actions">
                      <div className="shell-pill">
                        <span className="shell-live-dot" />
                        <span>{user?.full_name || user?.username || "当前用户"}</span>
                      </div>
                      <div className="shell-pill shell-pill-muted">接口基座 /api/v1</div>
                      <ThemeToggle mode={mode} setMode={setMode} />
                      {accessToken ? (
                        <button
                          className="shell-button shell-button-secondary"
                          type="button"
                          onClick={() => {
                            signOut();
                            navigate("/login", { replace: true });
                          }}
                        >
                          退出登录
                        </button>
                      ) : null}
                    </div>
                  </header>

                  <div className="shell-command-ribbon">
                    <div>
                      <span className="shell-command-label">当前工作面</span>
                      <strong>{currentNav.caption}</strong>
                    </div>
                    <div>
                      <span className="shell-command-label">视觉模式</span>
                      <strong>{isDark ? "Dark Tech" : "Light Lab"}</strong>
                    </div>
                    <div>
                      <span className="shell-command-label">策略约束</span>
                      <strong>服务侧生成，前台只展示</strong>
                    </div>
                  </div>

                  <React.Suspense fallback={<div className="shell-loading">正在载入工作台...</div>}>
                    <WorkspaceFrame mode={mode} setMode={setMode} />
                  </React.Suspense>
                </main>
              </div>
            </RequireAuth>
          }
        />
      </Routes>
    </div>
  );
}

export function AppShell() {
  const [mode, setMode] = React.useState<ThemeMode>(getDefaultTheme);

  return (
    <BrowserRouter>
      <AppRoutes mode={mode} setMode={setMode} />
    </BrowserRouter>
  );
}
