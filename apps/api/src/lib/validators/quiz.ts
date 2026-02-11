import { z } from "zod";

export const quizSubmitSchema = z.object({
  gender: z.enum(["male", "female"], {
    required_error: "Укажите пол",
  }),
  age: z
    .number({ required_error: "Укажите возраст" })
    .int("Возраст должен быть целым числом")
    .min(14, "Минимальный возраст — 14 лет")
    .max(120, "Максимальный возраст — 120 лет"),
  heightCm: z
    .number({ required_error: "Укажите рост" })
    .min(100, "Минимальный рост — 100 см")
    .max(250, "Максимальный рост — 250 см"),
  weightKg: z
    .number({ required_error: "Укажите вес" })
    .min(30, "Минимальный вес — 30 кг")
    .max(300, "Максимальный вес — 300 кг"),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"], {
    required_error: "Укажите уровень активности",
  }),
  sleepHours: z
    .number({ required_error: "Укажите часы сна" })
    .min(1, "Минимум 1 час")
    .max(16, "Максимум 16 часов"),
  stressLevel: z.enum(["low", "moderate", "high", "very_high"], {
    required_error: "Укажите уровень стресса",
  }),
  mealsPerDay: z
    .number({ required_error: "Укажите количество приёмов пищи" })
    .int()
    .min(1, "Минимум 1 приём пищи")
    .max(10, "Максимум 10 приёмов пищи"),
  snackingFrequency: z.enum(["never", "rarely", "often"], {
    required_error: "Укажите частоту перекусов",
  }),
  waterGlasses: z
    .number({ required_error: "Укажите количество стаканов воды" })
    .int()
    .min(0, "Минимум 0 стаканов")
    .max(20, "Максимум 20 стаканов"),
  medicalConditions: z.array(
    z.enum(["diabetes", "hypertension", "thyroid"])
  ).default([]),
  medications: z.array(z.string().max(100)).default([]),
});

export const quizSaveSchema = z.object({
  quizId: z.string().uuid("Некорректный ID результата"),
});

export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;
export type QuizSaveInput = z.infer<typeof quizSaveSchema>;
