# Insights

## Route-Level Testing Pattern for Next.js App Router

**Date:** 2026-02-11
**Tags:** #testing #nextjs #vitest #prisma

### Context
First route-level test file created for `POST /api/lessons/[id]/complete`. Project had 46 unit tests for engines/validators but zero route tests.

### Approach
Call the exported `POST(req, { params })` function directly with constructed `Request` objects. Mock all external deps via `vi.mock()`, keep pure helpers (like `apiError`) real for assertion confidence.

### Key Patterns

**Request helper:**
```typescript
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/lessons/1/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

**Params (Next.js App Router expects Promise):**
```typescript
function params(id: number | string = 1) {
  return { params: Promise.resolve({ id: String(id) }) };
}
```

**Prisma transaction mock:**
```typescript
const txMock = {
  lessonProgress: { upsert: vi.fn() },
  gamification: { upsert: vi.fn().mockResolvedValue({...}), update: vi.fn() },
  streak: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
};
(prisma.$transaction as Mock).mockImplementation(async (cb) => cb(txMock));
```

**beforeEach happy-path defaults:** Set up all mocks for the success case so each test only overrides what it needs.

### Gotchas

1. **Prisma mock must include all methods used by the route** — forgetting `findUnique` on `lessonProgress` caused `Cannot read properties of undefined`. The mock object shape must exactly match what the route calls on `prisma.*`.

2. **Double-cast needed for nested mock properties** — `prisma.lessonProgress.findMany as Mock` works if declared as `vi.fn()` in the factory, but methods added later or accessed through different paths may need `as unknown as Mock`.

3. **Don't mock pure error helpers** — keeping `apiError()` real means tests validate actual HTTP status codes and error codes from the error table. Catches drift between route and error definitions.

4. **Fire-and-forget calls (`.catch()`)** — `updateDuelScore` is called with `.catch()` in the route (fire-and-forget). The mock resolves synchronously so assertions still work, but be aware that in the real route these are not awaited.

### Prevention
- When creating route tests, start by listing every `prisma.*` method the route calls and ensure the mock factory includes all of them.
- Use the `setupTxMock()` pattern for any route that uses `prisma.$transaction(async (tx) => ...)`.
