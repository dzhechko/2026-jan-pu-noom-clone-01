import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const [gamification, streak] = await Promise.all([
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
          lastActiveDate: true,
        },
      }),
    ]);

    return NextResponse.json({
      gamification: gamification ?? { xpTotal: 0, level: 1, badges: [] },
      streak: streak ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
    });
  } catch (error) {
    console.error("[gamification]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
