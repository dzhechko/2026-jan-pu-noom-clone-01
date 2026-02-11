"use client";

import { useContext } from "react";
import { TelegramContext, type TelegramContextValue } from "@/components/providers/telegram-provider";

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
