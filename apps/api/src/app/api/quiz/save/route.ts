import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { quizSaveSchema } from "@/lib/validators/quiz";
import type { QuizAnswers, QuizResult } from "@vesna/shared";

interface StoredQuiz {
  answers: QuizAnswers;
  result: QuizResult;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Auth required
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    // 2. Parse & validate
    const raw = await req.json();
    const parsed = quizSaveSchema.safeParse(raw);

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

    // 3. Fetch quiz results from Redis
    const stored = await redis.get(`quiz:${parsed.data.quizId}`);
    if (!stored) {
      const { body, status } = apiError("QUIZ_002");
      return NextResponse.json(body, { status });
    }

    const { answers, result } = JSON.parse(stored) as StoredQuiz;

    // 4. Calculate birth date from age (approximate)
    const now = new Date();
    const birthDate = new Date(now.getFullYear() - answers.age, now.getMonth(), 1);

    // 5. Upsert MedicalProfile
    const profileData = {
      gender: answers.gender,
      birthDate,
      heightCm: Math.round(answers.heightCm),
      weightKg: answers.weightKg,
      bmi: result.bmi,
      metabolicAge: result.metabolicAge,
      activityLevel: answers.activityLevel,
      risks: result.risks as unknown as Prisma.InputJsonValue,
      quizAnswers: answers as unknown as Prisma.InputJsonValue,
    };

    const profile = await prisma.medicalProfile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    });

    // 6. Clean up Redis
    await redis.del(`quiz:${parsed.data.quizId}`);

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("[quiz/save]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
