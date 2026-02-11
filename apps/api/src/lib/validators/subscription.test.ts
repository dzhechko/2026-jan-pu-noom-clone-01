import { describe, it, expect } from "vitest";
import { webhookUpdateSchema, invoicePayloadSchema, cronSecretSchema } from "./subscription";

describe("webhookUpdateSchema", () => {
  it("validates pre_checkout_query payload", () => {
    const result = webhookUpdateSchema.safeParse({
      update_id: 123,
      pre_checkout_query: {
        id: "query_1",
        from: { id: 123456 },
        currency: "XTR",
        total_amount: 250,
        invoice_payload: '{"userId":"abc","type":"premium_monthly","createdAt":"2026-02-11T00:00:00Z"}',
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates successful_payment payload", () => {
    const result = webhookUpdateSchema.safeParse({
      update_id: 124,
      message: {
        from: { id: 123456 },
        successful_payment: {
          currency: "XTR",
          total_amount: 250,
          invoice_payload: '{"userId":"abc","type":"premium_monthly","createdAt":"2026-02-11T00:00:00Z"}',
          telegram_payment_charge_id: "charge_abc",
          provider_payment_charge_id: "provider_xyz",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("fails on missing update_id", () => {
    const result = webhookUpdateSchema.safeParse({
      pre_checkout_query: {
        id: "query_1",
        from: { id: 123456 },
        currency: "XTR",
        total_amount: 250,
        invoice_payload: "{}",
      },
    });
    expect(result.success).toBe(false);
  });

  it("passes with extra unknown fields (forward compat)", () => {
    const result = webhookUpdateSchema.safeParse({
      update_id: 125,
      pre_checkout_query: {
        id: "query_1",
        from: { id: 123456, is_bot: false, language_code: "ru" },
        currency: "XTR",
        total_amount: 250,
        invoice_payload: "{}",
        extra_field: true,
      },
      unknown_top_level: "value",
    });
    expect(result.success).toBe(true);
  });
});

describe("invoicePayloadSchema", () => {
  it("validates correct payload", () => {
    const result = invoicePayloadSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      type: "premium_monthly",
      createdAt: "2026-02-11T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("fails on non-uuid userId", () => {
    const result = invoicePayloadSchema.safeParse({
      userId: "not-a-uuid",
      type: "premium_monthly",
      createdAt: "2026-02-11T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("fails on wrong type", () => {
    const result = invoicePayloadSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      type: "premium_yearly",
      createdAt: "2026-02-11T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("cronSecretSchema", () => {
  it("validates non-empty secret", () => {
    const result = cronSecretSchema.safeParse({ secret: "my-secret-value" });
    expect(result.success).toBe(true);
  });

  it("fails on empty string", () => {
    const result = cronSecretSchema.safeParse({ secret: "" });
    expect(result.success).toBe(false);
  });
});
