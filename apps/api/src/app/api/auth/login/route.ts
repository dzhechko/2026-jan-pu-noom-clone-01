import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiError } from "@/lib/errors";
import { comparePassword, dummyCompare, signTokens } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators/auth";
import { RATE_LIMITS } from "@vesna/shared";

const LOCKOUT_TTL = 900; // 15 minutes in seconds
const MAX_FAILURES = 5;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Parse & validate
    const raw = await req.json();
    const parsed = loginSchema.safeParse(raw);

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

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // 2. Rate limit
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`auth:login:${ip}`, RATE_LIMITS.auth);

    if (!rl.allowed) {
      const { body, status } = apiError("AUTH_003");
      const response = NextResponse.json(body, { status });
      for (const [k, v] of Object.entries(rateLimitHeaders(rl, RATE_LIMITS.auth))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // 3. Check lockout
    const lockoutKey = `lockout:${normalizedEmail}`;
    const isLocked = await redis.get(lockoutKey);

    if (isLocked) {
      const { body, status } = apiError("AUTH_002");
      return NextResponse.json(body, { status });
    }

    // 4. Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      // Timing attack protection: perform dummy compare
      await dummyCompare(password);
      await incrementFailures(normalizedEmail);
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 5. Compare password (passwordHash is null for Telegram-only users)
    if (!user.passwordHash) {
      await incrementFailures(normalizedEmail);
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      const locked = await incrementFailures(normalizedEmail);
      if (locked) {
        const { body, status } = apiError("AUTH_002");
        return NextResponse.json(body, { status });
      }
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 6. Success — clear failures, generate tokens
    const failKey = `login_failures:${normalizedEmail}`;
    await redis.del(failKey);

    const tokens = signTokens({ sub: user.id, tier: user.subscriptionTier });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error("[auth/login]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

async function incrementFailures(email: string): Promise<boolean> {
  const failKey = `login_failures:${email}`;
  const lockoutKey = `lockout:${email}`;

  const count = await redis.incr(failKey);

  // Set TTL on first failure
  if (count === 1) {
    await redis.expire(failKey, LOCKOUT_TTL);
  }

  if (count >= MAX_FAILURES) {
    await redis.setex(lockoutKey, LOCKOUT_TTL, "1");
    await redis.del(failKey);
    return true; // locked
  }

  return false;
}
