import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Введите корректный email").max(255),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов").max(128),
  name: z.string().min(1, "Введите имя").max(100, "Имя слишком длинное").trim(),
});

export const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token обязателен"),
});

export const vkLoginSchema = z.object({
  vkAccessToken: z.string().min(1),
});

export const telegramAuthSchema = z.object({
  initData: z.string().min(1, "initData обязателен"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type VkLoginInput = z.infer<typeof vkLoginSchema>;
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;
