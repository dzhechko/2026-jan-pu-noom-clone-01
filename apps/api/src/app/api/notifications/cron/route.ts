import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiError } from "@/lib/errors";
import { processScheduledNotifications } from "@/lib/engines/notification-engine";

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
      console.warn("[notifications/cron] CRON_SECRET not configured");
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

    const stats = await processScheduledNotifications();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[notifications/cron] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
