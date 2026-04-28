export type ThemeMode = "light" | "dark";

export const themeStorageKey = "core-network-compliance-theme";

export const themeTokens = {
  light: {
    colorBgLayout: "#eef5ff",
    colorBgContainer: "#ffffff",
    colorPrimary: "#1769ff",
    colorInfo: "#009dff",
    colorSuccess: "#21a86f",
    colorWarning: "#df7a16",
    colorError: "#d94a62",
    colorText: "#0f2038",
    colorTextSecondary: "#60738f",
    colorBorderSecondary: "rgba(35, 78, 135, 0.12)",
    colorFillSecondary: "rgba(23, 105, 255, 0.06)",
    borderRadius: 14,
    borderRadiusLG: 22,
    boxShadowSecondary: "0 18px 42px rgba(76, 102, 128, 0.14)",
    fontFamily: "\"Manrope\", \"IBM Plex Sans\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
  },
  dark: {
    colorBgLayout: "#050b17",
    colorBgContainer: "#0c1728",
    colorPrimary: "#2aa8ff",
    colorInfo: "#20d7ff",
    colorSuccess: "#31d394",
    colorWarning: "#ffb13b",
    colorError: "#ff5f73",
    colorText: "#f3f8ff",
    colorTextSecondary: "#96abc7",
    colorBorderSecondary: "rgba(42, 168, 255, 0.18)",
    colorFillSecondary: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    borderRadiusLG: 22,
    boxShadowSecondary: "0 24px 68px rgba(0, 0, 0, 0.42)",
    fontFamily: "\"Manrope\", \"IBM Plex Sans\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
  }
} as const;
