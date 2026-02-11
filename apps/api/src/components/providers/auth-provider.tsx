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

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { isTelegram, initData } = useContext(TelegramContext);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAuthResponse = useCallback(
    (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      setUser(data.user);
      setToken(data.accessToken);
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }, []);

  // Auto-authenticate with Telegram initData
  useEffect(() => {
    if (!isTelegram || !initData) {
      // Try to restore from localStorage
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        setToken(savedToken);
        // Validate token by fetching profile
        fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error("Invalid token");
          })
          .then((data) => setUser(data.user))
          .catch(() => logout())
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    // Telegram auth
    fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Telegram auth failed");
        return res.json();
      })
      .then(handleAuthResponse)
      .catch((err) => {
        console.error("Telegram auth error:", err);
      })
      .finally(() => setLoading(false));
  }, [isTelegram, initData, handleAuthResponse, logout]);

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
