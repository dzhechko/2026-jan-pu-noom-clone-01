"use client";

import type { ReactNode } from "react";
import { TelegramProvider } from "./telegram-provider";
import { AuthProvider } from "./auth-provider";

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <TelegramProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </TelegramProvider>
  );
}
