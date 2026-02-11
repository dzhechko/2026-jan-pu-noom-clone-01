import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createInvoiceLink, answerPreCheckoutQuery } from "@/lib/telegram-payments";
import { sendNotification } from "@/lib/engines/notification-engine";
import type { ErrorCode } from "@/lib/errors";
import type {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionStatusLabel,
  TrialInfo,
  InvoiceData,
} from "@vesna/shared";
import {
  SUBSCRIPTION_TIERS,
  TRIAL_DURATION_DAYS,
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_PRICE_STARS,
  INVOICE_DEDUP_TTL_SECONDS,
  TRIAL_EXPIRY_WARNING_HOURS,
  SUBSCRIPTION_FEATURES_LOST,
} from "@vesna/shared";

// --- Custom error ---

export class SubscriptionError extends Error {
  constructor(
    public code: ErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "SubscriptionError";
  }
}

// --- Pure functions (unit-testable, no DB/IO) ---

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface UserForEligibility {
  hasUsedTrial: boolean;
  subscriptionTier: SubscriptionTier | string;
}

interface UserForStatus {
  subscriptionTier: SubscriptionTier | string;
  subscriptionExpires: Date | null;
  hasUsedTrial: boolean;
  subscriptionCancelledAt: Date | null;
}

export function isTrialEligible(user: UserForEligibility): boolean {
  if (user.subscriptionTier === "clinical") return false;
  if (user.subscriptionTier !== "free") return false;
  if (user.hasUsedTrial) return false;
  return true;
}

export function calculateTrialExpiry(startDate: Date): Date {
  return new Date(startDate.getTime() + TRIAL_DURATION_DAYS * ONE_DAY_MS);
}

export function calculateSubscriptionExpiry(baseDate: Date): Date {
  return new Date(baseDate.getTime() + SUBSCRIPTION_DURATION_DAYS * ONE_DAY_MS);
}

export function deriveSubscriptionStatus(
  user: UserForStatus,
  paymentCount: number,
): SubscriptionStatusLabel {
  if (user.subscriptionTier === "free") {
    return user.hasUsedTrial ? "expired" : "free";
  }

  // Tier is premium or clinical
  const isExpired =
    user.subscriptionExpires != null &&
    user.subscriptionExpires <= new Date();
  if (isExpired) return "expired";

  if (user.subscriptionCancelledAt != null) return "cancelled";

  if (user.hasUsedTrial && paymentCount === 0) return "trial";

  return "active";
}

export function buildSubscriptionResponse(
  user: UserForStatus,
  status: SubscriptionStatusLabel,
  paymentCount: number,
): SubscriptionStatus {
  const now = new Date();
  const tierKey = status === "expired" ? "free" : (user.subscriptionTier as SubscriptionTier);
  const tierConfig = SUBSCRIPTION_TIERS[tierKey] ?? SUBSCRIPTION_TIERS.free;

  let daysRemaining = 0;
  if (user.subscriptionExpires && user.subscriptionExpires > now) {
    daysRemaining = Math.ceil(
      (user.subscriptionExpires.getTime() - now.getTime()) / ONE_DAY_MS,
    );
  }

  let trialEndsAt: string | null = null;
  if (
    user.hasUsedTrial &&
    paymentCount === 0 &&
    user.subscriptionExpires != null
  ) {
    trialEndsAt = user.subscriptionExpires.toISOString();
  }

  return {
    tier: tierKey,
    status,
    canStartTrial: !user.hasUsedTrial && user.subscriptionTier === "free",
    expiresAt:
      status === "expired"
        ? null
        : (user.subscriptionExpires?.toISOString() ?? null),
    trialEndsAt,
    cancelledAt: user.subscriptionCancelledAt?.toISOString() ?? null,
    daysRemaining,
    features: {
      maxLessons: tierConfig.maxLessons,
      hasCoach: tierConfig.hasCoach,
      hasDuels: tierConfig.hasDuels,
    },
  };
}

