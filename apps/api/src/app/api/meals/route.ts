import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createMealSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  dishName: z.string().min(1).max(200),
  calories: z.number().int().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  portionG: z.number().int().min(1).max(5000),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [meals, total] = await Promise.all([
      prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: sevenDaysAgo },
        },
        orderBy: { loggedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          mealType: true,
          dishName: true,
          photoUrl: true,
          calories: true,
          proteinG: true,
          fatG: true,
          carbsG: true,
          portionG: true,
          recognitionMethod: true,
          loggedAt: true,
        },
      }),
      prisma.mealLog.count({
        where: {
          userId,
          loggedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return NextResponse.json({
      meals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[meals] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    const rawBody = await req.json();
    const parsed = createMealSchema.safeParse(rawBody);
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

    const meal = await prisma.mealLog.create({
      data: {
        userId,
        mealType: parsed.data.mealType,
        dishName: parsed.data.dishName,
        calories: parsed.data.calories,
        proteinG: parsed.data.proteinG,
        fatG: parsed.data.fatG,
        carbsG: parsed.data.carbsG,
        portionG: parsed.data.portionG,
        recognitionMethod: "manual_entry",
      },
      select: {
        id: true,
        mealType: true,
        dishName: true,
        calories: true,
        proteinG: true,
        fatG: true,
        carbsG: true,
        portionG: true,
        recognitionMethod: true,
        loggedAt: true,
      },
    });

    return NextResponse.json({ meal }, { status: 201 });
  } catch (error) {
    console.error("[meals] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
