import React from "react";
import {
  IconApps,
  IconBranch,
  IconCommand,
  IconDashboard,
  IconFile,
  IconMoon,
  IconNotification,
  IconQuestionCircle,
  IconSafe,
  IconSearch,
  IconSettings,
  IconSun,
} from "@arco-design/web-react/icon";
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
import {
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { themeStorageKey, type ThemeMode } from "../theme/theme";
import type { NotificationItem } from "../types/api";

const LoginPage = React.lazy(async () => ({ default: (await import("../pages/login")).LoginPage }));
const WorkspaceFrame = React.lazy(async () => ({
  default: (await import("./WorkspaceFrame")).WorkspaceFrame,
}));

const navItems = [
  {
    key: "dashboard",
    label: "值守总览",
    description: "态势",
    path: "/",
    icon: <IconDashboard />,
  },
  {
    key: "assets",
    label: "对象配置",
    description: "资产 / 配置",
    path: "/assets",
    icon: <IconApps />,
  },
  {
    key: "rules",
    label: "规则巡检",
    description: "规则 / 执行",
    path: "/rules",
    icon: <IconBranch />,
  },
  {
    key: "workflow",
    label: "闭环处置",
    description: "问题 / 工单",
    path: "/workflow",
    icon: <IconCommand />,
  },
  {
    key: "reports",
    label: "报告中心",
    description: "产物 / 草稿",
    path: "/reports",
    icon: <IconFile />,
  },
  {
    key: "audit",
    label: "审计日志",
    description: "事件留痕",
    path: "/audit",
    icon: <IconSafe />,
  },
  {
    key: "platform",
    label: "平台管理",
    description: "台账 / 权限",
    path: "/platform",
    icon: <IconSettings />,
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

function initialsFromName(value?: string | null): string {
  if (!value) {
    return "数";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "数";
  }

  const latinParts = trimmed
    .split(/\s+/)
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (latinParts) {
    return latinParts;
  }

  return trimmed.slice(0, 2).toUpperCase();
}

function visibleUserName(value?: string | null): string {
  if (!value || value === "Bootstrap Admin") {
    return "管理员";
  }
  return value;
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
      className="shell-icon-button"
      type="button"
      aria-label={mode === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      onClick={() => {
        const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
        setMode(nextMode);
        window.localStorage.setItem(themeStorageKey, nextMode);
      }}
    >
      {mode === "dark" ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function formatNotificationTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationCenter({ accessToken }: { accessToken: string | null }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const refreshNotifications = React.useCallback(async () => {
    if (!accessToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [items, count] = await Promise.all([
        listNotifications(accessToken),
        getNotificationUnreadCount(accessToken),
      ]);
      setNotifications(items.slice(0, 8));
      setUnreadCount(count.unread_count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void refreshNotifications();
    if (!accessToken) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [accessToken, refreshNotifications]);

  const markOneRead = async (notificationId: string) => {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    try {
      await markNotificationRead(accessToken, notificationId);
      await refreshNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    try {
      await markAllNotificationsRead(accessToken);
      await refreshNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="shell-notification-center">
      <button
        className="shell-icon-button"
        type="button"
        aria-label="消息提醒"
        onClick={() => {
          setIsOpen((current) => !current);
          void refreshNotifications();
        }}
      >
        <IconNotification aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="shell-notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>
      {isOpen ? (
        <div className="shell-notification-popover">
          <div className="shell-notification-header">
            <span>
              <strong>消息中心</strong>
              <small>{unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}</small>
            </span>
            <button type="button" disabled={isLoading || unreadCount === 0} onClick={markAllRead}>
              全部已读
            </button>
          </div>
          <div className="shell-notification-list">
            {notifications.length === 0 ? (
              <div className="shell-notification-empty">暂无提醒</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  className={`shell-notification-item${item.status === "unread" ? " shell-notification-item-unread" : ""}`}
                  type="button"
                  onClick={() => {
                    if (item.status === "unread") {
                      void markOneRead(item.id);
                    }
                  }}
                >
                  <span className={`shell-notification-level shell-notification-level-${item.level}`} />
                  <span className="shell-notification-copy">
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                    <em>{formatNotificationTime(item.created_at)}</em>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createShellThemeStyle(mode: ThemeMode, isDark: boolean): React.CSSProperties {
  return {
    ...surfaceStyle(mode),
    "--shell-text": isDark ? "#f3f8ff" : "#0f2038",
    "--shell-muted": isDark ? "#96abc7" : "#60738f",
    "--shell-border": isDark ? "rgba(42, 168, 255, 0.15)" : "rgba(35, 78, 135, 0.12)",
    "--shell-border-strong": isDark ? "rgba(32, 215, 255, 0.36)" : "rgba(23, 105, 255, 0.24)",
    "--shell-sidebar-bg": isDark ? "rgba(4, 10, 21, 0.96)" : "rgba(255, 255, 255, 0.9)",
    "--shell-sidebar-text": isDark ? "#f3f8ff" : "#0f2038",
    "--shell-sidebar-muted": isDark ? "#88a0c0" : "#60738f",
    "--shell-nav-active-bg": isDark ? "rgba(42, 168, 255, 0.11)" : "rgba(23, 105, 255, 0.08)",
    "--shell-nav-active-border": isDark ? "rgba(32, 215, 255, 0.24)" : "rgba(23, 105, 255, 0.18)",
    "--shell-accent": isDark ? "#2aa8ff" : "#1769ff",
    "--shell-accent-strong": isDark ? "#76dcff" : "#009dff",
    "--shell-accent-soft": isDark ? "rgba(42, 168, 255, 0.12)" : "rgba(23, 105, 255, 0.1)",
    "--shell-success": isDark ? "#31d394" : "#21a86f",
    "--shell-warning": isDark ? "#ffb13b" : "#df7a16",
    "--shell-danger": isDark ? "#ff5f73" : "#d94a62",
    "--shell-pill-bg": isDark ? "rgba(12, 23, 40, 0.84)" : "rgba(255, 255, 255, 0.84)",
    "--shell-button-bg": "#1769ff",
    "--shell-button-text": "#ffffff",
    "--shell-panel-bg": isDark ? "rgba(10, 22, 38, 0.9)" : "rgba(255, 255, 255, 0.92)",
    "--shell-panel-shadow": isDark
      ? "0 22px 58px rgba(0, 0, 0, 0.34)"
      : "0 16px 36px rgba(76, 102, 128, 0.12)",
    "--shell-input-bg": isDark ? "rgba(6, 16, 30, 0.92)" : "rgba(255, 255, 255, 0.92)",
    "--shell-main-bg": "transparent",
    "--shell-stat-bg": isDark ? "rgba(12, 23, 40, 0.76)" : "rgba(255, 255, 255, 0.86)",
    "--shell-row-hover": isDark ? "rgba(42, 168, 255, 0.08)" : "rgba(23, 105, 255, 0.06)",
  } as React.CSSProperties;
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
  const [searchValue, setSearchValue] = React.useState("");
  const isDark = mode === "dark";
  const userName = visibleUserName(user?.full_name || user?.username);
  const shellStyle = React.useMemo(() => createShellThemeStyle(mode, isDark), [isDark, mode]);
  const visibleNavItems = React.useMemo(() => {
    const allowed = new Set(user?.menu_items ?? []);
    if (allowed.size === 0 || allowed.has("*")) {
      return navItems;
    }
    return navItems.filter((item) => allowed.has(item.key));
  }, [user?.menu_items]);

  React.useEffect(() => {
    const roots = [document.documentElement, document.body];
    roots.forEach((root) => {
      root.setAttribute("data-shell-theme", mode);
      root.setAttribute("arco-theme", mode);
      Object.entries(shellStyle).forEach(([key, value]) => {
        if (key.startsWith("--")) {
          root.style.setProperty(key, String(value));
        }
      });
    });

    return () => {
      roots.forEach((root) => {
        root.removeAttribute("data-shell-theme");
        root.removeAttribute("arco-theme");
        Object.keys(shellStyle).forEach((key) => {
          if (key.startsWith("--")) {
            root.style.removeProperty(key);
          }
        });
      });
    };
  }, [mode, shellStyle]);

  return (
    <div
      className="shell-root"
      data-theme={mode}
      style={shellStyle}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <React.Suspense fallback={<div className="shell-loading">正在载入登录页...</div>}>
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
                    <div className="shell-brand-lockup">
                      <img className="shell-brand-logo" src="/china-mobile-logo.svg" alt="中国移动" />
                      <p className="shell-subtitle">配置核查 · 风险闭环 · 报告留痕</p>
                    </div>
                  </div>

                  <nav className="shell-nav">
                    {visibleNavItems.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.path}
                        end={item.path === "/"}
                        className={({ isActive }) =>
                          `shell-nav-link${isActive ? " shell-nav-link-active" : ""}`
                        }
                      >
                        <span className="shell-nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="shell-nav-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </NavLink>
                    ))}
                  </nav>

                  <div className="shell-support-card">
                    <div className="shell-support-copy">
                      <strong>值守通道</strong>
                      <span>写操作进入任务队列；例外、智能草稿和报告发布保持人工确认。</span>
                    </div>
                    <button className="shell-button shell-button-secondary" type="button">
                      <IconQuestionCircle aria-hidden="true" />
                      <span>查看边界</span>
                    </button>
                  </div>
                </aside>

                <main className="shell-main">
                  <div className="shell-topbar">
                    <div className="shell-topbar-title">
                      <strong>核心网配置安全合规平台</strong>
                    </div>
                    <div className="shell-topbar-actions">
                      <label className="shell-search shell-search-compact" aria-label="搜索">
                        <IconSearch aria-hidden="true" />
                        <input
                          value={searchValue}
                          onChange={(event) => setSearchValue(event.target.value)}
                          placeholder="搜索对象、巡检、问题、报告..."
                        />
                      </label>
                      <NotificationCenter accessToken={accessToken} />
                      <ThemeToggle mode={mode} setMode={setMode} />
                      <div className="shell-user-card">
                        <span className="shell-user-avatar">
                          {initialsFromName(userName)}
                        </span>
                        <div className="shell-user-meta">
                          <strong>{userName}</strong>
                          <span>值守管理员</span>
                        </div>
                      </div>
                      {accessToken ? (
                        <button
                          className="shell-quiet-button"
                          type="button"
                          onClick={() => {
                            signOut();
                            navigate("/login", { replace: true });
                          }}
                        >
                          退出
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="shell-main-body">
                    <React.Suspense fallback={<div className="shell-loading">正在载入工作台...</div>}>
                      <WorkspaceFrame mode={mode} setMode={setMode} />
                    </React.Suspense>
                  </div>
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
