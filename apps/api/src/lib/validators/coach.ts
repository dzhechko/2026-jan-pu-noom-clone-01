import { z } from "zod";
import { MAX_COACH_MESSAGE_LENGTH } from "@vesna/shared";

export const coachMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Сообщение не может быть пустым")
    .max(MAX_COACH_MESSAGE_LENGTH, `Максимум ${MAX_COACH_MESSAGE_LENGTH} символов`),
});
