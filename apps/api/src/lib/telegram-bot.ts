import type { NotificationMessage } from "@vesna/shared";

export interface TelegramSendResult {
  success: boolean;
  error?: string;
}

const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://app.vesna.ru";

export async function sendTelegramMessage(
  telegramId: string,
  message: NotificationMessage,
): Promise<TelegramSendResult> {
  const botToken = process.env.TG_BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "TG_BOT_TOKEN not configured" };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body = {
    chat_id: telegramId,
    text: message.text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: message.buttonText,
            web_app: { url: MINI_APP_URL + message.buttonUrl },
          },
        ],
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return { success: true };
    }

    // User blocked the bot
    if (response.status === 403) {
      return { success: false, error: "blocked" };
    }

    // Rate limited — retry once after waiting
    if (response.status === 429) {
      const data = (await response.json()) as {
        parameters?: { retry_after?: number };
      };
      const retryAfter = data.parameters?.retry_after ?? 1;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      // Single retry
      const retryResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (retryResponse.ok) {
        return { success: true };
      }
      return { success: false, error: `retry failed: ${retryResponse.status}` };
    }

    const errorData = (await response.json().catch(() => ({}))) as {
      description?: string;
    };
    return {
      success: false,
      error: errorData.description ?? `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
