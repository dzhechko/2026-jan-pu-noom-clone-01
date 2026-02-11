import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { acceptDuel, DuelError } from "@/lib/engines/duel-engine";
import { duelAcceptSchema } from "@/lib/validators/duels";
import { sendNotification } from "@/lib/engines/notification-engine";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const rawBody = await req.json();
    const parsed = duelAcceptSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "DUEL_002",
            message: "Неверный токен приглашения",
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 },
      );
    }

    const result = await acceptDuel(parsed.data.inviteToken, userId);

    // Fire-and-forget: notify challenger that duel was accepted
    const duel = await prisma.duel.findUnique({
      where: { id: result.duelId },
      include: { opponent: { select: { name: true } } },
    });
    if (duel) {
      sendNotification(duel.challengerId, "duel_accepted", {
        opponentName: duel.opponent?.name ?? "Участник",
        duelId: result.duelId,
      }).catch((err) => console.error("[notifications] duel_accepted", err));
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DuelError) {
      const { body, status } = apiError(error.code);
      return NextResponse.json(body, { status });
    }
    console.error("[duels/accept] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
