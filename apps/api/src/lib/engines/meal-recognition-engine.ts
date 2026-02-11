import { lookupFood } from "./food-database";

export interface RecognitionResult {
  dishName: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  portionG: number;
  confidence: number;
  alternatives: Array<{ dishName: string; calories: number }>;
}

export class MealRecognitionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function recognizeMeal(
  photoBuffer: Buffer,
  mimeType: string
): Promise<RecognitionResult> {
  const apiKey = process.env.FOOD_RECOGNITION_API_KEY;
  const apiUrl = process.env.FOOD_RECOGNITION_API_URL;

  if (!apiKey || !apiUrl) {
    throw new MealRecognitionError("MEAL_003", "Сервис распознавания недоступен");
  }

  // Call external API
  let apiResponse;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: photoBuffer as unknown as BodyInit,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    apiResponse = await response.json();
  } catch (error) {
    if (error instanceof MealRecognitionError) throw error;
    throw new MealRecognitionError("MEAL_003", "Сервис распознавания временно недоступен");
  }

  // Check confidence
  if (!apiResponse.confidence || apiResponse.confidence < 0.3) {
    throw new MealRecognitionError("MEAL_002", "Не удалось распознать блюдо");
  }

  // Look up nutrition
  const nutrition = await lookupFood(apiResponse.dish_name ?? apiResponse.dishName);
  const fallback = { caloriesPer100g: 150, proteinPer100g: 10, fatPer100g: 5, carbsPer100g: 20 };
  const n = nutrition ?? fallback;

  const portionG = apiResponse.estimated_portion ?? apiResponse.portionG ?? 300;
  const multiplier = portionG / 100;

  return {
    dishName: apiResponse.dish_name ?? apiResponse.dishName ?? "Неизвестное блюдо",
    calories: Math.round(n.caloriesPer100g * multiplier),
    proteinG: Math.round(n.proteinPer100g * multiplier * 10) / 10,
    fatG: Math.round(n.fatPer100g * multiplier * 10) / 10,
    carbsG: Math.round(n.carbsPer100g * multiplier * 10) / 10,
    portionG,
    confidence: apiResponse.confidence,
    alternatives: (apiResponse.alternatives ?? []).slice(0, 3),
  };
}
