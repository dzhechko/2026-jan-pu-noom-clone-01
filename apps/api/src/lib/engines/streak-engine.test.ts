import { describe, it, expect } from "vitest";
import { computeStreakUpdate } from "./streak-engine";

function date(str: string): Date {
  return new Date(str + "T12:00:00.000Z");
}

describe("computeStreakUpdate", () => {
  it("first activity creates streak of 1", () => {
    const result = computeStreakUpdate(null, date("2026-01-15"));
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.bonusXp).toBe(0);
    expect(result.isNewDay).toBe(true);
  });

  it("same day activity does not change streak", () => {
    const existing = {
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: date("2026-01-15"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(3);
    expect(result.longest).toBe(5);
    expect(result.bonusXp).toBe(0);
    expect(result.isNewDay).toBe(false);
  });

  it("consecutive day increments streak", () => {
    const existing = {
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(4);
    expect(result.longest).toBe(5);
    expect(result.bonusXp).toBe(0);
    expect(result.isNewDay).toBe(true);
  });

  it("updates longest when current exceeds it", () => {
    const existing = {
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(6);
    expect(result.longest).toBe(6);
  });

  it("gap of 2+ days breaks streak", () => {
    const existing = {
      currentStreak: 10,
      longestStreak: 10,
      lastActiveDate: date("2026-01-13"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(1);
    expect(result.longest).toBe(10); // longest preserved
    expect(result.isNewDay).toBe(true);
  });

  it("7-day milestone gives 50 bonus XP", () => {
    const existing = {
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(7);
    expect(result.bonusXp).toBe(50);
  });

  it("14-day milestone gives 100 bonus XP", () => {
    const existing = {
      currentStreak: 13,
      longestStreak: 13,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(14);
    expect(result.bonusXp).toBe(100);
  });

  it("30-day milestone gives 200 bonus XP", () => {
    const existing = {
      currentStreak: 29,
      longestStreak: 29,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(30);
    expect(result.bonusXp).toBe(200);
  });

  it("non-milestone day gives no bonus", () => {
    const existing = {
      currentStreak: 8,
      longestStreak: 8,
      lastActiveDate: date("2026-01-14"),
    };
    const result = computeStreakUpdate(existing, date("2026-01-15"));
    expect(result.current).toBe(9);
    expect(result.bonusXp).toBe(0);
  });
});
