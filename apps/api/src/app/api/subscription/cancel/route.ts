import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { cancelSubscription, SubscriptionError } from "@/lib/engines/subscription-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const result = await cancelSubscription(authResult.user.userId);
    return NextResponse.json({ subscription: result });
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const { body, status } = apiError(error.code, error.details);
      return NextResponse.json(body, { status });
    }
    console.error("[subscription/cancel] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
