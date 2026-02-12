import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDuelScore } from "@/lib/engines/duel-engine";
import { createMealSchema } from "@/lib/validators/meals";
import { calculateLevel } from "@/lib/engines/gamification-engine";
import { checkBadgeConditions } from "@/lib/engines/badge-engine";
import { checkDailyGoalEligibility } from "@/lib/engines/daily-goal-engine";
import { MEAL_XP, DAILY_GOAL_XP } from "@vesna/shared";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [meals, total] = await Promise.all([
      prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: sevenDaysAgo },
        },
        orderBy: { loggedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          mealType: true,
          dishName: true,
          photoUrl: true,
          calories: true,
          proteinG: true,
          fatG: true,
          carbsG: true,
          portionG: true,
          recognitionMethod: true,
          loggedAt: true,
        },
      }),
      prisma.mealLog.count({
        where: {
          userId,
          loggedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return NextResponse.json({
      meals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[meals] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const rawBody = await req.json();
    const parsed = createMealSchema.safeParse(rawBody);
    if (!parsed.success) {
      const { body, status } = apiError("QUIZ_001", { fields: parsed.error.flatten().fieldErrors });
      return NextResponse.json(body, { status });
    }

    // Create meal outside transaction (independent record)
    const meal = await prisma.mealLog.create({
      data: {
        userId,
        mealType: parsed.data.mealType,
        dishName: parsed.data.dishName,
        calories: parsed.data.calories,
        proteinG: parsed.data.proteinG,
        fatG: parsed.data.fatG,
        carbsG: parsed.data.carbsG,
        portionG: parsed.data.portionG,
        recognitionMethod: parsed.data.recognitionMethod,
      },
      select: {
        id: true,
        mealType: true,
        dishName: true,
        calories: true,
        proteinG: true,
        fatG: true,
        carbsG: true,
        portionG: true,
        recognitionMethod: true,
        loggedAt: true,
      },
    });

    // Gamification: all XP/level/badge updates in a single transaction
    let totalXpEarned = MEAL_XP;
    let leveledUp = false;
    let newLevel: { level: number; name: string } | null = null;
    let newBadges: string[] = [];

    await prisma.$transaction(async (tx) => {
      // 1. Award meal XP
      const gamification = await tx.gamification.upsert({
        where: { userId },
        update: { xpTotal: { increment: MEAL_XP } },
        create: { userId, xpTotal: MEAL_XP, level: 1, badges: [] },
        select: { xpTotal: true, level: true, badges: true },
      });

      let currentXp = gamification.xpTotal;

      // 2. Check daily goal
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setUTCHours(23, 59, 59, 999);

      const [hasLessonToday, mealsToday] = await Promise.all([
        tx.lessonProgress.count({
          where: {
            userId,
            status: { in: ["completed", "review_needed"] },
            completedAt: { gte: todayStart, lte: todayEnd },
          },
        }).then((c) => c > 0),
        tx.mealLog.count({
          where: { userId, loggedAt: { gte: todayStart, lte: todayEnd } },
        }),
      ]);

      const dailyGoal = checkDailyGoalEligibility(hasLessonToday, true, mealsToday > 1);
      if (dailyGoal.eligible) {
        await tx.gamification.update({
          where: { userId },
          data: { xpTotal: { increment: DAILY_GOAL_XP } },
        });
        currentXp += DAILY_GOAL_XP;
        totalXpEarned += DAILY_GOAL_XP;
      }

      // 3. Check level up (single check after all XP awarded)
      const levelInfo = calculateLevel(currentXp);
      if (levelInfo.level !== gamification.level) {
        await tx.gamification.update({
          where: { userId },
          data: { level: levelInfo.level },
        });
        leveledUp = true;
        newLevel = levelInfo;
      }

      // 4. Check badges (fresh read inside transaction to avoid race condition)
      const [streak, totalMeals, lessonsCompleted] = await Promise.all([
        tx.streak.findUnique({ where: { userId }, select: { longestStreak: true } }),
        tx.mealLog.count({ where: { userId } }),
        tx.lessonProgress.count({
          where: { userId, status: { in: ["completed", "review_needed"] } },
        }),
      ]);

      // Re-read badges inside transaction (avoids stale read from upsert)
      const freshGamification = await tx.gamification.findUnique({
        where: { userId },
        select: { badges: true },
      });
      const existingBadges = (freshGamification?.badges as string[]) ?? [];

      newBadges = checkBadgeConditions({
        existingBadges,
        longestStreak: streak?.longestStreak ?? 0,
        lessonsCompleted,
        totalMeals,
      });

      if (newBadges.length > 0) {
        await tx.gamification.update({
          where: { userId },
          data: { badges: [...existingBadges, ...newBadges] },
        });
      }
    });

    // Fire-and-forget duel score update (outside transaction)
    updateDuelScore(userId, "meal_logged").catch((err) =>
      console.error("[duels] meal score", err),
    );

    return NextResponse.json({
      meal,
      xpEarned: totalXpEarned,
      leveledUp,
      newLevel,
      newBadges,
    }, { status: 201 });
  } catch (error) {
    console.error("[meals] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
