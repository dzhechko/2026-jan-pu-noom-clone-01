import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { webhookUpdateSchema } from "@/lib/validators/subscription";
import { handleWebhookUpdate } from "@/lib/engines/subscription-engine";

function verifyWebhookSecret(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !received) return false;
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

    const raw = await req.json();
    const parsed = webhookUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[webhook] invalid payload", parsed.error.issues);
      return NextResponse.json({ ok: true });
    }

    await handleWebhookUpdate(parsed.data);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook] POST", error);
    // Always return 200 to Telegram
    return NextResponse.json({ ok: true });
  }
}
