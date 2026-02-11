import { describe, it, expect } from "vitest";
import { duelAcceptSchema, duelIdParamSchema } from "./duels";

describe("duelAcceptSchema", () => {
  it("accepts valid 32-char token", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "a".repeat(32) });
    expect(result.success).toBe(true);
  });

  it("accepts valid 64-char token", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "b".repeat(64) });
    expect(result.success).toBe(true);
  });

  it("rejects token shorter than 32 chars", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects token longer than 64 chars", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "c".repeat(65) });
    expect(result.success).toBe(false);
  });

  it("rejects missing inviteToken", () => {
    const result = duelAcceptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("duelIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = duelIdParamSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID string", () => {
    const result = duelIdParamSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = duelIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
