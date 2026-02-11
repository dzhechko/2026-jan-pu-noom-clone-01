import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/errors";
import { signTokens } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { telegramAuthSchema } from "@/lib/validators/auth";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import { RATE_LIMITS } from "@vesna/shared";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Parse & validate body
    const raw = await req.json();
    const parsed = telegramAuthSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте данные",
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 },
      );
    }

    // 2. Rate limit
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`auth:telegram:${ip}`, RATE_LIMITS.auth);

    if (!rl.allowed) {
      const { body, status } = apiError("AUTH_003");
      const response = NextResponse.json(body, { status });
      for (const [k, v] of Object.entries(rateLimitHeaders(rl, RATE_LIMITS.auth))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // 3. Validate Telegram initData signature
    const botToken = process.env.TG_BOT_TOKEN;
    if (!botToken) {
      console.error("[auth/telegram] TG_BOT_TOKEN not configured");
      const { body, status } = apiError("GEN_001");
      return NextResponse.json(body, { status });
    }

    let tgUser;
    try {
      tgUser = validateTelegramInitData(parsed.data.initData, botToken);
    } catch (error) {
      console.error("[auth/telegram] initData validation failed:", error);
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 4. Find or create user by telegramId
    const telegramId = String(tgUser.id);
    let user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        telegramId: true,
        createdAt: true,
      },
    });

    if (!user) {
      const name = [tgUser.firstName, tgUser.lastName].filter(Boolean).join(" ");
      user = await prisma.user.create({
        data: {
          telegramId,
          name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          telegramId: true,
          createdAt: true,
        },
      });
    }

    // 5. Generate tokens
    const tokens = signTokens({ sub: user.id, tier: user.subscriptionTier });

    return NextResponse.json({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error("[auth/telegram]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
