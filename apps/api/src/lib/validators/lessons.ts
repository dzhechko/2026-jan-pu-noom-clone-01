import { z } from "zod";
import { TOTAL_LESSONS, QUIZ_QUESTIONS_PER_LESSON } from "@vesna/shared";

export const lessonIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int("ID урока должен быть целым числом")
    .min(1, "Урок не найден")
    .max(TOTAL_LESSONS, "Урок не найден"),
});

export const lessonCompleteSchema = z.object({
  quizAnswers: z
    .array(
      z.number().int().min(0, "Неверный индекс ответа").max(3, "Неверный индекс ответа")
    )
    .length(QUIZ_QUESTIONS_PER_LESSON, `Нужно ответить на все ${QUIZ_QUESTIONS_PER_LESSON} вопроса`),
});
