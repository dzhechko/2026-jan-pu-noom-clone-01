import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { apiError } from "@/lib/errors";

// ── Mocks (before imports) ──────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gamification: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    streak: { findUnique: vi.fn() },
    lessonProgress: { count: vi.fn() },
  },
}));

vi.mock("@/lib/engines/gamification-engine", () => ({
  calculateLevel: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { GET as getGamification } from "./route";
import { GET as getLeaderboard } from "./leaderboard/route";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/engines/gamification-engine";

// ── Helpers ─────────────────────────────────────────────────────────

const USER_ID = "user-gam-123";

function makeRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

// ── Default Setup ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Auth succeeds by default
  (requireAuth as Mock).mockReturnValue({
    user: { userId: USER_ID, tier: "premium" },
  });

  // Default gamification record
  (prisma.gamification.findUnique as Mock).mockResolvedValue({
    xpTotal: 150,
    level: 2,
    badges: ["streak_7"],
  });

  // Default streak
  (prisma.streak.findUnique as Mock).mockResolvedValue({
    currentStreak: 5,
    longestStreak: 10,
  });

  // Default lessons completed
  (prisma.lessonProgress.count as Mock).mockResolvedValue(3);

  // Default calculateLevel
  (calculateLevel as Mock).mockReturnValue({ level: 2, name: "Ученик" });

  // Leaderboard-specific defaults
  (prisma.gamification.findMany as Mock).mockResolvedValue([]);
  (prisma.gamification.count as Mock).mockResolvedValue(0);
});

// ── 1. GET /api/gamification ────────────────────────────────────────

describe("GET /api/gamification", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
    expect(prisma.gamification.findUnique).not.toHaveBeenCalled();
  });

  it("returns 200 with correct flat response shape", async () => {
    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      xp: 150,
      level: 2,
      levelName: "Ученик",
      nextLevelXp: 400, // level 3 xpRequired from GAMIFICATION_LEVELS
      badges: ["streak_7"],
      streak: { current: 5, longest: 10 },
      lessonsCompleted: 3,
      totalLessons: 14,
    });
  });

  it("returns defaults for new user (no records)", async () => {
    (prisma.gamification.findUnique as Mock).mockResolvedValue(null);
    (prisma.streak.findUnique as Mock).mockResolvedValue(null);
    (prisma.lessonProgress.count as Mock).mockResolvedValue(0);
    (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });

    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.xp).toBe(0);
    expect(json.level).toBe(1);
    expect(json.levelName).toBe("Новичок");
    expect(json.nextLevelXp).toBe(100); // level 2 xpRequired
    expect(json.badges).toEqual([]);
    expect(json.streak).toEqual({ current: 0, longest: 0 });
    expect(json.lessonsCompleted).toBe(0);
  });

  it("returns nextLevelXp=null for max level (5)", async () => {
    (prisma.gamification.findUnique as Mock).mockResolvedValue({
      xpTotal: 2000,
      level: 5,
      badges: [],
    });
    (calculateLevel as Mock).mockReturnValue({ level: 5, name: "Сенсей" });

    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.level).toBe(5);
    expect(json.nextLevelXp).toBe(null);
  });

  it("counts lessonsCompleted from completed and review_needed", async () => {
    await getGamification(makeRequest("/api/gamification"));

    expect(prisma.lessonProgress.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: { in: ["completed", "review_needed"] },
      },
    });
  });

  it("calls calculateLevel with xpTotal", async () => {
    await getGamification(makeRequest("/api/gamification"));

    expect(calculateLevel).toHaveBeenCalledWith(150);
  });

  it("runs all three queries in parallel", async () => {
    await getGamification(makeRequest("/api/gamification"));

    // All three should be called exactly once
    expect(prisma.gamification.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.streak.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.lessonProgress.count).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on prisma error", async () => {
    (prisma.gamification.findUnique as Mock).mockRejectedValue(
      new Error("Connection lost"),
    );

    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });

  it("returns 500 when streak query fails", async () => {
    (prisma.streak.findUnique as Mock).mockRejectedValue(
      new Error("DB error"),
    );

    const res = await getGamification(makeRequest("/api/gamification"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});

// ── 2. GET /api/gamification/leaderboard ────────────────────────────

describe("GET /api/gamification/leaderboard", () => {
  beforeEach(() => {
    // Default: user has 150 XP, 2 users above
    (prisma.gamification.findUnique as Mock).mockResolvedValue({
      xpTotal: 150,
    });
    (prisma.gamification.count as Mock).mockResolvedValue(2);
  });

  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns 200 with leaderboard and user rank", async () => {
    (prisma.gamification.findMany as Mock).mockResolvedValue([
      { userId: "u1", xpTotal: 500, level: 3, user: { name: "Алексей" } },
      { userId: "u2", xpTotal: 300, level: 2, user: { name: "Мария" } },
    ]);
    (calculateLevel as Mock)
      .mockReturnValueOnce({ level: 3, name: "Практик" })
      .mockReturnValueOnce({ level: 2, name: "Ученик" });

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.leaderboard).toHaveLength(2);
    expect(json.leaderboard[0]).toEqual({
      rank: 1,
      displayName: "Ал***",
      xp: 500,
      level: 3,
      levelName: "Практик",
    });
    expect(json.leaderboard[1]).toEqual({
      rank: 2,
      displayName: "Ма***",
      xp: 300,
      level: 2,
      levelName: "Ученик",
    });
    expect(json.userRank).toBe(3); // 2 users above + 1
    expect(json.userXp).toBe(150);
  });

  it("anonymizes short names to '***'", async () => {
    (prisma.gamification.findMany as Mock).mockResolvedValue([
      { userId: "u1", xpTotal: 100, level: 1, user: { name: "А" } },
    ]);
    (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(json.leaderboard[0].displayName).toBe("***");
  });

  it("anonymizes null names to '***'", async () => {
    (prisma.gamification.findMany as Mock).mockResolvedValue([
      { userId: "u1", xpTotal: 100, level: 1, user: { name: null } },
    ]);
    (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(json.leaderboard[0].displayName).toBe("***");
  });

  it("defaults to limit=50", async () => {
    await getLeaderboard(makeRequest("/api/gamification/leaderboard"));

    expect(prisma.gamification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("respects custom limit param", async () => {
    await getLeaderboard(
      makeRequest("/api/gamification/leaderboard?limit=10"),
    );

    expect(prisma.gamification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("clamps limit to max 100", async () => {
    await getLeaderboard(
      makeRequest("/api/gamification/leaderboard?limit=500"),
    );

    expect(prisma.gamification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("clamps limit to min 1", async () => {
    await getLeaderboard(
      makeRequest("/api/gamification/leaderboard?limit=-5"),
    );

    expect(prisma.gamification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it("returns empty leaderboard with userRank=1 when no users", async () => {
    (prisma.gamification.findMany as Mock).mockResolvedValue([]);
    (prisma.gamification.findUnique as Mock).mockResolvedValue(null);
    (prisma.gamification.count as Mock).mockResolvedValue(0);

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(json.leaderboard).toEqual([]);
    expect(json.userRank).toBe(1);
    expect(json.userXp).toBe(0);
  });

  it("returns 500 on prisma error", async () => {
    (prisma.gamification.findMany as Mock).mockRejectedValue(
      new Error("DB down"),
    );

    const res = await getLeaderboard(
      makeRequest("/api/gamification/leaderboard"),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });

  it("falls back to limit=50 when limit param is NaN", async () => {
    await getLeaderboard(
      makeRequest("/api/gamification/leaderboard?limit=abc"),
    );

    expect(prisma.gamification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
