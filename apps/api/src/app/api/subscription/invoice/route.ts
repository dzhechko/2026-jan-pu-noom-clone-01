import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { createInvoice, SubscriptionError } from "@/lib/engines/subscription-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const result = await createInvoice(authResult.user.userId);
    return NextResponse.json({ invoice: result });
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const { body, status } = apiError(error.code, error.details);
      return NextResponse.json(body, { status });
    }
    console.error("[subscription/invoice] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
