import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { timingSafeEqual } from "crypto";
import { handleWebhookUpdate } from "@/lib/engines/subscription-engine";

function verifyWebhookSecret(received: string | null): boolean {
  const botToken = process.env.TG_BOT_TOKEN;
  if (!botToken || !received) return false;

  const expected = createHash("sha256").update(botToken).digest("hex");
  if (expected.length !== received.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyWebhookSecret(secretToken)) {
      console.warn("[webhook] signature verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update = await req.json();
    await handleWebhookUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook] POST", error);
    // Always return 200 to Telegram
    return NextResponse.json({ ok: true });
  }
}
