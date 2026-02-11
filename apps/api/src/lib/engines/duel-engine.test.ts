import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  calculateDuelDates,
  calculateExpiresAt,
  getScorePoints,
  determineWinner,
  DuelError,
} from "./duel-engine";
import {
  DUEL_DURATION_DAYS,
  DUEL_INVITE_EXPIRY_HOURS,
  DUEL_SCORE_POINTS,
  DUEL_XP_REWARDS,
  DUEL_WINNER_BADGE,
  MAX_ACTIVE_DUELS,
  SUBSCRIPTION_TIERS,
} from "@vesna/shared";

// ---- DuelError ----

describe("DuelError", () => {
  it("stores the error code", () => {
    const err = new DuelError("DUEL_001");
    expect(err.code).toBe("DUEL_001");
  });

  it("sets a human-readable message from the error matrix", () => {
    const err = new DuelError("DUEL_001");
    expect(err.message).toBe("Дуэли доступны в Premium");
  });

  it("is an instance of Error", () => {
    const err = new DuelError("DUEL_002");
    expect(err).toBeInstanceOf(Error);
  });

  it("produces correct message for DUEL_002 (expired invite)", () => {
    const err = new DuelError("DUEL_002");
    expect(err.message).toBe("Ссылка истекла. Попросите друга отправить новую");
  });

  it("produces correct message for DUEL_003 (already active)", () => {
    const err = new DuelError("DUEL_003");
    expect(err.message).toBe("У вас уже есть активная дуэль");
  });
});

// ---- generateInviteToken ----

describe("generateInviteToken", () => {
  it("returns a 32-character hex string", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
  });

  it("generates unique tokens across multiple calls", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateInviteToken()));
    expect(tokens.size).toBe(20);
  });

  it("fits within Telegram startapp 64-char limit with duel_ prefix", () => {
    const token = generateInviteToken();
    const startParam = `duel_${token}`;
    expect(startParam.length).toBeLessThanOrEqual(64);
  });

  it("contains only lowercase hex characters", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token).not.toMatch(/[A-F]/); // no uppercase
  });
});

// ---- calculateDuelDates ----

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

  it("uses DUEL_DURATION_DAYS constant (7)", () => {
    expect(DUEL_DURATION_DAYS).toBe(7);
  });

  it("handles month boundary crossing", () => {
    const accept = new Date("2026-01-28T12:00:00.000Z");
    const { endDate } = calculateDuelDates(accept);
    expect(endDate.toISOString()).toBe("2026-02-04T12:00:00.000Z");
  });

  it("handles year boundary crossing", () => {
    const accept = new Date("2025-12-29T00:00:00.000Z");
    const { endDate } = calculateDuelDates(accept);
    expect(endDate.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("preserves time component from accept date", () => {
    const accept = new Date("2026-06-15T23:59:59.999Z");
    const { startDate, endDate } = calculateDuelDates(accept);
    expect(startDate.getHours()).toBe(23);
    expect(startDate.getMinutes()).toBe(59);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });
});

// ---- calculateExpiresAt ----

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

  it("uses DUEL_INVITE_EXPIRY_HOURS constant (72)", () => {
    expect(DUEL_INVITE_EXPIRY_HOURS).toBe(72);
  });

  it("returns a Date object", () => {
    const expiresAt = calculateExpiresAt();
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.toISOString()).toBeTruthy();
  });
});

// ---- getScorePoints (BDD: Duel scoring) ----

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

  it("matches the scoring table from spec", () => {
    // Spec says: Lesson=10, Meal=5, Streak=5/day
    expect(DUEL_SCORE_POINTS["lesson_completed"]).toBe(10);
    expect(DUEL_SCORE_POINTS["meal_logged"]).toBe(5);
    expect(DUEL_SCORE_POINTS["streak_maintained"]).toBe(5);
  });

  it("returns 0 for unknown action (defensive)", () => {
    expect(getScorePoints("unknown_action" as never)).toBe(0);
  });
});

// ---- determineWinner (BDD: winner / tie scenarios) ----

describe("determineWinner", () => {
  const CHALLENGER = "challenger-id";
  const OPPONENT = "opponent-id";

  it("returns challenger when challenger has higher score", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 20, 10)).toBe(CHALLENGER);
  });

  it("returns opponent when opponent has higher score", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 5, 15)).toBe(OPPONENT);
  });

  it("returns null on tie (BDD: both receive Ничья)", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 10, 10)).toBeNull();
  });

  it("returns null when both scores are 0 (no activity)", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 0, 0)).toBeNull();
  });

  it("handles large score differences", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 500, 10)).toBe(CHALLENGER);
  });

  it("handles minimal 1-point difference (challenger wins)", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 51, 50)).toBe(CHALLENGER);
  });

  it("handles minimal 1-point difference (opponent wins)", () => {
    expect(determineWinner(CHALLENGER, OPPONENT, 99, 100)).toBe(OPPONENT);
  });
});

// ---- Constants validation (from spec) ----

describe("duel constants", () => {
  it("DUEL_DURATION_DAYS is 7", () => {
    expect(DUEL_DURATION_DAYS).toBe(7);
  });

  it("DUEL_INVITE_EXPIRY_HOURS is 72", () => {
    expect(DUEL_INVITE_EXPIRY_HOURS).toBe(72);
  });

  it("MAX_ACTIVE_DUELS is 1", () => {
    expect(MAX_ACTIVE_DUELS).toBe(1);
  });

  it("winner gets 100 XP bonus", () => {
    expect(DUEL_XP_REWARDS.winner).toBe(100);
  });

  it("both players get 30 XP participation", () => {
    expect(DUEL_XP_REWARDS.participation).toBe(30);
  });

  it("winner badge is 'Чемпион Дуэли'", () => {
    expect(DUEL_WINNER_BADGE).toBe("Чемпион Дуэли");
  });

  it("free tier does not have duels access", () => {
    expect(SUBSCRIPTION_TIERS.free.hasDuels).toBe(false);
  });

  it("premium tier has duels access", () => {
    expect(SUBSCRIPTION_TIERS.premium.hasDuels).toBe(true);
  });

  it("clinical tier has duels access", () => {
    expect(SUBSCRIPTION_TIERS.clinical.hasDuels).toBe(true);
  });
});

// ---- Scoring simulation (BDD: Full duel lifecycle scoring) ----

describe("scoring simulation", () => {
  it("7-day perfect play: 7 lessons + 7*3 meals + 7 streaks = 210 points", () => {
    const lessonPoints = 7 * getScorePoints("lesson_completed");
    const mealPoints = 21 * getScorePoints("meal_logged"); // 3 meals/day * 7 days
    const streakPoints = 7 * getScorePoints("streak_maintained");

    expect(lessonPoints).toBe(70);
    expect(mealPoints).toBe(105);
    expect(streakPoints).toBe(35);
    expect(lessonPoints + mealPoints + streakPoints).toBe(210);
  });

  it("winner gets 130 total XP (100 bonus + 30 participation)", () => {
    expect(DUEL_XP_REWARDS.winner + DUEL_XP_REWARDS.participation).toBe(130);
  });

  it("loser/tie player gets 30 XP (participation only)", () => {
    expect(DUEL_XP_REWARDS.participation).toBe(30);
  });

  it("after a tie, determineWinner returns null — no badge awarded", () => {
    const winner = determineWinner("a", "b", 50, 50);
    expect(winner).toBeNull();
  });
});
