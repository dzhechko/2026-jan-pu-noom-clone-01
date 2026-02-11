import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { apiError } from "@/lib/errors";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lessonProgress: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    streak: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/engines/lesson-engine", () => ({
  checkLessonAccess: vi.fn(),
  gradeQuiz: vi.fn(),
}));

vi.mock("@/lib/engines/lesson-content", () => ({
  loadLessonContent: vi.fn(),
}));

vi.mock("@/lib/engines/gamification-engine", () => ({
  calculateLevel: vi.fn(),
}));

vi.mock("@/lib/engines/streak-engine", () => ({
  computeStreakUpdate: vi.fn(),
}));

vi.mock("@/lib/engines/duel-engine", () => ({
  updateDuelScore: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { POST } from "./route";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkLessonAccess, gradeQuiz } from "@/lib/engines/lesson-engine";
import { loadLessonContent } from "@/lib/engines/lesson-content";
import { calculateLevel } from "@/lib/engines/gamification-engine";
import { computeStreakUpdate } from "@/lib/engines/streak-engine";
import { updateDuelScore } from "@/lib/engines/duel-engine";
import type { GradeResult } from "@/lib/engines/lesson-engine";
import type { LessonContentFull } from "@vesna/shared";

// ── Helpers ─────────────────────────────────────────────────────────

const USER_ID = "user-abc-123";

function makeRequest(body: unknown, lessonId: number = 1): Request {
  return new Request(`http://localhost/api/lessons/${lessonId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: number | string = 1) {
  return { params: Promise.resolve({ id: String(id) }) };
}

function makeLessonContent(lessonId: number = 1): LessonContentFull {
  return {
    id: lessonId,
    title: `Lesson ${lessonId}`,
    description: "Test",
    sections: {
      theory: "Theory",
      example: "Example",
      quiz: {
        questions: [
          { id: 1, question: "Q1?", options: ["A", "B", "C", "D"], correctAnswer: 0 },
          { id: 2, question: "Q2?", options: ["A", "B", "C", "D"], correctAnswer: 1 },
          { id: 3, question: "Q3?", options: ["A", "B", "C", "D"], correctAnswer: 2 },
        ],
      },
      assignment: "Do this",
    },
  };
}

function perfectGrade(): GradeResult {
  return {
    score: 3,
    passed: true,
    xpEarned: 15,
    status: "completed",
    shouldSave: true,
    attemptsUsed: 1,
    attemptsRemaining: 2,
  };
}

// Transaction mock helper
let txMock: {
  lessonProgress: { upsert: Mock };
  gamification: { upsert: Mock; update: Mock };
  streak: { findUnique: Mock; upsert: Mock };
};

function setupTxMock() {
  txMock = {
    lessonProgress: { upsert: vi.fn() },
    gamification: {
      upsert: vi.fn().mockResolvedValue({ userId: USER_ID, xpTotal: 15, level: 1 }),
      update: vi.fn(),
    },
    streak: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
  };
  (prisma.$transaction as Mock).mockImplementation(async (cb: (tx: typeof txMock) => Promise<void>) => cb(txMock));
}

// ── Default Happy-Path Setup ────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Auth succeeds
  (requireAuth as Mock).mockReturnValue({
    user: { userId: USER_ID, tier: "premium" },
  });

  // No existing progress
  (prisma.lessonProgress.findMany as Mock).mockResolvedValue([]);

  // Access allowed
  (checkLessonAccess as Mock).mockReturnValue({ allowed: true });

  // Content loads
  (loadLessonContent as Mock).mockResolvedValue(makeLessonContent());

  // Perfect grade
  (gradeQuiz as Mock).mockReturnValue(perfectGrade());

  // Level 1 stays
  (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });

  // New day streak
  (computeStreakUpdate as Mock).mockReturnValue({
    current: 1,
    longest: 1,
    bonusXp: 0,
    isNewDay: true,
  });

  // Duel score no-op
  (updateDuelScore as Mock).mockResolvedValue(undefined);

  // Transaction
  setupTxMock();
});

// ── 1. Authentication ───────────────────────────────────────────────

describe("Authentication", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns 401 when token expired; prisma NOT called", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(prisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });
});

// ── 2. Input Validation ─────────────────────────────────────────────

describe("Input Validation", () => {
  it("returns 400 for non-numeric lesson ID → LESSON_003", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params("abc"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("LESSON_003");
  });

  it("returns 400 for lesson ID 0 → LESSON_003", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(0));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("LESSON_003");
  });

  it("returns 400 for lesson ID 15 → LESSON_003", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(15));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("LESSON_003");
  });

  it("returns 400 for missing quizAnswers → QUIZ_001", async () => {
    const res = await POST(makeRequest({}), params());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
  });

  it("returns 400 for wrong answer count (2 answers) → QUIZ_001", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1] }), params());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
  });

  it("returns 400 for wrong answer count (4 answers) → QUIZ_001", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2, 3] }), params());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
  });

  it("returns 400 for out-of-range answer (4) → QUIZ_001", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 4] }), params());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
  });

  it("returns 400 for non-integer answer (0.5) → QUIZ_001", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 0.5] }), params());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
  });
});

// ── 3. Access Control ───────────────────────────────────────────────

describe("Access Control", () => {
  it("returns 403 for free user on lesson 4+ → LESSON_001", async () => {
    (requireAuth as Mock).mockReturnValue({
      user: { userId: USER_ID, tier: "free" },
    });
    (checkLessonAccess as Mock).mockReturnValue({
      allowed: false,
      errorCode: "LESSON_001",
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(4));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("LESSON_001");
  });

  it("returns 400 for locked lesson → LESSON_003", async () => {
    (checkLessonAccess as Mock).mockReturnValue({
      allowed: false,
      errorCode: "LESSON_003",
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(5));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("LESSON_003");
  });

  it("premium user passes access check", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    expect(res.status).toBe(200);
    expect(checkLessonAccess).toHaveBeenCalledWith(1, "premium", []);
  });
});

// ── 4. Idempotent Re-completion ─────────────────────────────────────

describe("Idempotent Re-completion", () => {
  it("returns 200 with stored data and xpEarned: 0 for already completed lesson", async () => {
    (prisma.lessonProgress.findMany as Mock).mockResolvedValue([
      { lessonId: 1, status: "completed", quizAttempts: 1 },
    ]);
    (prisma.lessonProgress.findUnique as unknown as Mock).mockResolvedValue({
      quizScore: 3,
      quizAttempts: 1,
      xpEarned: 15,
      status: "completed",
    });
    (prisma.streak.findUnique as unknown as Mock).mockResolvedValue({
      currentStreak: 5,
      longestStreak: 10,
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.score).toBe(3);
    expect(json.result.passed).toBe(true);
    expect(json.result.xpEarned).toBe(0);
    expect(json.result.streak).toEqual({ current: 5, longest: 10, bonusXp: 0 });
    expect(gradeQuiz).not.toHaveBeenCalled();
    expect(loadLessonContent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 200 with passed: false for already review_needed lesson", async () => {
    (prisma.lessonProgress.findMany as Mock).mockResolvedValue([
      { lessonId: 1, status: "review_needed", quizAttempts: 3 },
    ]);
    (prisma.lessonProgress.findUnique as unknown as Mock).mockResolvedValue({
      quizScore: 1,
      quizAttempts: 3,
      xpEarned: 5,
      status: "review_needed",
    });
    (prisma.streak.findUnique as unknown as Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.passed).toBe(false);
    expect(json.result.status).toBe("review_needed");
    expect(json.result.streak).toBeNull();
  });

  it("returns nextLessonId: null for lesson 14 already completed", async () => {
    (prisma.lessonProgress.findMany as Mock).mockResolvedValue([
      { lessonId: 14, status: "completed", quizAttempts: 1 },
    ]);
    (prisma.lessonProgress.findUnique as unknown as Mock).mockResolvedValue({
      quizScore: 3,
      quizAttempts: 1,
      xpEarned: 15,
      status: "completed",
    });
    (prisma.streak.findUnique as unknown as Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(14));
    const json = await res.json();

    expect(json.result.nextLessonId).toBeNull();
  });

  it("does not call gradeQuiz, loadLessonContent, or computeStreakUpdate", async () => {
    (prisma.lessonProgress.findMany as Mock).mockResolvedValue([
      { lessonId: 1, status: "completed", quizAttempts: 1 },
    ]);
    (prisma.lessonProgress.findUnique as unknown as Mock).mockResolvedValue({
      quizScore: 3,
      quizAttempts: 1,
      xpEarned: 15,
      status: "completed",
    });
    (prisma.streak.findUnique as unknown as Mock).mockResolvedValue(null);

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(gradeQuiz).not.toHaveBeenCalled();
    expect(loadLessonContent).not.toHaveBeenCalled();
    expect(computeStreakUpdate).not.toHaveBeenCalled();
  });
});

// ── 5. First-time Completion ────────────────────────────────────────

describe("First-time Completion", () => {
  it("perfect 3/3 → 200, 15 XP, status completed, nextLessonId", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(3));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.score).toBe(3);
    expect(json.result.passed).toBe(true);
    expect(json.result.xpEarned).toBe(15);
    expect(json.result.status).toBe("completed");
    expect(json.result.nextLessonId).toBe(4);
  });

  it("passing 2/3 → 200, 10 XP", async () => {
    (gradeQuiz as Mock).mockReturnValue({
      ...perfectGrade(),
      score: 2,
      xpEarned: 10,
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 0] }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.score).toBe(2);
    expect(json.result.xpEarned).toBe(10);
  });

  it("transaction upserts lesson progress with correct fields", async () => {
    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(2));

    expect(txMock.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: USER_ID, lessonId: 2 } },
        create: expect.objectContaining({
          userId: USER_ID,
          lessonId: 2,
          status: "completed",
          quizScore: 3,
          quizAttempts: 1,
          xpEarned: 15,
        }),
        update: expect.objectContaining({
          status: "completed",
          quizScore: 3,
          quizAttempts: 1,
          xpEarned: 15,
        }),
      })
    );
  });

  it("transaction updates gamification level when it changes", async () => {
    txMock.gamification.upsert.mockResolvedValue({
      userId: USER_ID,
      xpTotal: 100,
      level: 1,
    });
    (calculateLevel as Mock).mockReturnValue({ level: 2, name: "Ученик" });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(txMock.gamification.update).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { level: 2 },
    });
  });

  it("transaction does NOT update level when unchanged", async () => {
    txMock.gamification.upsert.mockResolvedValue({
      userId: USER_ID,
      xpTotal: 15,
      level: 1,
    });
    (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(txMock.gamification.update).not.toHaveBeenCalled();
  });

  it("streak upsert when isNewDay true", async () => {
    (computeStreakUpdate as Mock).mockReturnValue({
      current: 2,
      longest: 5,
      bonusXp: 0,
      isNewDay: true,
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(txMock.streak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        create: expect.objectContaining({
          userId: USER_ID,
          currentStreak: 2,
          longestStreak: 5,
        }),
        update: expect.objectContaining({
          currentStreak: 2,
          longestStreak: 5,
        }),
      })
    );
    expect(json.result.streak).toEqual({ current: 2, longest: 5, bonusXp: 0 });
  });

  it("streak skip when isNewDay false", async () => {
    (computeStreakUpdate as Mock).mockReturnValue({
      current: 3,
      longest: 3,
      bonusXp: 0,
      isNewDay: false,
    });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(txMock.streak.upsert).not.toHaveBeenCalled();
  });

  it("streak bonus XP adds to gamification when > 0", async () => {
    (computeStreakUpdate as Mock).mockReturnValue({
      current: 7,
      longest: 7,
      bonusXp: 50,
      isNewDay: true,
    });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    // streak.upsert called
    expect(txMock.streak.upsert).toHaveBeenCalled();
    // bonus XP increment on gamification
    expect(txMock.gamification.update).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { xpTotal: { increment: 50 } },
    });
  });

  it("updateDuelScore fired for lesson_completed when passed", async () => {
    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(updateDuelScore).toHaveBeenCalledWith(USER_ID, "lesson_completed");
  });

  it("updateDuelScore fired for streak_maintained when streak > 0", async () => {
    (computeStreakUpdate as Mock).mockReturnValue({
      current: 3,
      longest: 3,
      bonusXp: 0,
      isNewDay: true,
    });

    await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());

    expect(updateDuelScore).toHaveBeenCalledWith(USER_ID, "streak_maintained");
  });

  it("updateDuelScore NOT fired for lesson_completed when not passed", async () => {
    (gradeQuiz as Mock).mockReturnValue({
      score: 1,
      passed: false,
      xpEarned: 5,
      status: "review_needed",
      shouldSave: true,
      attemptsUsed: 3,
      attemptsRemaining: 0,
    });

    await POST(makeRequest({ quizAnswers: [0, 0, 0] }), params());

    expect(updateDuelScore).not.toHaveBeenCalledWith(USER_ID, "lesson_completed");
  });

  it("nextLessonId null for lesson 14", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(14));
    const json = await res.json();

    expect(json.result.nextLessonId).toBeNull();
  });

  it("nextLessonId = id + 1 for non-final lessons", async () => {
    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params(7));
    const json = await res.json();

    expect(json.result.nextLessonId).toBe(8);
  });
});

// ── 6. Failed Quiz with Retries ─────────────────────────────────────

describe("Failed Quiz with Retries", () => {
  it("first fail → 200, xpEarned: 0, retries remaining, no transaction", async () => {
    (gradeQuiz as Mock).mockReturnValue({
      score: 1,
      passed: false,
      xpEarned: 0,
      status: "available",
      shouldSave: false,
      attemptsUsed: 1,
      attemptsRemaining: 2,
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 0, 0] }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.xpEarned).toBe(0);
    expect(json.result.attemptsRemaining).toBe(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("only quizAttempts upserted (no $transaction)", async () => {
    (gradeQuiz as Mock).mockReturnValue({
      score: 0,
      passed: false,
      xpEarned: 0,
      status: "available",
      shouldSave: false,
      attemptsUsed: 2,
      attemptsRemaining: 1,
    });

    await POST(makeRequest({ quizAnswers: [3, 3, 3] }), params());

    expect(prisma.lessonProgress.upsert as Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: USER_ID, lessonId: 1 } },
        create: expect.objectContaining({
          status: "available",
          quizAttempts: 2,
        }),
        update: expect.objectContaining({
          quizAttempts: 2,
        }),
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("third fail → review_needed via transaction, 5 XP", async () => {
    (prisma.lessonProgress.findMany as Mock).mockResolvedValue([
      { lessonId: 1, status: "available", quizAttempts: 2 },
    ]);
    (gradeQuiz as Mock).mockReturnValue({
      score: 1,
      passed: false,
      xpEarned: 5,
      status: "review_needed",
      shouldSave: true,
      attemptsUsed: 3,
      attemptsRemaining: 0,
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 0, 0] }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.xpEarned).toBe(5);
    expect(json.result.status).toBe("review_needed");
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

// ── 7. Content Loading Failure ──────────────────────────────────────

describe("Content Loading Failure", () => {
  it("loadLessonContent returns null → 500 GEN_001", async () => {
    (loadLessonContent as Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});

// ── 8. Unexpected Errors ────────────────────────────────────────────

describe("Unexpected Errors", () => {
  it("prisma.findMany throws → 500 GEN_001", async () => {
    (prisma.lessonProgress.findMany as Mock).mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });

  it("$transaction throws → 500 GEN_001", async () => {
    (prisma.$transaction as Mock).mockRejectedValue(new Error("TX failed"));

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });

  it("gradeQuiz throws → 500 GEN_001", async () => {
    (gradeQuiz as Mock).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const res = await POST(makeRequest({ quizAnswers: [0, 1, 2] }), params());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});
