import type { Decimal } from "@prisma/client/runtime/library";

export interface DailySummary {
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  targetCalories: number;
  status: "green" | "yellow" | "red";
}

export interface MealInput {
  calories: number;
  proteinG: number | Decimal;
  fatG: number | Decimal;
  carbsG: number | Decimal;
}

/**
 * Computes daily meal summary with traffic light status
 *
 * Traffic light logic:
 * - Green: total <= target * 1.0
 * - Yellow: target * 1.0 < total <= target * 1.15
 * - Red: total > target * 1.15
 *
 * @param meals - Array of meal records with nutrition data
 * @param targetCalories - Daily calorie target (default: 2000)
 * @returns DailySummary with totals and status
 */
export function computeDailySummary(
  meals: Array<MealInput>,
  targetCalories: number = 2000
): DailySummary {
  // Handle edge case: empty meals array
  if (meals.length === 0) {
    return {
      totalCalories: 0,
      totalProteinG: 0,
      totalFatG: 0,
      totalCarbsG: 0,
      targetCalories,
      status: "green",
    };
  }

  // Sum all nutrition values, converting Decimal to number
  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalProteinG = meals.reduce(
    (sum, meal) => sum + Number(meal.proteinG),
    0
  );
  const totalFatG = meals.reduce((sum, meal) => sum + Number(meal.fatG), 0);
  const totalCarbsG = meals.reduce((sum, meal) => sum + Number(meal.carbsG), 0);

  // Determine status based on traffic light logic
  let status: "green" | "yellow" | "red";

  // Edge case: targetCalories is 0 (avoid division by zero)
  if (targetCalories === 0) {
    status = "green";
  } else if (totalCalories <= targetCalories * 1.0) {
    status = "green";
  } else if (totalCalories <= targetCalories * 1.15) {
    status = "yellow";
  } else {
    status = "red";
  }

  return {
    totalCalories,
    totalProteinG,
    totalFatG,
    totalCarbsG,
    targetCalories,
    status,
  };
}
