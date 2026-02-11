import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { processScheduledNotifications } from "@/lib/engines/notification-engine";

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

    const stats = await processScheduledNotifications();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[notifications/cron] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
