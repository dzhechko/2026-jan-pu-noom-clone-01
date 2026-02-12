import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { apiError } from "@/lib/errors";

// ── Mocks (before imports) ──────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mealLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gamification: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lessonProgress: { count: vi.fn() },
    streak: { findUnique: vi.fn() },
    medicalProfile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/engines/duel-engine", () => ({
  updateDuelScore: vi.fn(),
}));

vi.mock("@/lib/engines/gamification-engine", () => ({
  calculateLevel: vi.fn(),
}));

vi.mock("@/lib/engines/badge-engine", () => ({
  checkBadgeConditions: vi.fn(),
}));

vi.mock("@/lib/engines/daily-goal-engine", () => ({
  checkDailyGoalEligibility: vi.fn(),
}));

vi.mock("@/lib/engines/meal-summary-engine", () => ({
  computeDailySummary: vi.fn(),
}));

vi.mock("@/lib/engines/food-database", () => ({
  searchFood: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { GET as getMeals, POST as postMeals } from "./route";
import { PATCH, DELETE } from "./[id]/route";
import { GET as getDaily } from "./daily/route";
import { GET as getSearch } from "./search/route";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDuelScore } from "@/lib/engines/duel-engine";
import { calculateLevel } from "@/lib/engines/gamification-engine";
import { checkBadgeConditions } from "@/lib/engines/badge-engine";
import { checkDailyGoalEligibility } from "@/lib/engines/daily-goal-engine";
import { computeDailySummary } from "@/lib/engines/meal-summary-engine";
import { searchFood } from "@/lib/engines/food-database";

// ── Helpers ─────────────────────────────────────────────────────────

const USER_ID = "user-meals-123";
const MEAL_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function makeGetRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request(`http://localhost/api/meals/${MEAL_UUID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): Request {
  return new Request(`http://localhost/api/meals/${MEAL_UUID}`, {
    method: "DELETE",
  });
}

function params(id: string = MEAL_UUID) {
  return { params: Promise.resolve({ id }) };
}

function makeMealRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: MEAL_UUID,
    mealType: "lunch",
    dishName: "Гречка с курицей",
    photoUrl: null,
    calories: 350,
    proteinG: 30,
    fatG: 10,
    carbsG: 45,
    portionG: 250,
    recognitionMethod: "manual_entry",
    loggedAt: new Date("2026-02-11T12:00:00.000Z"),
    ...overrides,
  };
}

function validMealInput() {
  return {
    mealType: "lunch",
    dishName: "Гречка с курицей",
    calories: 350,
    proteinG: 30,
    fatG: 10,
    carbsG: 45,
    portionG: 250,
  };
}

// ── Default Happy-Path Setup ────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Auth succeeds
  (requireAuth as Mock).mockReturnValue({
    user: { userId: USER_ID, tier: "premium" },
  });

  // Default empty lists
  (prisma.mealLog.findMany as Mock).mockResolvedValue([]);
  (prisma.mealLog.count as Mock).mockResolvedValue(0);

  // Default create returns a meal
  (prisma.mealLog.create as Mock).mockResolvedValue(makeMealRecord());

  // Default findUnique returns null (meal not found)
  (prisma.mealLog.findUnique as Mock).mockResolvedValue(null);

  // Gamification defaults for POST /api/meals
  (prisma.gamification.upsert as Mock).mockResolvedValue({
    xpTotal: 3, level: 1, badges: [],
  });
  (prisma.gamification.findUnique as Mock).mockResolvedValue(null);
  (prisma.gamification.update as Mock).mockResolvedValue({});
  (prisma.lessonProgress.count as Mock).mockResolvedValue(0);
  (prisma.streak.findUnique as Mock).mockResolvedValue(null);
  (calculateLevel as Mock).mockReturnValue({ level: 1, name: "Новичок" });
  (checkBadgeConditions as Mock).mockReturnValue([]);
  (checkDailyGoalEligibility as Mock).mockReturnValue({ eligible: false, bonusXp: 0 });

  // Duel score no-op
  (updateDuelScore as Mock).mockResolvedValue(undefined);

  // Daily summary engine
  (computeDailySummary as Mock).mockReturnValue({
    totalCalories: 0,
    totalProteinG: 0,
    totalFatG: 0,
    totalCarbsG: 0,
    targetCalories: 2000,
    status: "green",
  });

  // Food search
  (searchFood as Mock).mockResolvedValue([]);
});

// ── 1. GET /api/meals ───────────────────────────────────────────────

