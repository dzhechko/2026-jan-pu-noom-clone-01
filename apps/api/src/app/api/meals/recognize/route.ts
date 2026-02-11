import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { recognizeMeal, MealRecognitionError } from "@/lib/engines/meal-recognition-engine";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Auth check
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const photo = formData.get("photo");

    // 3. Validate photo exists and is a file
    if (!photo || typeof photo === "string") {
      const { body, status } = apiError("MEAL_001", { reason: "Файл не найден" });
      return NextResponse.json(body, { status });
    }

    const file = photo as File;

    // 4. Validate MIME type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      const { body, status } = apiError("MEAL_001", {
        reason: "Неподдерживаемый формат. Используйте JPEG или PNG",
      });
      return NextResponse.json(body, { status });
    }

    // 5. Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const { body, status } = apiError("MEAL_001");
      return NextResponse.json(body, { status });
    }

    // 6. Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 7. Call recognition engine
    const result = await recognizeMeal(buffer, file.type);

    // 8. Return result
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    // Handle recognition-specific errors
    if (error instanceof MealRecognitionError) {
      const { body, status } = apiError(error.code as "MEAL_002" | "MEAL_003");
      return NextResponse.json(body, { status });
    }

    // Generic error
    console.error("[meals/recognize] POST", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
