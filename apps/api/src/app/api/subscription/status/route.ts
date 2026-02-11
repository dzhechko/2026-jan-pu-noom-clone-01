import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { getSubscriptionStatus, SubscriptionError } from "@/lib/engines/subscription-engine";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const result = await getSubscriptionStatus(authResult.user.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const { body, status } = apiError(error.code, error.details);
      return NextResponse.json(body, { status });
    }
    console.error("[subscription/status] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
