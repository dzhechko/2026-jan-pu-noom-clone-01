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

    const [nextLessonProgress, streak, gamification, medicalProfile] =
      await Promise.all([
        prisma.lessonProgress.findFirst({
          where: { userId, status: "available" },
          orderBy: { lessonId: "asc" },
          select: { lessonId: true, status: true },
        }),
        prisma.streak.findUnique({
          where: { userId },
          select: {
            currentStreak: true,
            longestStreak: true,
            lastActiveDate: true,
          },
        }),
        prisma.gamification.findUnique({
          where: { userId },
          select: {
            xpTotal: true,
            level: true,
            badges: true,
          },
        }),
        prisma.medicalProfile.findUnique({
          where: { userId },
          select: {
            bmi: true,
            metabolicAge: true,
          },
        }),
      ]);

    const nextLesson = nextLessonProgress
      ? { lessonId: nextLessonProgress.lessonId, status: nextLessonProgress.status }
      : { lessonId: 1, status: "available" };

    return NextResponse.json({
      nextLesson,
      streak: streak ?? null,
      gamification: gamification ?? null,
      medicalProfile: medicalProfile ?? null,
    });
  } catch (error) {
    console.error("[dashboard]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
