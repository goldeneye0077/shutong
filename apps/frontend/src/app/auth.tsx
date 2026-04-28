import React from "react";
import { loginRequest } from "../services/api";
import type { TokenBundle, UserRead } from "../types/api";

const authStorageKey = "core-network-compliance-auth";

interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  user: UserRead;
}

interface AuthContextValue {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserRead | null;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function normalizeVisibleUser(user: UserRead): UserRead {
  if (user.full_name === "Bootstrap Admin") {
    return { ...user, full_name: "管理员" };
  }
  return user;
}

export function userHasPermission(user: UserRead | null | undefined, permission: string): boolean {
  const permissions = new Set(user?.permissions ?? []);
  if (permissions.has("*") || permissions.has(permission)) {
    return true;
  }
  const [resource] = permission.split(":");
  return permissions.has(`${resource}:*`);
}

function readStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(authStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuthState;
    const normalized = { ...parsed, user: normalizeVisibleUser(parsed.user) };
    if (normalized.user.full_name !== parsed.user.full_name) {
      window.localStorage.setItem(authStorageKey, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<StoredAuthState | null>(() => readStoredAuthState());

  const signIn = async (username: string, password: string) => {
    const bundle = await loginRequest(username, password);
    const nextState: StoredAuthState = {
      accessToken: bundle.access_token,
      refreshToken: bundle.refresh_token,
      user: normalizeVisibleUser(bundle.user),
    };
    setSession(nextState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(authStorageKey, JSON.stringify(nextState));
    }
  };

  const signOut = () => {
    setSession(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(authStorageKey);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken: session?.accessToken ?? null,
        refreshToken: session?.refreshToken ?? null,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.accessToken),
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
