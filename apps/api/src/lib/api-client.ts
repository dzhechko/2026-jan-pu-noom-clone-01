const TOKEN_KEY = "vesna_access_token";

interface ApiOptions {
  token?: string | null;
}

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  status: number;
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

  if (res.status === 401) {
    // Token expired — clear auth
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("vesna_refresh_token");
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

export const api = {
  get: <T>(url: string, options?: ApiOptions) => request<T>("GET", url, undefined, options),
  post: <T>(url: string, body?: unknown, options?: ApiOptions) => request<T>("POST", url, body, options),
  patch: <T>(url: string, body?: unknown, options?: ApiOptions) => request<T>("PATCH", url, body, options),
  delete: <T>(url: string, options?: ApiOptions) => request<T>("DELETE", url, undefined, options),
};
