import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDailySummary } from "@/lib/engines/meal-summary-engine";
import { dailySummarySchema } from "@/lib/validators/meals";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const parsed = dailySummarySchema.safeParse({ date: dateParam ?? undefined });

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

    const dateStr = parsed.data.date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const meals = await prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: { loggedAt: "asc" },
      select: {
        id: true,
        mealType: true,
        dishName: true,
        calories: true,
        proteinG: true,
        fatG: true,
        carbsG: true,
        portionG: true,
        loggedAt: true,
      },
    });

    // MedicalProfile does not have targetCalories field, using default 2000
    const targetCalories = 2000;

    const summary = computeDailySummary(meals, targetCalories);

    return NextResponse.json({ date: dateStr, meals, summary });
  } catch (error) {
    console.error("[meals/daily] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
