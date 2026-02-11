import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { apiError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { quizSubmitSchema } from "@/lib/validators/quiz";
import { computeQuizResults } from "@/lib/engines/quiz-engine";
import { RATE_LIMITS, QUIZ_RESULT_TTL_SECONDS } from "@vesna/shared";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Rate limit
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`quiz:submit:${ip}`, RATE_LIMITS.general);

    if (!rl.allowed) {
      const { body, status } = apiError("AUTH_003");
      const response = NextResponse.json(body, { status });
      for (const [k, v] of Object.entries(rateLimitHeaders(rl, RATE_LIMITS.general))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // 2. Parse & validate
    const raw = await req.json();
    const parsed = quizSubmitSchema.safeParse(raw);

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

    // 3. Compute results
    const quizId = randomUUID();
    const result = computeQuizResults(quizId, parsed.data);

    // 4. Store in Redis (24h TTL) for later linking to user profile
    await redis.set(
      `quiz:${quizId}`,
      JSON.stringify({ answers: parsed.data, result }),
      "EX",
      QUIZ_RESULT_TTL_SECONDS
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[quiz/submit]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
