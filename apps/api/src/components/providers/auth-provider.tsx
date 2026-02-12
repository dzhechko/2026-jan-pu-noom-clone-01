"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { TelegramContext } from "./telegram-provider";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  subscriptionTier: string;
  telegramId: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

const TOKEN_KEY = "vesna_access_token";
const REFRESH_KEY = "vesna_refresh_token";

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* WebView may block storage */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* WebView may block storage */ }
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { isTelegram, initData, ready } = useContext(TelegramContext);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAuthResponse = useCallback(
    (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      setUser(data.user);
      setToken(data.accessToken);
      safeSetItem(TOKEN_KEY, data.accessToken);
      safeSetItem(REFRESH_KEY, data.refreshToken);
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    safeRemoveItem(TOKEN_KEY);
    safeRemoveItem(REFRESH_KEY);
  }, []);

  // Auto-authenticate with Telegram initData
  useEffect(() => {
    if (!ready) return; // Wait for TelegramProvider to finish detection

    const controller = new AbortController();
    const signal = controller.signal;

    // Safety timeout: force exit loading after 10s even if fetch hangs
    const timeout = setTimeout(() => setLoading(false), 10_000);

    if (!isTelegram || !initData) {
      // Try to restore from localStorage
      const savedToken = safeGetItem(TOKEN_KEY);
      if (savedToken) {
        setToken(savedToken);
        // Validate token by fetching profile
        fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${savedToken}` },
          signal,
        })
          .then((res) => {
            if (res.ok) return res.json();
            // Token expired — try refresh
            const refreshToken = safeGetItem(REFRESH_KEY);
            if (!refreshToken) throw new Error("No refresh token");
            return fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
              signal,
            }).then((refreshRes) => {
              if (!refreshRes.ok) throw new Error("Refresh failed");
              return refreshRes.json().then((tokens) => {
                safeSetItem(TOKEN_KEY, tokens.accessToken);
                safeSetItem(REFRESH_KEY, tokens.refreshToken);
                setToken(tokens.accessToken);
                // Retry profile fetch with new token
                return fetch("/api/user/profile", {
                  headers: { Authorization: `Bearer ${tokens.accessToken}` },
                  signal,
                }).then((r) => {
                  if (r.ok) return r.json();
                  throw new Error("Profile fetch failed after refresh");
                });
              });
            });
          })
          .then((data) => setUser(data.user))
          .catch((err) => {
            if (err instanceof DOMException && err.name === "AbortError") return;
            logout();
          })
          .finally(() => { clearTimeout(timeout); setLoading(false); });
      } else {
        clearTimeout(timeout);
        setLoading(false);
      }
      return () => { controller.abort(); clearTimeout(timeout); };
    }

    // Telegram auth
    fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Telegram auth failed");
        return res.json();
      })
      .then(handleAuthResponse)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Telegram auth error:", err);
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    return () => { controller.abort(); clearTimeout(timeout); };
  }, [ready, isTelegram, initData, handleAuthResponse, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Ошибка входа");
      }

      handleAuthResponse(await res.json());
    },
    [handleAuthResponse],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Ошибка регистрации");
      }

      handleAuthResponse(await res.json());
    },
    [handleAuthResponse],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
