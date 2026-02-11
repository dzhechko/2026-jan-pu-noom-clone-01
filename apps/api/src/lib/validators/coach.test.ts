import { describe, it, expect } from "vitest";
import { coachMessageSchema } from "./coach";

describe("coachMessageSchema", () => {
  it("accepts valid message", () => {
    const result = coachMessageSchema.safeParse({ message: "Привет!" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe("Привет!");
  });

  it("trims whitespace", () => {
    const result = coachMessageSchema.safeParse({ message: "  Привет!  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe("Привет!");
  });

  it("rejects empty string", () => {
    expect(coachMessageSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(coachMessageSchema.safeParse({ message: "   " }).success).toBe(false);
  });

  it("rejects missing message field", () => {
    expect(coachMessageSchema.safeParse({}).success).toBe(false);
  });

  it("rejects message exceeding 2000 characters", () => {
    const longMessage = "а".repeat(2001);
    expect(coachMessageSchema.safeParse({ message: longMessage }).success).toBe(false);
  });

  it("accepts message at exactly 2000 characters", () => {
    const maxMessage = "а".repeat(2000);
    const result = coachMessageSchema.safeParse({ message: maxMessage });
    expect(result.success).toBe(true);
  });

  it("rejects non-string message", () => {
    expect(coachMessageSchema.safeParse({ message: 123 }).success).toBe(false);
  });
});
