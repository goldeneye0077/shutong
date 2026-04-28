import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import type { ThemeMode } from "../theme/theme";

export function LoginPage({ mode }: { mode: ThemeMode }) {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("admin123");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await signIn(username, password);
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shell-login-wrap">
      <div className="shell-login-grid">
        <section className="shell-panel shell-login-hero">
          <div className="shell-login-copy">
            <span className="shell-overline">核心网配置合规</span>
            <h1>
              核心网配置安全
              <br />
              值守控制台
            </h1>
            <p>面向日常巡检、风险闭环和报告留痕，前端只承载交互与状态，不越过后台执行边界。</p>
          </div>

          <div className="shell-login-board">
            <div className="shell-login-board-card">
              <span>入口</span>
              <strong>前端</strong>
              <p>页面、主题、上传入口和任务状态轮询。</p>
            </div>
            <div className="shell-login-board-card">
              <span>编排</span>
              <strong>后端</strong>
              <p>认证、角色权限、资源接口、审计和任务元数据。</p>
            </div>
            <div className="shell-login-board-card">
              <span>执行</span>
              <strong>数据服务</strong>
              <p>解析、规则执行、报告产物和智能摘要草稿。</p>
            </div>
          </div>

          <div className="shell-login-terminal">
            <div className="shell-login-terminal-line">
              <span>主题模式</span>
              <strong>{mode === "dark" ? "深色驾驶舱" : "浅色驾驶舱"}</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>公共接口</span>
              <strong>/api/v1</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>任务队列</span>
              <strong>PostgreSQL 任务队列</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>智能分析策略</span>
              <strong>人工复核后采用</strong>
            </div>
          </div>
        </section>

        <section className="shell-panel shell-login-panel">
          <div className="shell-login-panel-head">
            <span className="shell-overline" style={{ color: "var(--shell-accent)" }}>
              登录
            </span>
            <h2>进入平台</h2>
            <p>
              初始账号 <code>admin / admin123</code>。登录后进入值守总览。
            </p>
          </div>

          {errorMessage ? <div className="shell-error">{errorMessage}</div> : null}

          <form className="shell-form" onSubmit={handleSubmit}>
            <div className="shell-field">
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                className="shell-input"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="shell-field">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                className="shell-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button className="shell-button" type="submit" disabled={submitting}>
              {submitting ? "正在登录..." : "进入值守台"}
            </button>

            <p className="shell-help">写操作会通过后端创建任务，再由数据服务异步处理。</p>
          </form>
        </section>
      </div>
    </div>
  );
}
