import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { coachMessageSchema } from "@/lib/validators/coach";
import {
  containsMedicalRequest,
  buildSystemPrompt,
  getSuggestedQuestions,
} from "@/lib/engines/coach-engine";
import {
  RATE_LIMITS,
  MEDICAL_DISCLAIMER,
  LESSON_TITLES,
} from "@vesna/shared";
import type { CoachResponse } from "@vesna/shared";
import type { CoachContext } from "@/lib/engines/coach-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Auth — reject unauthenticated
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId, tier } = authResult.user;

    // 2. Premium gate — free users cannot access AI Coach
    if (tier === "free") {
      return NextResponse.json(
        { error: { code: "LESSON_001", message: "AI-коуч доступен в Premium" } },
        { status: 403 }
      );
    }

    // 3. Rate limit — per user, 20/hour
    const rateResult = await checkRateLimit(
      `coach:${userId}`,
      RATE_LIMITS.coach
    );
    if (!rateResult.allowed) {
      const { body, status } = apiError("COACH_002");
      return NextResponse.json(body, {
        status,
        headers: rateLimitHeaders(rateResult, RATE_LIMITS.coach),
      });
    }

    // 4. Validate body
    const rawBody = await req.json();
    const parsed = coachMessageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }
    const { message } = parsed.data;

    // 5. Medical guard — BEFORE Claude API call (CRITICAL)
    if (containsMedicalRequest(message)) {
      // Save both messages to DB (medical interception)
      await prisma.$transaction([
        prisma.coachMessage.create({
          data: { userId, role: "user", content: message },
        }),
        prisma.coachMessage.create({
          data: { userId, role: "assistant", content: MEDICAL_DISCLAIMER },
        }),
      ]);

      // Get last completed lesson for suggestions
      const lastLesson = await prisma.lessonProgress.findFirst({
        where: { userId, status: { in: ["completed", "review_needed"] } },
        orderBy: { lessonId: "desc" },
        select: { lessonId: true },
      });

      const response: CoachResponse = {
        response: MEDICAL_DISCLAIMER,
        suggestedQuestions: getSuggestedQuestions(lastLesson?.lessonId ?? 0),
      };

      return NextResponse.json(response, {
        status: 200,
        headers: rateLimitHeaders(rateResult, RATE_LIMITS.coach),
      });
    }

    // 6. Build context from DB
    const [user, completedLessons, recentMeals, streak, recentMessages] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
        prisma.lessonProgress.findMany({
          where: { userId, status: { in: ["completed", "review_needed"] } },
          orderBy: { lessonId: "desc" },
          take: 3,
          select: { lessonId: true },
        }),
        prisma.mealLog.findMany({
          where: {
            userId,
            loggedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
          },
          select: { dishName: true, calories: true, mealType: true },
          orderBy: { loggedAt: "desc" },
        }),
        prisma.streak.findUnique({
          where: { userId },
          select: { currentStreak: true },
        }),
        prisma.coachMessage.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { role: true, content: true },
        }),
      ]);

    const lastLessonId = completedLessons[0]?.lessonId ?? 0;

    // Build lesson concepts string
    const lessonConcepts = completedLessons
      .map((l) => LESSON_TITLES[l.lessonId])
      .filter(Boolean)
      .join(", ");

    // Build meals summary
    const mealsSummary = recentMeals.length > 0
      ? recentMeals
          .slice(0, 5)
          .map((m) => `${m.dishName} (${m.calories} ккал)`)
          .join(", ")
      : "Нет данных";

    const context: CoachContext = {
      userName: user?.name ?? "Пользователь",
      lastCompletedLessonId: lastLessonId,
      lessonConcepts,
      mealsSummary,
      streak: streak?.currentStreak ?? 0,
    };

    const systemPrompt = buildSystemPrompt(context);

    // Build conversation history (reversed to chronological order)
    const conversationHistory = recentMessages
      .reverse()
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // 7. Call Claude API
    const anthropic = new Anthropic();
    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: "user", content: message },
      ],
    });

    const assistantText =
      claudeResponse.content[0].type === "text"
        ? claudeResponse.content[0].text
        : "";

    // 8. Save both messages to DB
    await prisma.$transaction([
      prisma.coachMessage.create({
        data: { userId, role: "user", content: message },
      }),
      prisma.coachMessage.create({
        data: { userId, role: "assistant", content: assistantText },
      }),
    ]);

    // 9. Return response
    const response: CoachResponse = {
      response: assistantText,
      suggestedQuestions: getSuggestedQuestions(lastLessonId),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: rateLimitHeaders(rateResult, RATE_LIMITS.coach),
    });
  } catch (error) {
    console.error("[coach/message]", error);

    // Distinguish Claude API errors from general errors
    if (error instanceof Anthropic.APIError) {
      const { body, status } = apiError("COACH_001");
      return NextResponse.json(body, { status });
    }

    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
