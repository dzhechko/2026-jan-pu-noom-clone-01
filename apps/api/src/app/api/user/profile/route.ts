import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        telegramId: true,
        createdAt: true,
        medicalProfile: true,
        gamification: true,
        streak: true,
      },
    });

    if (!user) {
      const { body, status } = apiError("AUTH_001");
      return NextResponse.json(body, { status });
    }

    const { medicalProfile, gamification, streak, ...userData } = user;

    return NextResponse.json({
      user: userData,
      medicalProfile: medicalProfile ?? null,
      gamification: gamification ?? null,
      streak: streak ?? null,
    });
  } catch (error) {
    console.error("[user/profile] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const rawBody = await req.json();
    const parsed = patchSchema.safeParse(rawBody);
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        telegramId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("[user/profile] PATCH", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
