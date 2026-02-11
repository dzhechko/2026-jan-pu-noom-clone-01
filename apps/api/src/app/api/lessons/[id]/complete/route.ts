import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkLessonAccess, gradeQuiz } from "@/lib/engines/lesson-engine";
import { loadLessonContent } from "@/lib/engines/lesson-content";
import { calculateLevel } from "@/lib/engines/gamification-engine";
import { computeStreakUpdate } from "@/lib/engines/streak-engine";
import { updateDuelScore } from "@/lib/engines/duel-engine";
import { lessonIdParamSchema, lessonCompleteSchema } from "@/lib/validators/lessons";
import type { LessonCompletionResult } from "@vesna/shared";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId, tier } = authResult.user;

    // Validate lesson ID
    const paramsParsed = lessonIdParamSchema.safeParse(await params);
    if (!paramsParsed.success) {
      return NextResponse.json(
        { error: { code: "LESSON_003", message: "Урок не найден" } },
        { status: 400 }
      );
    }
    const lessonId = paramsParsed.data.id;

    // Validate body
    const body = await req.json();
    const bodyParsed = lessonCompleteSchema.safeParse(body);
    if (!bodyParsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: bodyParsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }
    const { quizAnswers } = bodyParsed.data;

    // Fetch progress for all lessons (for access check)
    const allProgress = await prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true, status: true, quizAttempts: true },
    });

    // Check access
    const access = checkLessonAccess(lessonId, tier, allProgress);
    if (!access.allowed) {
      const { body: errBody, status } = apiError(access.errorCode);
      return NextResponse.json(errBody, { status });
    }

    // Check if already completed — return existing result (idempotent)
    const existingProgress = allProgress.find((p) => p.lessonId === lessonId);
    const alreadyCompleted =
      existingProgress?.status === "completed" || existingProgress?.status === "review_needed";
    if (alreadyCompleted) {
      const fullProgress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { quizScore: true, quizAttempts: true, xpEarned: true, status: true },
      });
      const streak = await prisma.streak.findUnique({
        where: { userId },
        select: { currentStreak: true, longestStreak: true },
      });
      const result: LessonCompletionResult = {
        score: fullProgress?.quizScore ?? 0,
        passed: fullProgress?.status === "completed",
        xpEarned: 0,
        status: (fullProgress?.status ?? "completed") as LessonCompletionResult["status"],
        attemptsUsed: fullProgress?.quizAttempts ?? 0,
        attemptsRemaining: 0,
        streak: streak ? { current: streak.currentStreak, longest: streak.longestStreak, bonusXp: 0 } : null,
        nextLessonId: lessonId < 14 ? lessonId + 1 : null,
      };
      return NextResponse.json({ result }, { status: 200 });
    }

    // Load correct answers
    const content = await loadLessonContent(lessonId);
    if (!content) {
      const { body: errBody, status } = apiError("GEN_001");
      return NextResponse.json(errBody, { status });
    }
    const correctAnswers = content.sections.quiz.questions.map((q) => q.correctAnswer);

    // Grade quiz
    const currentAttempts = existingProgress?.quizAttempts ?? 0;
    const grade = gradeQuiz(quizAnswers, correctAnswers, currentAttempts, false);

    let streakResult: LessonCompletionResult["streak"] = null;

    if (grade.shouldSave) {
      // Lesson completed or review_needed — persist everything in a transaction
      await prisma.$transaction(async (tx) => {
        // 1. Upsert lesson progress
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId } },
          create: {
            userId,
            lessonId,
            status: grade.status,
            quizScore: grade.score,
            quizAttempts: grade.attemptsUsed,
            completedAt: new Date(),
            xpEarned: grade.xpEarned,
          },
          update: {
            status: grade.status,
            quizScore: grade.score,
            quizAttempts: grade.attemptsUsed,
            completedAt: new Date(),
            xpEarned: grade.xpEarned,
          },
        });

        // 2. Update gamification (XP + level)
        const gamification = await tx.gamification.upsert({
          where: { userId },
          create: { userId, xpTotal: grade.xpEarned, level: 1 },
          update: { xpTotal: { increment: grade.xpEarned } },
        });

        const newLevel = calculateLevel(gamification.xpTotal);
        if (newLevel.level !== gamification.level) {
          await tx.gamification.update({
            where: { userId },
            data: { level: newLevel.level },
          });
        }

        // 3. Update streak
        const existingStreak = await tx.streak.findUnique({ where: { userId } });
        const today = new Date();
        const streakUpdate = computeStreakUpdate(existingStreak, today);
        streakResult = {
          current: streakUpdate.current,
          longest: streakUpdate.longest,
          bonusXp: streakUpdate.bonusXp,
        };

        if (streakUpdate.isNewDay) {
          await tx.streak.upsert({
            where: { userId },
            create: {
              userId,
              currentStreak: streakUpdate.current,
              longestStreak: streakUpdate.longest,
              lastActiveDate: today,
            },
            update: {
              currentStreak: streakUpdate.current,
              longestStreak: streakUpdate.longest,
              lastActiveDate: today,
            },
          });

          // Add streak bonus XP if milestone reached
          if (streakUpdate.bonusXp > 0) {
            await tx.gamification.update({
              where: { userId },
              data: { xpTotal: { increment: streakUpdate.bonusXp } },
            });
          }
        }
      });

      // Fire-and-forget duel score updates
      if (grade.passed) {
        updateDuelScore(userId, "lesson_completed").catch((err) =>
          console.error("[duels] lesson score", err),
        );
      }
      const streak = streakResult as LessonCompletionResult["streak"];
      if (streak && streak.current > 0) {
        updateDuelScore(userId, "streak_maintained").catch((err) =>
          console.error("[duels] streak score", err),
        );
      }
    } else {
      // Failed quiz with retries remaining — only save attempt count
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: {
          userId,
          lessonId,
          status: "available",
          quizAttempts: grade.attemptsUsed,
        },
        update: {
          quizAttempts: grade.attemptsUsed,
        },
      });
    }

    const nextLessonId = grade.shouldSave && lessonId < 14 ? lessonId + 1 : null;

    const result: LessonCompletionResult = {
      score: grade.score,
      passed: grade.passed,
      xpEarned: grade.xpEarned,
      status: grade.status,
      attemptsUsed: grade.attemptsUsed,
      attemptsRemaining: grade.attemptsRemaining,
      streak: streakResult,
      nextLessonId,
    };

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    console.error("[lessons/complete]", error);
    const { body: errBody, status } = apiError("GEN_001");
    return NextResponse.json(errBody, { status });
  }
}
