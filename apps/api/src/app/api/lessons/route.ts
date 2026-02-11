import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLessonList } from "@/lib/engines/lesson-engine";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId, tier } = authResult.user;

    const progress = await prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true, status: true, quizScore: true, xpEarned: true },
    });

    const lessons = computeLessonList(progress, tier);

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error("[lessons/list]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
