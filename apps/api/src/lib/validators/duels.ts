import { z } from "zod";

export const duelAcceptSchema = z.object({
  inviteToken: z.string().min(32, "Неверный токен").max(64, "Неверный токен"),
});

export const duelIdParamSchema = z.object({
  id: z.string().uuid("Неверный ID дуэли"),
});
