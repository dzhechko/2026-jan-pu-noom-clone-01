import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { searchFood } from "@/lib/engines/food-database";
import { mealSearchSchema } from "@/lib/validators/meals";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const url = new URL(req.url);
    const rawParams = {
      q: url.searchParams.get("q") ?? "",
      limit: url.searchParams.get("limit") ?? "10",
    };

    const parsed = mealSearchSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }

    const results = await searchFood(parsed.data.q, parsed.data.limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[meals/search] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
