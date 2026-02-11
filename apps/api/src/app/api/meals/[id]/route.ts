import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mealIdParamSchema, updateMealSchema } from "@/lib/validators/meals";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    // Parse and validate meal ID
    const awaitedParams = await params;
    const paramsParsed = mealIdParamSchema.safeParse(awaitedParams);
    if (!paramsParsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: paramsParsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }
    const { id: mealId } = paramsParsed.data;

    // Parse and validate request body
    const rawBody = await req.json();
    const bodyParsed = updateMealSchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: bodyParsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }

    // Find meal and check ownership
    const existingMeal = await prisma.mealLog.findUnique({
      where: { id: mealId },
      select: { userId: true },
    });

    if (!existingMeal || existingMeal.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "GEN_001",
            message: "Запись не найдена",
          },
        },
        { status: 404 }
      );
    }

    // Update meal
    const updatedMeal = await prisma.mealLog.update({
      where: { id: mealId },
      data: bodyParsed.data,
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
    });

    return NextResponse.json({ meal: updatedMeal });
  } catch (error) {
    console.error("[meals/:id] PATCH", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }
    const { userId } = authResult.user;

    // Parse and validate meal ID
    const awaitedParams = await params;
    const paramsParsed = mealIdParamSchema.safeParse(awaitedParams);
    if (!paramsParsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "QUIZ_001",
            message: "Проверьте правильность данных",
            details: { fields: paramsParsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 }
      );
    }
    const { id: mealId } = paramsParsed.data;

    // Find meal and check ownership
    const existingMeal = await prisma.mealLog.findUnique({
      where: { id: mealId },
      select: { userId: true },
    });

    if (!existingMeal || existingMeal.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "GEN_001",
            message: "Запись не найдена",
          },
        },
        { status: 404 }
      );
    }

    // Delete meal
    await prisma.mealLog.delete({
      where: { id: mealId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[meals/:id] DELETE", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