export function buildInvoicePayload(userId: string): {
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: { label: string; amount: number }[];
} {
  return {
    title: "Весна Premium",
    description: "Подписка на 30 дней: AI-коуч, 14 уроков, дуэли",
    payload: JSON.stringify({
      userId,
      type: "premium_monthly",
      createdAt: new Date().toISOString(),
    }),
    currency: "XTR",
    prices: [{ label: "Premium 30 дней", amount: SUBSCRIPTION_PRICE_STARS }],
  };
}

export function getTrialInfo(user: UserForEligibility): TrialInfo {
  if (user.subscriptionTier !== "free") {
    return {
      eligible: false,
      durationDays: TRIAL_DURATION_DAYS,
      message: "У вас уже есть активная подписка",
    };
  }

  if (user.hasUsedTrial) {
    return {
      eligible: false,
      durationDays: TRIAL_DURATION_DAYS,
      message: "Пробный период уже был использован",
    };
  }

  return {
    eligible: true,
    durationDays: TRIAL_DURATION_DAYS,
    message: "7 дней Premium бесплатно",
  };
}

export function shouldDowngradeWithActiveDuel(
  activeDuels: { endDate: Date | null }[],
): boolean {
  if (activeDuels.length === 0) return true;
  const now = new Date();
  for (const duel of activeDuels) {
    if (duel.endDate && duel.endDate > now) return false;
  }
  return true;
}

// --- DB-dependent functions ---

export async function startTrial(userId: string): Promise<SubscriptionStatus> {
  // Pre-flight check for better error messages (non-atomic)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, subscriptionTier: true, hasUsedTrial: true },
  });
  if (!user) throw new SubscriptionError("AUTH_001");

  if (user.subscriptionTier === "clinical") {
    throw new SubscriptionError("PAY_004", { reason: "clinical_managed_by_admin" });
  }
  if (user.subscriptionTier !== "free") {
    throw new SubscriptionError("PAY_004", { reason: "already_premium" });
  }
  if (user.hasUsedTrial) {
    throw new SubscriptionError("PAY_003", { reason: "trial_already_used" });
  }

  const expiresAt = calculateTrialExpiry(new Date());

  // Atomic update with WHERE conditions to prevent TOCTOU race
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      subscriptionTier: "free",
      hasUsedTrial: false,
    },
    data: {
      subscriptionTier: "premium",
      subscriptionExpires: expiresAt,
      hasUsedTrial: true,
    },
  });

  if (updated.count === 0) {
    throw new SubscriptionError("PAY_003", { reason: "trial_already_used" });
  }

  await prisma.subscriptionLog.create({
    data: {
      userId,
      event: "trial_started",
      amount: 0,
      currency: "XTR",
    },
  });

  return {
    tier: "premium",
    status: "trial",
    canStartTrial: false,
    expiresAt: expiresAt.toISOString(),
    trialEndsAt: expiresAt.toISOString(),
    cancelledAt: null,
    daysRemaining: TRIAL_DURATION_DAYS,
    features: {
      maxLessons: SUBSCRIPTION_TIERS.premium.maxLessons,
      hasCoach: SUBSCRIPTION_TIERS.premium.hasCoach,
      hasDuels: SUBSCRIPTION_TIERS.premium.hasDuels,
    },
  };
}

export async function createInvoice(userId: string): Promise<InvoiceData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, telegramId: true },
  });
  if (!user) throw new SubscriptionError("AUTH_001");

  if (!user.telegramId) {
    throw new SubscriptionError("PAY_001", { reason: "no_telegram_id" });
  }

  // Dedup check
  const dedupKey = `sub:invoice:${userId}`;
  try {
    const cached = await redis.get(dedupKey);
    if (cached) return JSON.parse(cached) as InvoiceData;
  } catch {
    // Redis unavailable — proceed without dedup
  }

  const payload = buildInvoicePayload(userId);

  let invoiceUrl: string;
  try {
    invoiceUrl = await createInvoiceLink(payload);
  } catch (error) {
    console.error("[subscription] createInvoiceLink failed", error);
    throw new SubscriptionError("PAY_002");
  }

  const result: InvoiceData = {
    invoiceUrl,
    amount: SUBSCRIPTION_PRICE_STARS,
    currency: "XTR",
    description: "Весна Premium — 30 дней",
  };

  try {
    await redis.setex(dedupKey, INVOICE_DEDUP_TTL_SECONDS, JSON.stringify(result));
  } catch {
    // Redis unavailable — skip cache
  }

  return result;
}

