import { describe, it, expect } from "vitest";
import { calculateLevel, calculateLevelExtended, wouldLevelUp } from "./gamification-engine";

describe("calculateLevel", () => {
  it("returns level 1 (Новичок) for 0 XP", () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe("Новичок");
  });

  it("returns level 1 for 99 XP", () => {
    expect(calculateLevel(99).level).toBe(1);
  });

  it("returns level 2 (Ученик) at 100 XP", () => {
    const result = calculateLevel(100);
    expect(result.level).toBe(2);
    expect(result.name).toBe("Ученик");
  });

  it("returns level 3 (Практик) at 400 XP", () => {
    const result = calculateLevel(400);
    expect(result.level).toBe(3);
    expect(result.name).toBe("Практик");
  });

  it("returns level 4 (Мастер) at 900 XP", () => {
    const result = calculateLevel(900);
    expect(result.level).toBe(4);
    expect(result.name).toBe("Мастер");
  });

  it("returns level 5 (Сенсей) at 1500 XP", () => {
    const result = calculateLevel(1500);
    expect(result.level).toBe(5);
    expect(result.name).toBe("Сенсей");
  });

  it("stays level 5 for XP above 1500", () => {
    expect(calculateLevel(9999).level).toBe(5);
  });

  it("returns level 2 for 399 XP (between level 2 and 3)", () => {
    expect(calculateLevel(399).level).toBe(2);
  });
});

describe("calculateLevelExtended", () => {
  it("returns nextLevelXp=100 at 0 XP", () => {
    const result = calculateLevelExtended(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe("Новичок");
    expect(result.nextLevelXp).toBe(100);
  });

  it("returns nextLevelXp=null at 1500+ XP (max level)", () => {
    const result = calculateLevelExtended(1500);
    expect(result.level).toBe(5);
    expect(result.name).toBe("Сенсей");
    expect(result.nextLevelXp).toBeNull();
  });

  it("returns correct nextLevelXp at level 2", () => {
    const result = calculateLevelExtended(100);
    expect(result.level).toBe(2);
    expect(result.nextLevelXp).toBe(400);
  });

  it("returns correct nextLevelXp at level 3", () => {
    const result = calculateLevelExtended(400);
    expect(result.level).toBe(3);
    expect(result.nextLevelXp).toBe(900);
  });

  it("returns correct nextLevelXp at level 4", () => {
    const result = calculateLevelExtended(900);
    expect(result.level).toBe(4);
    expect(result.nextLevelXp).toBe(1500);
  });
});

describe("wouldLevelUp", () => {
  it("returns true crossing 100 XP threshold", () => {
    const result = wouldLevelUp(90, 15);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toEqual({ level: 2, name: "Ученик" });
  });

  it("returns false staying within same level", () => {
    const result = wouldLevelUp(50, 10);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBeNull();
  });

  it("returns correct newLevel info when leveling up", () => {
    const result = wouldLevelUp(380, 30);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toEqual({ level: 3, name: "Практик" });
  });

  it("returns false when reaching exact threshold without crossing", () => {
    const result = wouldLevelUp(100, 0);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBeNull();
  });

  it("returns true when crossing multiple levels at once", () => {
    const result = wouldLevelUp(0, 400);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toEqual({ level: 3, name: "Практик" });
  });
});
