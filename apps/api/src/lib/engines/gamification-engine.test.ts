import { describe, it, expect } from "vitest";
import { calculateLevel } from "./gamification-engine";

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
