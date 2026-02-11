import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateBMI } from "@/lib/engines/quiz-engine";
import { LESSON_TITLES } from "@vesna/shared";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const medicalProfile = await prisma.medicalProfile.findUnique({
      where: { userId },
      select: {
        bmi: true,
        metabolicAge: true,
        birthDate: true,
        weightKg: true,
        heightCm: true,
      },
    });

    if (!medicalProfile) {
      return NextResponse.json(
        { error: { code: "DASH_001", message: "Пройдите скрининг" } },
        { status: 404 },
      );
    }

    const [nextLessonProgress, streak, gamification] = await Promise.all([
      prisma.lessonProgress.findFirst({
        where: { userId, status: "available" },
        orderBy: { lessonId: "asc" },
        select: { lessonId: true },
      }),
      prisma.streak.findUnique({
        where: { userId },
        select: { currentStreak: true, longestStreak: true },
      }),
      prisma.gamification.findUnique({
        where: { userId },
        select: { xpTotal: true, level: true },
      }),
    ]);

    const bmi = Number(medicalProfile.bmi);
    const { category: bmiCategory } = calculateBMI(
      Number(medicalProfile.weightKg),
      medicalProfile.heightCm,
    );

    const now = new Date();
    const passportAge =
      now.getFullYear() -
      medicalProfile.birthDate.getFullYear() -
      (now < new Date(now.getFullYear(), medicalProfile.birthDate.getMonth(), medicalProfile.birthDate.getDate()) ? 1 : 0);

    const nextLessonId = nextLessonProgress?.lessonId ?? 1;

    return NextResponse.json({
      metabolicAge: medicalProfile.metabolicAge,
      passportAge,
      bmi,
      bmiCategory,
      nextLesson: {
        id: nextLessonId,
        title: LESSON_TITLES[nextLessonId] ?? `Урок ${nextLessonId}`,
      },
      streak: {
        current: streak?.currentStreak ?? 0,
        longest: streak?.longestStreak ?? 0,
      },
      xp: gamification?.xpTotal ?? 0,
      level: gamification?.level ?? 1,
    });
  } catch (error) {
    console.error("[dashboard]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