describe("GET /api/meals", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await getMeals(makeGetRequest("/api/meals"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns meals with pagination (default page=1, limit=20)", async () => {
    const meals = [makeMealRecord()];
    (prisma.mealLog.findMany as Mock).mockResolvedValue(meals);
    (prisma.mealLog.count as Mock).mockResolvedValue(1);

    const res = await getMeals(makeGetRequest("/api/meals"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meals).toHaveLength(1);
    expect(json.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("respects page and limit query params", async () => {
    (prisma.mealLog.findMany as Mock).mockResolvedValue([]);
    (prisma.mealLog.count as Mock).mockResolvedValue(50);

    const res = await getMeals(makeGetRequest("/api/meals?page=3&limit=5"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.pagination.page).toBe(3);
    expect(json.pagination.limit).toBe(5);
    expect(json.pagination.totalPages).toBe(10);

    // Verify skip/take passed to prisma
    expect(prisma.mealLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (3-1) * 5
        take: 5,
      }),
    );
  });

  it("clamps page to min 1, limit to 1-100", async () => {
    (prisma.mealLog.findMany as Mock).mockResolvedValue([]);
    (prisma.mealLog.count as Mock).mockResolvedValue(0);

    const res = await getMeals(makeGetRequest("/api/meals?page=-5&limit=999"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(100);
  });

  it("returns empty array when no meals", async () => {
    (prisma.mealLog.findMany as Mock).mockResolvedValue([]);
    (prisma.mealLog.count as Mock).mockResolvedValue(0);

    const res = await getMeals(makeGetRequest("/api/meals"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meals).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });

  it("returns 500 on prisma error", async () => {
    (prisma.mealLog.findMany as Mock).mockRejectedValue(new Error("DB down"));

    const res = await getMeals(makeGetRequest("/api/meals"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});

// ── 2. POST /api/meals ──────────────────────────────────────────────

describe("POST /api/meals", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await postMeals(makePostRequest(validMealInput()));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns 400 on missing required fields (dishName, mealType, calories)", async () => {
    const res = await postMeals(makePostRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields).toBeDefined();
  });

  it("returns 400 on invalid mealType value", async () => {
    const res = await postMeals(
      makePostRequest({ ...validMealInput(), mealType: "brunch" }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.mealType).toBeDefined();
  });

  it("returns 400 on negative calories", async () => {
    const res = await postMeals(
      makePostRequest({ ...validMealInput(), calories: -10 }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.calories).toBeDefined();
  });

  it("returns 201 on valid input with meal and gamification data", async () => {
    const createdMeal = makeMealRecord();
    (prisma.mealLog.create as Mock).mockResolvedValue(createdMeal);

    const res = await postMeals(makePostRequest(validMealInput()));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.meal).toBeDefined();
    expect(json.meal.id).toBe(MEAL_UUID);
    expect(json.meal.dishName).toBe("Гречка с курицей");
    expect(json.xpEarned).toBe(3);
    expect(json.leveledUp).toBe(false);
    expect(json.newBadges).toEqual([]);
  });

  it("sets recognitionMethod to 'manual_entry'", async () => {
    await postMeals(makePostRequest(validMealInput()));

    expect(prisma.mealLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recognitionMethod: "manual_entry",
        }),
      }),
    );
  });

  it("fires updateDuelScore('meal_logged') on success", async () => {
    await postMeals(makePostRequest(validMealInput()));

    // Wait for fire-and-forget to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(updateDuelScore).toHaveBeenCalledWith(USER_ID, "meal_logged");
  });

  it("returns 500 on prisma.create error", async () => {
    (prisma.mealLog.create as Mock).mockRejectedValue(
      new Error("Insert failed"),
    );

    const res = await postMeals(makePostRequest(validMealInput()));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});

// ── 3. PATCH /api/meals/[id] ────────────────────────────────────────

describe("PATCH /api/meals/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await PATCH(makePatchRequest({ calories: 400 }), params());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns 400 on invalid id param (non-uuid)", async () => {
    const res = await PATCH(makePatchRequest({ calories: 400 }), params("abc"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.id).toBeDefined();
  });

  it("returns 404 when meal not found", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ calories: 400 }), params());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("GEN_001");
    expect(json.error.message).toBe("Запись не найдена");
  });

  it("returns 404 when meal belongs to different user", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue({
      userId: "other-user-456",
    });

    const res = await PATCH(makePatchRequest({ calories: 400 }), params());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("GEN_001");
    expect(json.error.message).toBe("Запись не найдена");
  });

  it("returns 200 on partial update (e.g., just calories)", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue({
      userId: USER_ID,
    });
    const updated = makeMealRecord({ calories: 400 });
    (prisma.mealLog.update as Mock).mockResolvedValue(updated);

    const res = await PATCH(makePatchRequest({ calories: 400 }), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meal).toBeDefined();
    expect(json.meal.calories).toBe(400);
  });

  it("returns 200 on empty body (updateMealSchema allows all optional)", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue({
      userId: USER_ID,
    });
    const unchanged = makeMealRecord();
    (prisma.mealLog.update as Mock).mockResolvedValue(unchanged);

    const res = await PATCH(makePatchRequest({}), params());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meal).toBeDefined();
  });
});

