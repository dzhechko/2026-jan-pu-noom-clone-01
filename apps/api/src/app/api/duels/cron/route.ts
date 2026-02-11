import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiError } from "@/lib/errors";
import { expirePendingDuels, completeEndedDuels } from "@/lib/engines/duel-engine";
import { sendNotification } from "@/lib/engines/notification-engine";
import { prisma } from "@/lib/prisma";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Authenticate via cron secret header (constant-time comparison)
    const cronSecret = req.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      console.warn("[duels/cron] CRON_SECRET not configured");
      return NextResponse.json(
        { error: { code: "AUTH_001", message: "Unauthorized" } },
        { status: 401 },
      );
    }
    if (!cronSecret || !safeCompare(cronSecret, expected)) {
      return NextResponse.json(
        { error: { code: "AUTH_001", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    // Fetch active duels that are about to be completed (before completing them)
    const endingDuels = await prisma.duel.findMany({
      where: { status: "active", endDate: { lt: new Date() } },
      select: { id: true, challengerId: true, opponentId: true },
    });

    const [expired, completed] = await Promise.all([
      expirePendingDuels(),
      completeEndedDuels(),
    ]);

    // Fire-and-forget: notify both players of completed duels
    for (const duel of endingDuels) {
      const playerIds = [duel.challengerId, duel.opponentId].filter(Boolean) as string[];
      for (const playerId of playerIds) {
        sendNotification(playerId, "duel_completed", {
          duelId: duel.id,
        }).catch((err) => console.error("[notifications] duel_completed", err));
      }
    }

    return NextResponse.json({
      expired,
      completed,
    });
  } catch (error) {
    console.error("[duels/cron] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
