import { describe, it, expect } from "vitest";
import {
  isTrialEligible,
  calculateTrialExpiry,
  calculateSubscriptionExpiry,
  deriveSubscriptionStatus,
  buildSubscriptionResponse,
  buildInvoicePayload,
  getTrialInfo,
  shouldDowngradeWithActiveDuel,
} from "./subscription-engine";

describe("isTrialEligible", () => {
  it("returns true for free user who has not used trial", () => {
    expect(isTrialEligible({ hasUsedTrial: false, subscriptionTier: "free" })).toBe(true);
  });

  it("returns false for user who already used trial", () => {
    expect(isTrialEligible({ hasUsedTrial: true, subscriptionTier: "free" })).toBe(false);
  });

  it("returns false for clinical user", () => {
    expect(isTrialEligible({ hasUsedTrial: false, subscriptionTier: "clinical" })).toBe(false);
  });

  it("returns false for premium user", () => {
    expect(isTrialEligible({ hasUsedTrial: false, subscriptionTier: "premium" })).toBe(false);
  });
});

describe("calculateTrialExpiry", () => {
  it("returns startDate + 7 days", () => {
    const start = new Date("2026-02-01T12:00:00Z");
    const expiry = calculateTrialExpiry(start);
    expect(expiry.toISOString()).toBe("2026-02-08T12:00:00.000Z");
  });

  it("handles month boundary (Jan 28 + 7d = Feb 4)", () => {
    const start = new Date("2026-01-28T00:00:00Z");
    const expiry = calculateTrialExpiry(start);
    expect(expiry.toISOString()).toBe("2026-02-04T00:00:00.000Z");
  });
});

describe("calculateSubscriptionExpiry", () => {
  it("returns baseDate + 30 days", () => {
    const base = new Date("2026-02-01T12:00:00Z");
    const expiry = calculateSubscriptionExpiry(base);
    expect(expiry.toISOString()).toBe("2026-03-03T12:00:00.000Z");
  });

  it("extends from existing expiry (renewal)", () => {
    const existing = new Date("2026-03-15T12:00:00Z");
    const expiry = calculateSubscriptionExpiry(existing);
    expect(expiry.toISOString()).toBe("2026-04-14T12:00:00.000Z");
  });
});

describe("deriveSubscriptionStatus", () => {
  it("returns 'free' for free user who never trialed", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "free", subscriptionExpires: null, hasUsedTrial: false, subscriptionCancelledAt: null },
      0,
    );
    expect(status).toBe("free");
  });

  it("returns 'expired' for free user who used trial", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "free", subscriptionExpires: null, hasUsedTrial: true, subscriptionCancelledAt: null },
      0,
    );
    expect(status).toBe("expired");
  });

  it("returns 'trial' for premium user with trial and no payments", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "premium", subscriptionExpires: new Date(Date.now() + 86400000), hasUsedTrial: true, subscriptionCancelledAt: null },
      0,
    );
    expect(status).toBe("trial");
  });

  it("returns 'active' for premium user with payments", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "premium", subscriptionExpires: new Date(Date.now() + 86400000), hasUsedTrial: true, subscriptionCancelledAt: null },
      1,
    );
    expect(status).toBe("active");
  });

  it("returns 'cancelled' for premium user who cancelled", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "premium", subscriptionExpires: new Date(Date.now() + 86400000), hasUsedTrial: true, subscriptionCancelledAt: new Date() },
      1,
    );
    expect(status).toBe("cancelled");
  });

  it("returns 'expired' for premium with past expiry", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "premium", subscriptionExpires: new Date(Date.now() - 86400000), hasUsedTrial: true, subscriptionCancelledAt: null },
      1,
    );
    expect(status).toBe("expired");
  });

  it("returns 'active' for premium user without trial", () => {
    const status = deriveSubscriptionStatus(
      { subscriptionTier: "premium", subscriptionExpires: new Date(Date.now() + 86400000), hasUsedTrial: false, subscriptionCancelledAt: null },
      1,
    );
    expect(status).toBe("active");
  });
});

