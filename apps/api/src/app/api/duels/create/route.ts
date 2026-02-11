import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { createDuel, DuelError } from "@/lib/engines/duel-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId, tier } = authResult.user;

    const result = await createDuel(userId, tier);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DuelError) {
      const { body, status } = apiError(error.code);
      return NextResponse.json(body, { status });
    }
    console.error("[duels/create] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
