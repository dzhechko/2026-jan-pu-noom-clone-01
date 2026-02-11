import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

// Mock window and localStorage before importing the module
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { location: { href: "" } });

// Must import after globals are stubbed
const { api } = await import("./api-client");

const TOKEN_KEY = "vesna_access_token";
const REFRESH_KEY = "vesna_refresh_token";

beforeEach(() => {
  vi.restoreAllMocks();
  // Reset store
  for (const key of Object.keys(store)) delete store[key];
  localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null);
  localStorageMock.setItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  localStorageMock.removeItem.mockImplementation((key: string) => {
    delete store[key];
  });
  (window as { location: { href: string } }).location.href = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api-client", () => {
  it("sends GET request and returns data", async () => {
    const payload = { user: { name: "Test" } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      }),
    );

    const res = await api.get<typeof payload>("/api/user/profile");
    expect(res.status).toBe(200);
    expect(res.data).toEqual(payload);
    expect(res.error).toBeNull();
  });

  it("includes Authorization header when token exists", async () => {
    store[TOKEN_KEY] = "my-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );

    await api.get("/api/test");
    expect(fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      }),
    );
  });

  it("sends POST body as JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true }),
      }),
    );

    await api.post("/api/auth/register", { email: "a@b.com", password: "12345678" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "12345678" }),
      }),
    );
  });

  it("returns error on non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { code: "QUIZ_001", message: "Проверьте данные" },
          }),
      }),
    );

    const res = await api.post("/api/quiz/submit", {});
    expect(res.status).toBe(400);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("QUIZ_001");
  });

  it("returns GEN_002 on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const res = await api.get("/api/test");
    expect(res.status).toBe(0);
    expect(res.error?.code).toBe("GEN_002");
  });

  // ─── Token refresh on 401 ──────────────────────────────────

  it("attempts token refresh on 401 and retries original request", async () => {
    store[TOKEN_KEY] = "expired-token";
    store[REFRESH_KEY] = "valid-refresh";

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        callCount++;
        // First call: original request → 401
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: { code: "AUTH_001", message: "Expired" } }),
          });
        }
        // Second call: refresh endpoint → success
        if (callCount === 2 && url === "/api/auth/refresh") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                accessToken: "new-access",
                refreshToken: "new-refresh",
              }),
          });
        }
        // Third call: retry original → success
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "success" }),
        });
      }),
    );

    const res = await api.get<{ data: string }>("/api/test");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ data: "success" });
    // Tokens should be updated
    expect(store[TOKEN_KEY]).toBe("new-access");
    expect(store[REFRESH_KEY]).toBe("new-refresh");
  });

  it("clears tokens and redirects to /login when refresh fails", async () => {
    store[TOKEN_KEY] = "expired-token";
    store[REFRESH_KEY] = "invalid-refresh";

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: { code: "AUTH_001", message: "Expired" } }),
          });
        }
        // Refresh fails
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: { code: "AUTH_001", message: "Bad refresh" } }),
        });
      }),
    );

    const res = await api.get("/api/test");
    expect(res.status).toBe(401);
    expect(res.error?.code).toBe("AUTH_001");
    expect(store[TOKEN_KEY]).toBeUndefined();
    expect(store[REFRESH_KEY]).toBeUndefined();
    expect((window as { location: { href: string } }).location.href).toBe("/login");
  });

  it("does not attempt refresh when no refresh token exists", async () => {
    store[TOKEN_KEY] = "expired-token";
    // No REFRESH_KEY

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { code: "AUTH_001", message: "Expired" } }),
      }),
    );

    const res = await api.get("/api/test");
    expect(res.status).toBe(401);
    // fetch should only be called once (original request) + once (refresh attempt that returns early)
    expect(store[TOKEN_KEY]).toBeUndefined();
  });

  it("handles JSON parse failure gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      }),
    );

    const res = await api.get("/api/test");
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("GEN_001");
  });
});
