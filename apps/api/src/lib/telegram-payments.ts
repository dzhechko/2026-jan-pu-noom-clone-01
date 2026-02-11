const TG_API_BASE = "https://api.telegram.org/bot";

function getBotToken(): string {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("TG_BOT_TOKEN not configured");
  return token;
}

export interface CreateInvoiceLinkParams {
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: { label: string; amount: number }[];
}

export async function createInvoiceLink(
  params: CreateInvoiceLinkParams,
): Promise<string> {
  const token = getBotToken();
  const providerToken = process.env.TELEGRAM_PAYMENT_TOKEN ?? "";

  const response = await fetch(`${TG_API_BASE}${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, provider_token: providerToken }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      description?: string;
    };
    throw new Error(
      `createInvoiceLink failed: ${response.status} ${data.description ?? ""}`,
    );
  }

  const data = (await response.json()) as { ok: boolean; result: string };
  if (!data.ok) {
    throw new Error("createInvoiceLink returned ok=false");
  }
  return data.result;
}

export async function answerPreCheckoutQuery(
  queryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  const token = getBotToken();

  const body: Record<string, unknown> = {
    pre_checkout_query_id: queryId,
    ok,
  };
  if (!ok && errorMessage) {
    body.error_message = errorMessage;
  }

  await fetch(`${TG_API_BASE}${token}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
