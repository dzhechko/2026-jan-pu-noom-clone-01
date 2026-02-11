import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { expirePendingDuels, completeEndedDuels } from "@/lib/engines/duel-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Authenticate via cron secret header
    const cronSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: { code: "AUTH_001", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const [expired, completed] = await Promise.all([
      expirePendingDuels(),
      completeEndedDuels(),
    ]);

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
