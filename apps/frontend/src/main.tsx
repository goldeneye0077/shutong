import React from "react";
import ReactDOM from "react-dom/client";
import "./app/arcoStyles";
import { AppShell } from "./app/AppShell";
import { AuthProvider } from "./app/auth";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
