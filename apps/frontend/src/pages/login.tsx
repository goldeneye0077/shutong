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
            <span className="shell-overline">Tech Ops Entry</span>
            <h1>
              让合规态势
              <br />
              像控制台一样清晰。
            </h1>
            <p>
              这套前端不再走演示页路线，而是按真实值守控制台重做。视觉上用深海色底和冷青高亮建立科技感，信息上仍坚持少噪声、高可读、强操作的运维逻辑。
            </p>
            <p>
              前端只接入 backend 的统一 API，解析、规则执行、报告生成和 AI 草稿都留在服务侧完成，避免把执行复杂度泄露到操作面。
            </p>
          </div>

          <div className="shell-login-board">
            <div className="shell-login-board-card">
              <span>解析吞吐</span>
              <strong>96.8%</strong>
              <p>过去 24 小时配置解析成功率，作为值守入口的首个健康信号。</p>
            </div>
            <div className="shell-login-board-card">
              <span>巡检队列</span>
              <strong>12</strong>
              <p>当前仍处于排队或执行中的巡检任务，用来提示控制台负载。</p>
            </div>
            <div className="shell-login-board-card">
              <span>复核约束</span>
              <strong>{mode === "dark" ? "Dark Tech" : "Light Lab"}</strong>
              <p>AI 输出只作为草稿，不会直接写成最终结论，始终保留人工确认环节。</p>
            </div>
          </div>

          <div className="shell-login-terminal">
            <div className="shell-login-terminal-line">
              <span>northbound.bus</span>
              <strong>online</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>worker.pipeline</span>
              <strong>parse / rules / report</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>execution.model</span>
              <strong>frontend / backend / data-service</strong>
            </div>
            <div className="shell-login-terminal-line">
              <span>review.policy</span>
              <strong>AI draft requires approval</strong>
            </div>
          </div>
        </section>

        <section className="shell-panel shell-login-panel">
          <div className="shell-login-panel-head">
            <span className="shell-overline" style={{ color: "var(--shell-accent)" }}>
              登录入口
            </span>
            <h2>进入核心网合规控制台</h2>
            <p>
              默认初始化管理员账号为 <code>admin / admin123</code>。登录页保持轻量，真正较重的工作台资源会在认证通过后懒加载。
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
              {submitting ? "正在登录..." : "进入工作台"}
            </button>

            <p className="shell-help">
              登录完成后，你会直接进入科技风值守控制台。所有写操作都仍然走现有接口，不改变三域边界。
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
