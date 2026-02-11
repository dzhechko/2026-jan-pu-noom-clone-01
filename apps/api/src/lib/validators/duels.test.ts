import { describe, it, expect } from "vitest";
import { duelAcceptSchema, duelIdParamSchema } from "./duels";

// ---- duelAcceptSchema (invite token validation) ----

describe("duelAcceptSchema", () => {
  it("accepts valid 32-char hex token (generateInviteToken output)", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" });
    expect(result.success).toBe(true);
  });

  it("accepts valid 64-char token (max length)", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "b".repeat(64) });
    expect(result.success).toBe(true);
  });

  it("accepts token with mixed alphanumeric chars", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "abc123def456ghi789jkl012mno345pq" });
    expect(result.success).toBe(true);
  });

  it("rejects token shorter than 32 chars", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects token of 31 chars (off-by-one)", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("rejects token longer than 64 chars", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "c".repeat(65) });
    expect(result.success).toBe(false);
  });

  it("rejects missing inviteToken field", () => {
    const result = duelAcceptSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: "" });
    expect(result.success).toBe(false);
  });

  it("rejects null inviteToken", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: null });
    expect(result.success).toBe(false);
  });

  it("rejects numeric inviteToken", () => {
    const result = duelAcceptSchema.safeParse({ inviteToken: 12345 });
    expect(result.success).toBe(false);
  });

  it("ignores extra fields", () => {
    const result = duelAcceptSchema.safeParse({
      inviteToken: "a".repeat(32),
      extra: "should-be-ignored",
    });
    expect(result.success).toBe(true);
  });
});

// ---- duelIdParamSchema (UUID validation) ----

describe("duelIdParamSchema", () => {
  it("accepts valid UUID v4", () => {
    const result = duelIdParamSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(true);
  });

  it("accepts another valid UUID", () => {
    const result = duelIdParamSchema.safeParse({ id: "123e4567-e89b-12d3-a456-426614174000" });
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

  it("rejects empty string", () => {
    const result = duelIdParamSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects numeric id", () => {
    const result = duelIdParamSchema.safeParse({ id: 12345 });
    expect(result.success).toBe(false);
  });

  it("rejects UUID without hyphens", () => {
    const result = duelIdParamSchema.safeParse({ id: "550e8400e29b41d4a716446655440000" });
    expect(result.success).toBe(false);
  });

  it("rejects partial UUID", () => {
    const result = duelIdParamSchema.safeParse({ id: "550e8400-e29b-41d4" });
    expect(result.success).toBe(false);
  });
});
