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

    // 1. Award meal XP
    let totalXpEarned = MEAL_XP;
    let leveledUp = false;
    let newLevel: { level: number; name: string } | null = null;

    const gamification = await prisma.gamification.upsert({
      where: { userId },
      update: { xpTotal: { increment: MEAL_XP } },
      create: { userId, xpTotal: MEAL_XP, level: 1, badges: [] },
      select: { xpTotal: true, level: true, badges: true },
    });

    // 2. Check level up
    const levelInfo = calculateLevel(gamification.xpTotal);
    if (levelInfo.level !== gamification.level) {
      await prisma.gamification.update({
        where: { userId },
        data: { level: levelInfo.level },
      });
      leveledUp = true;
      newLevel = levelInfo;
    }

    // 3. Check daily goal (need to check if user also completed a lesson today)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const hasLessonToday = await prisma.lessonProgress.count({
      where: {
        userId,
        status: { in: ["completed", "review_needed"] },
        completedAt: { gte: todayStart, lte: todayEnd },
      },
    }) > 0;

    // For daily goal, we just logged a meal so hasMealToday is true
    // Check if bonus was already awarded today (simple: check if any other meal logged today)
    const mealsToday = await prisma.mealLog.count({
      where: { userId, loggedAt: { gte: todayStart, lte: todayEnd } },
    });
    // If this is the first meal today AND there's a lesson today, award bonus
    // (mealsToday includes the just-created meal, so check for exactly 1)
    const alreadyHadMealToday = mealsToday > 1;

    const dailyGoal = checkDailyGoalEligibility(hasLessonToday, true, alreadyHadMealToday);
    if (dailyGoal.eligible) {
      await prisma.gamification.update({
        where: { userId },
        data: { xpTotal: { increment: DAILY_GOAL_XP } },
      });
      totalXpEarned += DAILY_GOAL_XP;
      // Re-check level after daily goal XP
      const updatedGamification = await prisma.gamification.findUnique({
        where: { userId },
        select: { xpTotal: true, level: true },
      });
      if (updatedGamification) {
        const newLevelInfo = calculateLevel(updatedGamification.xpTotal);
        if (newLevelInfo.level !== updatedGamification.level) {
          await prisma.gamification.update({
            where: { userId },
            data: { level: newLevelInfo.level },
          });
          leveledUp = true;
          newLevel = newLevelInfo;
        }
      }
    }

    // 4. Check badges
    const streak = await prisma.streak.findUnique({
      where: { userId },
      select: { longestStreak: true },
    });
    const totalMeals = await prisma.mealLog.count({ where: { userId } });
    const lessonsCompleted = await prisma.lessonProgress.count({
      where: { userId, status: { in: ["completed", "review_needed"] } },
    });
    const existingBadges = (gamification.badges as string[]) ?? [];
    const newBadges = checkBadgeConditions({
      existingBadges,
      longestStreak: streak?.longestStreak ?? 0,
      lessonsCompleted,
      totalMeals,
    });
    if (newBadges.length > 0) {
      await prisma.gamification.update({
        where: { userId },
        data: { badges: [...existingBadges, ...newBadges] },
      });
    }

    // Fire-and-forget duel score update
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