export async function processPayment(
  userId: string,
  telegramPaymentChargeId: string,
  amount: number,
): Promise<SubscriptionStatus> {
  if (amount !== SUBSCRIPTION_PRICE_STARS) {
    console.error("[subscription] Invalid payment amount", {
      expected: SUBSCRIPTION_PRICE_STARS,
      got: amount,
    });
    throw new SubscriptionError("PAY_001", { reason: "invalid_amount" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionExpires: true,
      subscriptionCancelledAt: true,
    },
  });
  if (!user) throw new SubscriptionError("AUTH_001");

  const now = new Date();
  const baseDate =
    user.subscriptionExpires && user.subscriptionExpires > now
      ? user.subscriptionExpires
      : now;
  const expiresAt = calculateSubscriptionExpiry(baseDate);

  const logEvent =
    user.subscriptionTier === "premium" && user.subscriptionCancelledAt != null
      ? "subscription_renewed"
      : "payment_success";

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: "premium",
          subscriptionExpires: expiresAt,
          subscriptionCancelledAt: null,
        },
      }),
      prisma.subscriptionLog.create({
        data: {
          userId,
          event: logEvent,
          amount: SUBSCRIPTION_PRICE_STARS,
          currency: "XTR",
          telegramPaymentChargeId,
        },
      }),
    ]);
  } catch (error: unknown) {
    // Idempotent: P2002 = duplicate telegramPaymentChargeId
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      console.info("[subscription] duplicate payment charge", { telegramPaymentChargeId });
      const status = await getSubscriptionStatus(userId);
      return status.subscription;
    }
    throw error;
  }

  // Invalidate cached invoice
  try {
    await redis.del(`sub:invoice:${userId}`);
  } catch {
    // Redis unavailable
  }

  const daysRemaining = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / ONE_DAY_MS,
  );

  return {
    tier: "premium",
    status: "active",
    canStartTrial: false,
    expiresAt: expiresAt.toISOString(),
    trialEndsAt: null,
    cancelledAt: null,
    daysRemaining,
    features: {
      maxLessons: SUBSCRIPTION_TIERS.premium.maxLessons,
      hasCoach: SUBSCRIPTION_TIERS.premium.hasCoach,
      hasDuels: SUBSCRIPTION_TIERS.premium.hasDuels,
    },
  };
}

export async function cancelSubscription(
  userId: string,
): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionExpires: true,
      hasUsedTrial: true,
      subscriptionCancelledAt: true,
    },
  });
  if (!user) throw new SubscriptionError("AUTH_001");

  if (user.subscriptionTier === "free") {
    throw new SubscriptionError("PAY_005", { reason: "no_active_subscription" });
  }

  // Cannot cancel trial
  if (user.hasUsedTrial) {
    const paymentCount = await prisma.subscriptionLog.count({
      where: { userId, event: "payment_success" },
    });
    if (paymentCount === 0) {
      throw new SubscriptionError("PAY_006", { reason: "cannot_cancel_trial" });
    }
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { subscriptionCancelledAt: now },
    }),
    prisma.subscriptionLog.create({
      data: {
        userId,
        event: "subscription_cancelled",
        amount: 0,
        currency: "XTR",
      },
    }),
  ]);

  let daysRemaining = 0;
  if (user.subscriptionExpires && user.subscriptionExpires > now) {
    daysRemaining = Math.ceil(
      (user.subscriptionExpires.getTime() - now.getTime()) / ONE_DAY_MS,
    );
  }

  return {
    tier: user.subscriptionTier as SubscriptionTier,
    status: "cancelled",
    canStartTrial: false,
    expiresAt: user.subscriptionExpires?.toISOString() ?? null,
    trialEndsAt: null,
    cancelledAt: now.toISOString(),
    daysRemaining,
    features: {
      maxLessons: SUBSCRIPTION_TIERS[user.subscriptionTier as SubscriptionTier].maxLessons,
      hasCoach: SUBSCRIPTION_TIERS[user.subscriptionTier as SubscriptionTier].hasCoach,
      hasDuels: SUBSCRIPTION_TIERS[user.subscriptionTier as SubscriptionTier].hasDuels,
    },
    lostFeatures: [...SUBSCRIPTION_FEATURES_LOST],
  };
}

