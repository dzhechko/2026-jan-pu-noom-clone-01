const TOKEN_KEY = "vesna_access_token";
const REFRESH_KEY = "vesna_refresh_token";

interface ApiOptions {
  token?: string | null;
  /** Skip token refresh on 401 (used internally to prevent loops) */
  _skipRefresh?: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  status: number;
}

/** Singleton refresh promise to prevent concurrent refresh calls */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<ApiResponse<T>> {
  const token = options?.token ?? (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    console.error(`[api-client] ${method} ${url} fetch failed:`, err);
    return { data: null, error: { code: "GEN_002", message: "Нет соединения с сервером" }, status: 0 };
  }

  if (res.status === 401 && !options?._skipRefresh) {
    // Try to refresh the token (deduplicate concurrent refreshes)
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry the original request with the new token
      return request<T>(method, url, body, { ...options, _skipRefresh: true });
    }
    // Refresh failed — clear auth and redirect
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      window.location.href = "/login";
    }
    return { data: null, error: { code: "AUTH_001", message: "Сессия истекла" }, status: 401 };
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch (err) {
    console.error(`[api-client] ${method} ${url} JSON parse failed (${res.status}):`, err);
    return { data: null, error: { code: "GEN_001", message: `Ошибка сервера (${res.status})` }, status: res.status };
  }

  if (!res.ok) {
    return { data: null, error: (json.error as { code: string; message: string }) ?? { code: "GEN_001", message: "Ошибка" }, status: res.status };
  }

  return { data: json as T, error: null, status: res.status };
}

export function getAuthToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export const api = {
  get: <T>(url: string, options?: ApiOptions) => request<T>("GET", url, undefined, options),
  post: <T>(url: string, body?: unknown, options?: ApiOptions) => request<T>("POST", url, body, options),
  patch: <T>(url: string, body?: unknown, options?: ApiOptions) => request<T>("PATCH", url, body, options),
  delete: <T>(url: string, options?: ApiOptions) => request<T>("DELETE", url, undefined, options),
};
