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
        ? "linear-gradient(180deg, rgba(12, 23, 40, 0.94), rgba(5, 11, 23, 0.96))"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(240, 246, 255, 0.9))",
    border: `1px solid ${mode === "dark" ? "rgba(42, 168, 255, 0.18)" : "rgba(35, 78, 135, 0.12)"}`,
    borderRadius: 22,
    padding: 22,
    boxShadow:
      mode === "dark"
        ? "0 22px 54px rgba(0, 0, 0, 0.32)"
        : "0 16px 36px rgba(76, 102, 128, 0.12)"
  };
}

export function surfaceStyle(mode: ThemeMode): React.CSSProperties {
  return {
    background:
      mode === "dark"
        ? [
            "radial-gradient(circle at 12% 0%, rgba(42, 168, 255, 0.2), transparent 26%)",
            "radial-gradient(circle at 82% 8%, rgba(32, 215, 255, 0.14), transparent 28%)",
            "radial-gradient(circle at 50% 110%, rgba(23, 105, 255, 0.18), transparent 34%)",
            "linear-gradient(135deg, #050b17 0%, #07172b 48%, #040914 100%)",
          ].join(", ")
        : [
            "radial-gradient(circle at 10% 8%, rgba(23, 105, 255, 0.1), transparent 24%)",
            "radial-gradient(circle at 86% 10%, rgba(0, 157, 255, 0.1), transparent 24%)",
            "linear-gradient(135deg, #eef5ff 0%, #ffffff 52%, #eaf4ff 100%)",
          ].join(", ")
  };
}
