import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          const normalizedId = id.replace(/\\/g, "/");

          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/scheduler/")
          ) {
            return "react-core";
          }

          if (normalizedId.includes("@tanstack/react-query")) {
            return "query";
          }

          if (normalizedId.includes("react-router-dom") || normalizedId.includes("@remix-run/router")) {
            return "router";
          }

          if (normalizedId.includes("@arco-design/web-react/icon")) {
            return "arco-icons";
          }

          if (
            normalizedId.includes("@arco-design/web-react") ||
            normalizedId.includes("b-validate") ||
            normalizedId.includes("resize-observer-polyfill") ||
            normalizedId.includes("react-transition-group") ||
            normalizedId.includes("dayjs")
          ) {
            return "arco-ui";
          }

          return undefined;
        }
      }
    }
  }
});