export async function getSubscriptionStatus(
  userId: string,
): Promise<{ subscription: SubscriptionStatus; trial: TrialInfo }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpires: true,
      hasUsedTrial: true,
      subscriptionCancelledAt: true,
    },
  });
  if (!user) throw new SubscriptionError("AUTH_001");

  const paymentCount = await prisma.subscriptionLog.count({
    where: { userId, event: "payment_success" },
  });

  const status = deriveSubscriptionStatus(user, paymentCount);
  const subscription = buildSubscriptionResponse(user, status, paymentCount);
  const trial = getTrialInfo(user);

  return { subscription, trial };
}

export async function processExpirations(): Promise<{
  trialsExpired: number;
  subscriptionsExpired: number;
  trialWarningsSent: number;
}> {
  const now = new Date();
  let trialsExpired = 0;
  let subscriptionsExpired = 0;
  let trialWarningsSent = 0;

  // 1. Find expired users (batch cap 1000)
  const expiredUsers = await prisma.user.findMany({
    where: {
      subscriptionTier: { in: ["premium", "clinical"] },
      subscriptionExpires: { lt: now },
    },
    select: { id: true, hasUsedTrial: true },
    take: 1000,
  });

  if (expiredUsers.length > 0) {
    const userIds = expiredUsers.map((u) => u.id);

    // Batch downgrade
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        subscriptionTier: "free",
        subscriptionCancelledAt: null,
      },
    });

    // Batch log expirations (single createMany instead of N inserts)
    await prisma.subscriptionLog.createMany({
      data: userIds.map((uid) => ({
        userId: uid,
        event: "subscription_expired",
        amount: 0,
        currency: "XTR",
      })),
    });

    // Batch payment count (single groupBy instead of N counts)
    const paymentCounts = await prisma.subscriptionLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, event: "payment_success" },
      _count: { _all: true },
    });
    const paymentMap = new Map(
      paymentCounts.map((p) => [p.userId, p._count._all]),
    );

    for (const user of expiredUsers) {
      if ((paymentMap.get(user.id) ?? 0) === 0) trialsExpired++;
      else subscriptionsExpired++;
    }

    // Fire-and-forget notifications
    for (const uid of userIds) {
      sendNotification(uid, "subscription_expired" as never, {}).catch((err) =>
        console.error("[subscription] expiry notification", err),
      );
    }
  }

  // 2. Trial expiry warnings (24h before)
  const warningThreshold = new Date(
    now.getTime() + TRIAL_EXPIRY_WARNING_HOURS * 60 * 60 * 1000,
  );

  const trialUsers = await prisma.user.findMany({
    where: {
      subscriptionTier: "premium",
      subscriptionExpires: { gt: now, lt: warningThreshold },
      hasUsedTrial: true,
    },
    select: { id: true },
    take: 1000,
  });

  if (trialUsers.length > 0) {
    const trialUserIds = trialUsers.map((u) => u.id);
    const trialPaymentCounts = await prisma.subscriptionLog.groupBy({
      by: ["userId"],
      where: { userId: { in: trialUserIds }, event: "payment_success" },
      _count: { _all: true },
    });
    const trialPaymentMap = new Map(
      trialPaymentCounts.map((p) => [p.userId, p._count._all]),
    );

    for (const user of trialUsers) {
      if ((trialPaymentMap.get(user.id) ?? 0) === 0) {
        sendNotification(user.id, "trial_expiring" as never, {}).catch((err) =>
          console.error("[subscription] trial warning", err),
        );
        trialWarningsSent++;
      }
    }
  }

  return { trialsExpired, subscriptionsExpired, trialWarningsSent };
}

