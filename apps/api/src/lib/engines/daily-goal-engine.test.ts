import { describe, it, expect } from "vitest";
import { checkDailyGoalEligibility } from "./daily-goal-engine";

describe("checkDailyGoalEligibility", () => {
  it("DG-01: eligible when both lesson + meal today", () => {
    const result = checkDailyGoalEligibility(true, true, false);
    expect(result.eligible).toBe(true);
    expect(result.bonusXp).toBe(15);
  });

  it("DG-02: not eligible when only lesson today", () => {
    const result = checkDailyGoalEligibility(true, false, false);
    expect(result.eligible).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it("DG-03: not eligible when only meal today", () => {
    const result = checkDailyGoalEligibility(false, true, false);
    expect(result.eligible).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it("DG-04: not eligible when neither", () => {
    const result = checkDailyGoalEligibility(false, false, false);
    expect(result.eligible).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it("DG-05: not eligible when already awarded today", () => {
    const result = checkDailyGoalEligibility(true, true, true);
    expect(result.eligible).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it("DG-06: eligible when alreadyAwarded=false and both conditions met", () => {
    const result = checkDailyGoalEligibility(true, true, false);
    expect(result.eligible).toBe(true);
    expect(result.bonusXp).toBe(15);
  });
});
