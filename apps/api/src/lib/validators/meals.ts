import { z } from "zod";

// Existing schema (moved from route.ts)
export const createMealSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  dishName: z.string().min(1).max(200),
  calories: z.number().int().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  portionG: z.number().int().min(1).max(5000),
});

// Daily summary query
export const dailySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Формат даты: YYYY-MM-DD").optional(),
});

// Meal update (partial — all fields optional)
export const updateMealSchema = z.object({
  dishName: z.string().min(1).max(200).optional(),
  calories: z.number().int().min(0).max(10000).optional(),
  proteinG: z.number().min(0).max(1000).optional(),
  fatG: z.number().min(0).max(1000).optional(),
  carbsG: z.number().min(0).max(1000).optional(),
  portionG: z.number().int().min(1).max(5000).optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
});

// Food search query
export const mealSearchSchema = z.object({
  q: z.string().min(1, "Введите запрос для поиска").max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Meal ID param
export const mealIdParamSchema = z.object({
  id: z.string().uuid("Неверный ID записи"),
});
