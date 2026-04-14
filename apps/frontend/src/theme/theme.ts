export type ThemeMode = "light" | "dark";

export const themeStorageKey = "core-network-compliance-theme";

export const themeTokens = {
  light: {
    colorBgLayout: "#e8eff8",
    colorBgContainer: "rgba(255, 255, 255, 0.94)",
    colorPrimary: "#0f8cff",
    colorInfo: "#0f8cff",
    colorSuccess: "#13c296",
    colorWarning: "#ffb020",
    colorError: "#ff5f7a",
    colorText: "#11233c",
    colorTextSecondary: "#5d708c",
    colorBorderSecondary: "rgba(17, 35, 60, 0.1)",
    colorFillSecondary: "rgba(17, 35, 60, 0.04)",
    borderRadius: 18,
    borderRadiusLG: 22,
    boxShadowSecondary: "0 20px 44px rgba(17, 35, 60, 0.08)",
    fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
  },
  dark: {
    colorBgLayout: "#020913",
    colorBgContainer: "rgba(7, 18, 34, 0.9)",
    colorPrimary: "#30d5ff",
    colorInfo: "#30d5ff",
    colorSuccess: "#29d3a3",
    colorWarning: "#ffbf4d",
    colorError: "#ff627d",
    colorText: "#edf7ff",
    colorTextSecondary: "#8ea6c8",
    colorBorderSecondary: "rgba(73, 152, 218, 0.18)",
    colorFillSecondary: "rgba(48, 213, 255, 0.06)",
    borderRadius: 18,
    borderRadiusLG: 22,
    boxShadowSecondary: "0 24px 60px rgba(2, 8, 20, 0.56)",
    fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
  }
} as const;
