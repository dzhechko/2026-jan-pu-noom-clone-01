import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkLessonAccess, stripQuizAnswers } from "@/lib/engines/lesson-engine";
import { loadLessonContent } from "@/lib/engines/lesson-content";
import { lessonIdParamSchema } from "@/lib/validators/lessons";

export async function GET(
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
    const parsed = lessonIdParamSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "LESSON_003", message: "Урок не найден" } },
        { status: 400 }
      );
    }
    const lessonId = parsed.data.id;

    // Check access (sequential unlock + tier)
    const progress = await prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true, status: true },
    });

    const access = checkLessonAccess(lessonId, tier, progress);
    if (!access.allowed) {
      const { body, status } = apiError(access.errorCode);
      return NextResponse.json(body, { status });
    }

    // Load content
    const content = await loadLessonContent(lessonId);
    if (!content) {
      const { body, status } = apiError("GEN_001");
      return NextResponse.json(body, { status });
    }

    // Strip correct answers before sending to client
    const safeContent = stripQuizAnswers(content);

    return NextResponse.json({ lesson: safeContent });
  } catch (error) {
    console.error("[lessons/get]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
