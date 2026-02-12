import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/engines/gamification-engine";
import { TOTAL_LESSONS, GAMIFICATION_LEVELS } from "@vesna/shared";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const [gamification, streak, lessonsCompleted] = await Promise.all([
      prisma.gamification.findUnique({
        where: { userId },
        select: {
          xpTotal: true,
          level: true,
          badges: true,
        },
      }),
      prisma.streak.findUnique({
        where: { userId },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
      prisma.lessonProgress.count({
        where: {
          userId,
          status: { in: ["completed", "review_needed"] },
        },
      }),
    ]);

    const xp = gamification?.xpTotal ?? 0;
    const level = gamification?.level ?? 1;
    const badges = gamification?.badges ?? [];
    const { name: levelName } = calculateLevel(xp);

    // Calculate nextLevelXp: find the next level's xpRequired, or null if max level
    let nextLevelXp: number | null = null;
    const nextLevelEntry = GAMIFICATION_LEVELS.find((l) => l.level === level + 1);
    if (nextLevelEntry) {
      nextLevelXp = nextLevelEntry.xpRequired;
    }

    return NextResponse.json({
      xp,
      level,
      levelName,
      nextLevelXp,
      badges,
      streak: {
        current: streak?.currentStreak ?? 0,
        longest: streak?.longestStreak ?? 0,
      },
      lessonsCompleted,
      totalLessons: TOTAL_LESSONS,
    });
  } catch (error) {
    console.error("[gamification]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
