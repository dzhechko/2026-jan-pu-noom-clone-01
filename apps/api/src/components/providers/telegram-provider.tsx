"use client";

import {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface TelegramContextValue {
  isTelegram: boolean;
  webApp: WebApp | null;
  initData: string | null;
}

// Telegram WebApp type (minimal subset we use)
interface WebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: WebApp;
    };
  }
}

export const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  webApp: null,
  initData: null,
});

export function TelegramProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [ctx, setCtx] = useState<TelegramContextValue>({
    isTelegram: false,
    webApp: null,
    initData: null,
  });

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (webApp?.initData) {
      // Signal to Telegram that the app is ready
      webApp.ready();
      webApp.expand();

      // Inject theme colors as CSS variables
      const tp = webApp.themeParams;
      const root = document.documentElement;
      if (tp.bg_color) root.style.setProperty("--tg-theme-bg-color", tp.bg_color);
      if (tp.text_color) root.style.setProperty("--tg-theme-text-color", tp.text_color);
      if (tp.hint_color) root.style.setProperty("--tg-theme-hint-color", tp.hint_color);
      if (tp.link_color) root.style.setProperty("--tg-theme-link-color", tp.link_color);
      if (tp.button_color) root.style.setProperty("--tg-theme-button-color", tp.button_color);
      if (tp.button_text_color) root.style.setProperty("--tg-theme-button-text-color", tp.button_text_color);
      if (tp.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", tp.secondary_bg_color);

      setCtx({
        isTelegram: true,
        webApp,
        initData: webApp.initData,
      });
    }
  }, []);

  return (
    <TelegramContext.Provider value={ctx}>
      {children}
    </TelegramContext.Provider>
  );
}
