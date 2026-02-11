import { z } from "zod";

// Webhook update from Telegram (pre_checkout_query or successful_payment)
export const webhookUpdateSchema = z
  .object({
    update_id: z.number(),
    pre_checkout_query: z
      .object({
        id: z.string(),
        from: z.object({ id: z.number() }).passthrough(),
        currency: z.string(),
        total_amount: z.number(),
        invoice_payload: z.string(),
      })
      .passthrough()
      .optional(),
    message: z
      .object({
        from: z.object({ id: z.number() }).passthrough(),
        successful_payment: z
          .object({
            currency: z.string(),
            total_amount: z.number(),
            invoice_payload: z.string(),
            telegram_payment_charge_id: z.string(),
            provider_payment_charge_id: z.string(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Invoice payload embedded in Telegram invoice
export const invoicePayloadSchema = z.object({
  userId: z.string().uuid(),
  type: z.literal("premium_monthly"),
  createdAt: z.string(),
});

// Cron secret header validation
export const cronSecretSchema = z.object({
  secret: z.string().min(1, "Missing cron secret"),
});
