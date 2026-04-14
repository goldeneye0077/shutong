import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("\\react\\") ||
            id.includes("/react-dom/") ||
            id.includes("\\react-dom\\") ||
            id.includes("/scheduler/") ||
            id.includes("\\scheduler\\")
          ) {
            return "react-core";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("react-router-dom") || id.includes("@remix-run/router")) {
            return "router";
          }

          if (
            id.includes("antd/es/button") ||
            id.includes("antd/es/form") ||
            id.includes("antd/es/input") ||
            id.includes("antd/es/modal") ||
            id.includes("antd/es/select") ||
            id.includes("antd/es/message") ||
            id.includes("rc-field-form") ||
            id.includes("async-validator") ||
            id.includes("rc-dialog") ||
            id.includes("rc-select") ||
            id.includes("rc-input") ||
            id.includes("rc-textarea") ||
            id.includes("rc-motion") ||
            id.includes("rc-picker") ||
            id.includes("dayjs")
          ) {
            return "antd-actions";
          }

          return undefined;
        }
      }
    }
  }
});
