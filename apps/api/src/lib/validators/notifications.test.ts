import { describe, it, expect } from "vitest";
import { prefsUpdateSchema } from "./notifications";

// VT-N01: accepts valid partial update
describe("prefsUpdateSchema", () => {
  it("accepts valid partial update", () => {
    const result = prefsUpdateSchema.safeParse({
      lessonReminder: false,
      streakRisk: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lessonReminder).toBe(false);
      expect(result.data.streakRisk).toBe(true);
    }
  });

  // VT-N02: accepts timezone string
  it("accepts valid timezone string", () => {
    const result = prefsUpdateSchema.safeParse({
      timezone: "Europe/Moscow",
    });
    expect(result.success).toBe(true);
  });

  it("accepts Asia/Tokyo timezone", () => {
    const result = prefsUpdateSchema.safeParse({
      timezone: "Asia/Tokyo",
    });
    expect(result.success).toBe(true);
  });

  // VT-N03: rejects invalid timezone
  it("rejects invalid timezone", () => {
    const result = prefsUpdateSchema.safeParse({
      timezone: "Invalid/Timezone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects number as timezone", () => {
    const result = prefsUpdateSchema.safeParse({
      timezone: 123,
    });
    expect(result.success).toBe(false);
  });

  // VT-N04: rejects non-boolean pref values
  it("rejects non-boolean pref values", () => {
    const result = prefsUpdateSchema.safeParse({
      lessonReminder: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects number as pref value", () => {
    const result = prefsUpdateSchema.safeParse({
      streakRisk: 1,
    });
    expect(result.success).toBe(false);
  });

  // VT-N05: accepts empty object (no-op)
  it("accepts empty object as no-op", () => {
    const result = prefsUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = prefsUpdateSchema.safeParse({
      unknownField: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all prefs + timezone together", () => {
    const result = prefsUpdateSchema.safeParse({
      lessonReminder: true,
      streakRisk: false,
      churnPrevention: true,
      duelEvents: false,
      weeklyReport: true,
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });
});
