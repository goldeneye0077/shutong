import type { ThemeMode } from "../theme/theme";

export function getDefaultTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem("core-network-compliance-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "dark";
}

export function panelStyle(mode: ThemeMode): React.CSSProperties {
  return {
    background:
      mode === "dark"
        ? "linear-gradient(180deg, rgba(7, 18, 34, 0.92), rgba(4, 11, 24, 0.9))"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(244, 249, 255, 0.96))",
    border: `1px solid ${mode === "dark" ? "rgba(73, 152, 218, 0.16)" : "rgba(17, 35, 60, 0.1)"}`,
    borderRadius: 24,
    padding: 24,
    boxShadow:
      mode === "dark"
        ? "0 22px 60px rgba(2, 8, 20, 0.48), inset 0 1px 0 rgba(120, 227, 255, 0.04)"
        : "0 18px 40px rgba(17, 35, 60, 0.08)"
  };
}

export function surfaceStyle(mode: ThemeMode): React.CSSProperties {
  return {
    background:
      mode === "dark"
        ? [
            "radial-gradient(circle at 12% 12%, rgba(48, 213, 255, 0.16), transparent 18%)",
            "radial-gradient(circle at 88% 4%, rgba(16, 100, 255, 0.12), transparent 22%)",
            "linear-gradient(180deg, #020913 0%, #040d1b 40%, #061323 100%)",
          ].join(", ")
        : [
            "radial-gradient(circle at 18% 14%, rgba(15, 140, 255, 0.12), transparent 18%)",
            "radial-gradient(circle at 84% 8%, rgba(20, 205, 255, 0.1), transparent 20%)",
            "linear-gradient(180deg, #edf4fb 0%, #e5eef8 100%)",
          ].join(", ")
  };
}