// ── 4. DELETE /api/meals/[id] ───────────────────────────────────────

describe("DELETE /api/meals/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await DELETE(makeDeleteRequest(), params());

    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid id param (non-uuid)", async () => {
    const res = await DELETE(makeDeleteRequest(), params("abc"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.id).toBeDefined();
  });

  it("returns 404 when meal not found", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), params());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("GEN_001");
    expect(json.error.message).toBe("Запись не найдена");
  });

  it("returns 404 when meal belongs to different user", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue({
      userId: "other-user-789",
    });

    const res = await DELETE(makeDeleteRequest(), params());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("GEN_001");
  });

  it("returns 204 on successful delete", async () => {
    (prisma.mealLog.findUnique as Mock).mockResolvedValue({
      userId: USER_ID,
    });
    (prisma.mealLog.delete as Mock).mockResolvedValue({});

    const res = await DELETE(makeDeleteRequest(), params());

    expect(res.status).toBe(204);
  });
});

// ── 5. GET /api/meals/daily ─────────────────────────────────────────

describe("GET /api/meals/daily", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await getDaily(makeGetRequest("/api/meals/daily"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("defaults to today when no date param", async () => {
    const res = await getDaily(makeGetRequest("/api/meals/daily"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.date).toBe(new Date().toISOString().slice(0, 10));
    expect(json.summary).toBeDefined();
  });

  it("returns 200 with specific date param", async () => {
    const meals = [
      {
        id: MEAL_UUID,
        mealType: "lunch",
        dishName: "Салат",
        calories: 200,
        proteinG: 10,
        fatG: 5,
        carbsG: 20,
        portionG: 150,
        loggedAt: new Date("2026-01-15T12:00:00.000Z"),
      },
    ];
    (prisma.mealLog.findMany as Mock).mockResolvedValue(meals);
    (computeDailySummary as Mock).mockReturnValue({
      totalCalories: 200,
      totalProteinG: 10,
      totalFatG: 5,
      totalCarbsG: 20,
      targetCalories: 2000,
      status: "green",
    });

    const res = await getDaily(
      makeGetRequest("/api/meals/daily?date=2026-01-15"),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.date).toBe("2026-01-15");
    expect(json.meals).toHaveLength(1);
    expect(json.summary.totalCalories).toBe(200);
  });

  it("returns 400 on invalid date format", async () => {
    const res = await getDaily(
      makeGetRequest("/api/meals/daily?date=15-01-2026"),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.date).toBeDefined();
  });

  it("returns 500 on prisma error", async () => {
    (prisma.mealLog.findMany as Mock).mockRejectedValue(
      new Error("DB timeout"),
    );

    const res = await getDaily(
      makeGetRequest("/api/meals/daily?date=2026-02-11"),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});

// ── 6. GET /api/meals/search ────────────────────────────────────────

describe("GET /api/meals/search", () => {
  it("returns 401 when unauthenticated", async () => {
    (requireAuth as Mock).mockReturnValue({
      error: apiError("AUTH_001"),
    });

    const res = await getSearch(
      makeGetRequest("/api/meals/search?q=chicken"),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_001");
  });

  it("returns 200 with search results", async () => {
    const results = [
      {
        name: "Куриная грудка",
        caloriesPer100g: 165,
        proteinPer100g: 31,
        fatPer100g: 3.6,
        carbsPer100g: 0,
      },
    ];
    (searchFood as Mock).mockResolvedValue(results);

    const res = await getSearch(
      makeGetRequest("/api/meals/search?q=курица"),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].name).toBe("Куриная грудка");
  });

  it("returns 400 when q param is empty", async () => {
    const res = await getSearch(makeGetRequest("/api/meals/search?q="));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("QUIZ_001");
    expect(json.error.details.fields.q).toBeDefined();
  });

  it("respects limit param", async () => {
    (searchFood as Mock).mockResolvedValue([]);

    await getSearch(makeGetRequest("/api/meals/search?q=test&limit=5"));

    expect(searchFood).toHaveBeenCalledWith("test", 5);
  });

  it("returns 500 on searchFood error", async () => {
    (searchFood as Mock).mockRejectedValue(new Error("File not found"));

    const res = await getSearch(
      makeGetRequest("/api/meals/search?q=something"),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("GEN_001");
  });
});
