import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/engines/gamification-engine";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(100, Math.max(1, limitParam || 50));

    // Fetch top users by XP
    const topUsers = await prisma.gamification.findMany({
      orderBy: { xpTotal: "desc" },
      take: limit,
      select: {
        userId: true,
        xpTotal: true,
        level: true,
        user: {
          select: { name: true },
        },
      },
    });

    // Anonymize display names
    const leaderboard = topUsers.map((entry, idx) => {
      const name = entry.user?.name ?? "";
      const displayName = name.length >= 2 ? name.slice(0, 2) + "***" : "***";
      const levelInfo = calculateLevel(entry.xpTotal);
      return {
        rank: idx + 1,
        displayName,
        xp: entry.xpTotal,
        level: levelInfo.level,
        levelName: levelInfo.name,
      };
    });

    // Get current user's rank
    const userGamification = await prisma.gamification.findUnique({
      where: { userId },
      select: { xpTotal: true },
    });
    const userXp = userGamification?.xpTotal ?? 0;
    const usersAbove = await prisma.gamification.count({
      where: { xpTotal: { gt: userXp } },
    });
    const userRank = usersAbove + 1;

    return NextResponse.json({
      leaderboard,
      userRank,
      userXp,
    });
  } catch (error) {
    console.error("[gamification/leaderboard] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
