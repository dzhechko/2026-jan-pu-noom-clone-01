import { describe, it, expect } from "vitest";
import { checkBadgeConditions, getBadgeDefinition } from "./badge-engine";

describe("checkBadgeConditions", () => {
  it("BE-01: returns empty when no conditions met", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 3,
      lessonsCompleted: 5,
      totalMeals: 10,
    });
    expect(result).toEqual([]);
  });

  it("BE-02: awards streak_7 when longestStreak=7", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 7,
      lessonsCompleted: 0,
      totalMeals: 0,
    });
    expect(result).toContain("streak_7");
    expect(result).toHaveLength(1);
  });

  it("BE-03: awards multiple streak badges at once", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 30,
      lessonsCompleted: 0,
      totalMeals: 0,
    });
    expect(result).toContain("streak_7");
    expect(result).toContain("streak_14");
    expect(result).toContain("streak_30");
    expect(result).not.toContain("streak_60");
    expect(result).toHaveLength(3);
  });

  it("BE-04: awards lessons_all when lessonsCompleted=14", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 0,
      lessonsCompleted: 14,
      totalMeals: 0,
    });
    expect(result).toContain("lessons_all");
    expect(result).toHaveLength(1);
  });

  it("BE-05: awards meals_100 when totalMeals=100", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 0,
      lessonsCompleted: 0,
      totalMeals: 100,
    });
    expect(result).toContain("meals_100");
    expect(result).toHaveLength(1);
  });

  it("BE-06: skips already-earned badges", () => {
    const result = checkBadgeConditions({
      existingBadges: ["streak_7"],
      longestStreak: 14,
      lessonsCompleted: 0,
      totalMeals: 0,
    });
    expect(result).not.toContain("streak_7");
    expect(result).toContain("streak_14");
    expect(result).toHaveLength(1);
  });

  it("BE-07: awards all badges for maxed-out user", () => {
    const result = checkBadgeConditions({
      existingBadges: [],
      longestStreak: 60,
      lessonsCompleted: 14,
      totalMeals: 100,
    });
    expect(result).toContain("streak_7");
    expect(result).toContain("streak_14");
    expect(result).toContain("streak_30");
    expect(result).toContain("streak_60");
    expect(result).toContain("lessons_all");
    expect(result).toContain("meals_100");
    expect(result).toHaveLength(6);
  });

  it("BE-08: preserves duel_champion", () => {
    const result = checkBadgeConditions({
      existingBadges: ["duel_champion"],
      longestStreak: 0,
      lessonsCompleted: 0,
      totalMeals: 0,
    });
    expect(result).toEqual([]);
  });
});

describe("getBadgeDefinition", () => {
  it("returns badge definition by ID", () => {
    const badge = getBadgeDefinition("streak_7");
    expect(badge).toEqual({
      id: "streak_7",
      name: "7 дней подряд",
      icon: "fire",
      description: "Серия 7 дней",
    });
  });

  it("returns null for unknown badge ID", () => {
    const badge = getBadgeDefinition("unknown");
    expect(badge).toBeNull();
  });
});