describe("buildSubscriptionResponse", () => {
  it("builds free user response", () => {
    const user = { subscriptionTier: "free" as const, subscriptionExpires: null, hasUsedTrial: false, subscriptionCancelledAt: null };
    const response = buildSubscriptionResponse(user, "free", 0);
    expect(response.tier).toBe("free");
    expect(response.status).toBe("free");
    expect(response.canStartTrial).toBe(true);
    expect(response.features.maxLessons).toBe(3);
    expect(response.features.hasCoach).toBe(false);
    expect(response.daysRemaining).toBe(0);
  });

  it("builds premium active response with days remaining", () => {
    const expiry = new Date(Date.now() + 15 * 86400000);
    const user = { subscriptionTier: "premium" as const, subscriptionExpires: expiry, hasUsedTrial: true, subscriptionCancelledAt: null };
    const response = buildSubscriptionResponse(user, "active", 1);
    expect(response.tier).toBe("premium");
    expect(response.features.maxLessons).toBe(14);
    expect(response.features.hasCoach).toBe(true);
    expect(response.daysRemaining).toBeGreaterThanOrEqual(14);
    expect(response.daysRemaining).toBeLessThanOrEqual(16);
  });

  it("builds expired response with free tier features", () => {
    const user = { subscriptionTier: "premium" as const, subscriptionExpires: new Date(Date.now() - 86400000), hasUsedTrial: true, subscriptionCancelledAt: null };
    const response = buildSubscriptionResponse(user, "expired", 1);
    expect(response.tier).toBe("free");
    expect(response.expiresAt).toBeNull();
    expect(response.features.maxLessons).toBe(3);
  });

  it("sets trialEndsAt when in trial period", () => {
    const expiry = new Date(Date.now() + 5 * 86400000);
    const user = { subscriptionTier: "premium" as const, subscriptionExpires: expiry, hasUsedTrial: true, subscriptionCancelledAt: null };
    const response = buildSubscriptionResponse(user, "trial", 0);
    expect(response.trialEndsAt).toBe(expiry.toISOString());
  });

  it("sets cancelledAt in cancelled response", () => {
    const cancelDate = new Date("2026-03-01T10:00:00Z");
    const expiry = new Date(Date.now() + 10 * 86400000);
    const user = { subscriptionTier: "premium" as const, subscriptionExpires: expiry, hasUsedTrial: true, subscriptionCancelledAt: cancelDate };
    const response = buildSubscriptionResponse(user, "cancelled", 1);
    expect(response.cancelledAt).toBe(cancelDate.toISOString());
  });
});

describe("buildInvoicePayload", () => {
  it("returns correct Telegram invoice params", () => {
    const payload = buildInvoicePayload("user-123");
    expect(payload.title).toBe("Весна Premium");
    expect(payload.currency).toBe("XTR");
    expect(payload.prices[0].amount).toBe(250);

    const parsed = JSON.parse(payload.payload);
    expect(parsed.userId).toBe("user-123");
    expect(parsed.type).toBe("premium_monthly");
    expect(parsed.createdAt).toBeDefined();
  });
});

describe("getTrialInfo", () => {
  it("returns eligible for free user without trial", () => {
    const info = getTrialInfo({ hasUsedTrial: false, subscriptionTier: "free" });
    expect(info.eligible).toBe(true);
    expect(info.durationDays).toBe(7);
    expect(info.message).toContain("бесплатно");
  });

  it("returns not eligible for used trial", () => {
    const info = getTrialInfo({ hasUsedTrial: true, subscriptionTier: "free" });
    expect(info.eligible).toBe(false);
    expect(info.message).toContain("использован");
  });

  it("returns not eligible for premium user", () => {
    const info = getTrialInfo({ hasUsedTrial: false, subscriptionTier: "premium" });
    expect(info.eligible).toBe(false);
    expect(info.message).toContain("подписка");
  });
});

describe("shouldDowngradeWithActiveDuel", () => {
  it("returns true when no active duels", () => {
    expect(shouldDowngradeWithActiveDuel([])).toBe(true);
  });

  it("returns false when duel ends in the future", () => {
    const futureEnd = new Date(Date.now() + 86400000);
    expect(shouldDowngradeWithActiveDuel([{ endDate: futureEnd }])).toBe(false);
  });

  it("returns true when all duels have ended", () => {
    const pastEnd = new Date(Date.now() - 86400000);
    expect(shouldDowngradeWithActiveDuel([{ endDate: pastEnd }])).toBe(true);
  });

  it("returns true when duel endDate is null", () => {
    expect(shouldDowngradeWithActiveDuel([{ endDate: null }])).toBe(true);
  });
});
