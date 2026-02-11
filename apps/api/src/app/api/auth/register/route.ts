import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/errors";
import { hashPassword, signTokens } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators/auth";
import { RATE_LIMITS } from "@vesna/shared";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Parse & validate
    const raw = await req.json();
    const parsed = registerSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте данные",
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // 2. Rate limit
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`auth:register:${ip}`, RATE_LIMITS.auth);

    if (!rl.allowed) {
      const { body, status } = apiError("AUTH_003");
      const response = NextResponse.json(body, { status });
      for (const [k, v] of Object.entries(rateLimitHeaders(rl, RATE_LIMITS.auth))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // 3. Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      const { body, status } = apiError("AUTH_004");
      return NextResponse.json(body, { status });
    }

    // 4. Hash password & create user
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    // 5. Generate tokens
    const tokens = signTokens({ sub: user.id, tier: user.subscriptionTier });

    return NextResponse.json(
      {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[auth/register]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
