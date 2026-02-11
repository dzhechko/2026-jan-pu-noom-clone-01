import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  calculateDuelDates,
  calculateExpiresAt,
  getScorePoints,
  determineWinner,
} from "./duel-engine";

describe("generateInviteToken", () => {
  it("returns a 32-character hex string", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
  });
});

describe("calculateDuelDates", () => {
  it("sets endDate to 7 days after acceptDate", () => {
    const accept = new Date("2026-02-01T10:00:00.000Z");
    const { startDate, endDate } = calculateDuelDates(accept);

    expect(startDate.toISOString()).toBe("2026-02-01T10:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-02-08T10:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const accept = new Date("2026-03-15T08:00:00.000Z");
    const original = accept.toISOString();
    calculateDuelDates(accept);
    expect(accept.toISOString()).toBe(original);
  });
});

describe("calculateExpiresAt", () => {
  it("returns a date ~72 hours in the future", () => {
    const before = Date.now();
    const expiresAt = calculateExpiresAt();
    const after = Date.now();

    const expectedMin = before + 72 * 60 * 60 * 1000;
    const expectedMax = after + 72 * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});

describe("getScorePoints", () => {
  it("returns 10 for lesson_completed", () => {
    expect(getScorePoints("lesson_completed")).toBe(10);
  });

  it("returns 5 for meal_logged", () => {
    expect(getScorePoints("meal_logged")).toBe(5);
  });

  it("returns 5 for streak_maintained", () => {
    expect(getScorePoints("streak_maintained")).toBe(5);
  });
});

describe("determineWinner", () => {
  const A = "user-a";
  const B = "user-b";

  it("returns challenger when challenger has higher score", () => {
    expect(determineWinner(A, B, 20, 10)).toBe(A);
  });

  it("returns opponent when opponent has higher score", () => {
    expect(determineWinner(A, B, 5, 15)).toBe(B);
  });

  it("returns null on tie", () => {
    expect(determineWinner(A, B, 10, 10)).toBeNull();
  });

  it("returns null when both scores are 0", () => {
    expect(determineWinner(A, B, 0, 0)).toBeNull();
  });
});
