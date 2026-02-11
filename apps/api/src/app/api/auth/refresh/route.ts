import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiError } from "@/lib/errors";
import { verifyRefreshToken, signTokens } from "@/lib/auth";
import { refreshSchema } from "@/lib/validators/auth";

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Parse & validate
    const raw = await req.json();
    const parsed = refreshSchema.safeParse(raw);

    if (!parsed.success) {
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    const { refreshToken } = parsed.data;

    // 2. Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 3. Check blacklist
    const blacklistKey = `blacklist:${refreshToken}`;
    const isBlacklisted = await redis.get(blacklistKey);

    if (isBlacklisted) {
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 4. Lookup user (ensure still exists, get current tier)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, subscriptionTier: true },
    });

    if (!user) {
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    // 5. Blacklist old refresh token
    await redis.setex(blacklistKey, REFRESH_TOKEN_TTL, "1");

    // 6. Issue new token pair
    const tokens = signTokens({ sub: user.id, tier: user.subscriptionTier });

    return NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error("[auth/refresh]", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