// --- Webhook handlers ---

export async function handlePreCheckoutQuery(query: {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}): Promise<void> {
  try {
    let payload: { userId?: string; type?: string };
    try {
      payload = JSON.parse(query.invoice_payload) as { userId?: string; type?: string };
    } catch {
      await answerPreCheckoutQuery(query.id, false, "Неверные данные заказа");
      return;
    }

    if (!payload.userId) {
      await answerPreCheckoutQuery(query.id, false, "Неверные данные заказа");
      return;
    }

    if (payload.type !== "premium_monthly") {
      await answerPreCheckoutQuery(query.id, false, "Неизвестный тип подписки");
      return;
    }

    if (query.total_amount !== SUBSCRIPTION_PRICE_STARS) {
      await answerPreCheckoutQuery(query.id, false, "Неверная сумма");
      return;
    }

    if (query.currency !== "XTR") {
      await answerPreCheckoutQuery(query.id, false, "Неверная валюта");
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });
    if (!user) {
      await answerPreCheckoutQuery(query.id, false, "Неверные данные заказа");
      return;
    }

    await answerPreCheckoutQuery(query.id, true);
  } catch (error) {
    console.error("[webhook] pre_checkout_query error", error);
    await answerPreCheckoutQuery(query.id, false, "Ошибка обработки");
  }
}

export async function handleSuccessfulPayment(update: {
  message: {
    from: { id: number };
    successful_payment: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
}): Promise<void> {
  const payment = update.message.successful_payment;

  try {
    // Validate amount
    if (payment.total_amount !== SUBSCRIPTION_PRICE_STARS) {
      console.error("[webhook] successful_payment: invalid amount", {
        expected: SUBSCRIPTION_PRICE_STARS,
        got: payment.total_amount,
      });
      return;
    }

    if (payment.currency !== "XTR") {
      console.error("[webhook] successful_payment: invalid currency", {
        expected: "XTR",
        got: payment.currency,
      });
      return;
    }

    let payload: { userId?: string };
    try {
      payload = JSON.parse(payment.invoice_payload) as { userId?: string };
    } catch {
      console.error("[webhook] successful_payment: invalid payload JSON");
      return;
    }

    if (!payload.userId) {
      console.error("[webhook] successful_payment: missing userId in payload");
      return;
    }

    // Idempotency check
    const existing = await prisma.subscriptionLog.findFirst({
      where: { telegramPaymentChargeId: payment.telegram_payment_charge_id },
    });
    if (existing) {
      console.info("[webhook] duplicate payment, already processed", {
        chargeId: payment.telegram_payment_charge_id,
      });
      return;
    }

    await processPayment(
      payload.userId,
      payment.telegram_payment_charge_id,
      payment.total_amount,
    );

    // Fire-and-forget notification
    sendNotification(payload.userId, "payment_success" as never, {}).catch(
      (err) => console.error("[webhook] payment notification", err),
    );
  } catch (error) {
    console.error("[webhook] successful_payment error", error);
    // Do NOT throw — Telegram expects 200 OK
  }
}

export async function handleWebhookUpdate(
  update: Record<string, unknown>,
): Promise<void> {
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(
      update.pre_checkout_query as Parameters<typeof handlePreCheckoutQuery>[0],
    );
  } else if (
    update.message &&
    typeof update.message === "object" &&
    (update.message as Record<string, unknown>).successful_payment
  ) {
    await handleSuccessfulPayment(
      update as unknown as Parameters<typeof handleSuccessfulPayment>[0],
    );
  }
}
