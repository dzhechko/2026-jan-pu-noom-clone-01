# Refinement: Paywall & Payments (F9)

## 1. Error Handling Matrix

| Code | HTTP | Trigger | User Message | System Action |
|------|:----:|---------|-------------|---------------|
| PAY_001 | 402 | Telegram Stars payment failed (insufficient stars, cancelled by user, charge declined) | "Оплата не прошла. Проверьте баланс Stars и попробуйте снова" | Log to SubscriptionLog (event=payment_failed), suggest retry with backoff hint |
| PAY_002 | 502 | Telegram Bot API unreachable during invoice creation or payment confirmation | "Сервис оплаты временно недоступен. Попробуйте через несколько минут" | Log incident, return cached subscription status from Redis if available, do not create orphan invoices |
| PAY_003 | 401 | Webhook signature verification failed (invalid hash, tampered payload, replay attack) | — (no user-facing response, webhook-only) | Log full request headers (no body), return 401 to Telegram, alert team via monitoring |

### Error Resolution Flows

**PAY_001 — Payment Failed:**
1. User sees error toast with retry CTA
2. Frontend enables retry after 3 seconds
3. After 3 consecutive failures within 10 minutes, show "Обратитесь в поддержку" with Telegram support link
4. SubscriptionLog records each attempt with `telegramPaymentChargeId: null`

**PAY_002 — Service Unavailable:**
1. Return cached subscription status from Redis (read-only degradation)
2. Do not attempt invoice creation (fail-fast)
3. Frontend shows "Попробуйте позже" with auto-retry countdown (60s)
4. If Bot API returns 5xx, log and increment `pay.api_error` metric

**PAY_003 — Webhook Signature Failure:**
1. Compute expected hash using HMAC-SHA256 with bot token secret key
2. Use constant-time comparison (`crypto.timingSafeEqual`)
3. On mismatch: log request source IP + headers, return 401, do not process
4. If >5 failures in 1 hour, alert team (possible attack)

---

## 2. Edge Cases

| # | Case | Expected Behavior |
|---|------|-------------------|
| 1 | User tries to start trial twice | Check `hasUsedTrial` flag on User model. If true, skip trial and go directly to payment flow. Return existing subscription status. |
| 2 | Trial expires exactly during active session | Middleware checks `subscriptionExpires` on each protected request. Return LESSON_001 (403) for lesson 4+ access. Frontend handles by showing paywall modal. No session interruption for non-gated content. |
| 3 | Payment webhook (`successful_payment`) arrives before `pre_checkout_query` response | Telegram guarantees `pre_checkout_query` comes first. If somehow out of order, `successful_payment` handler checks for existing SubscriptionLog entry. If no pre_checkout log exists, process payment anyway (idempotent upsert). |
| 4 | Concurrent invoice creation (two tabs/devices) | Redis SETNX with key `invoice:pending:{userId}` and 300s TTL. Second request returns existing pending invoice info. If first invoice expires without payment, key auto-expires. |
| 5 | User downgrades but has active duel | Duel continues until endDate regardless of subscription status. Duel scoring still works for both participants. After duel completes, downgraded user cannot create new duels. |
| 6 | Subscription expires during active duel | Same as #5: active duel runs to completion. `processExpirations` cron skips tier downgrade if user has active duel with endDate in the future; instead sets `subscriptionExpires` to duel endDate + 1 hour (grace). |
| 7 | Clock skew between Telegram servers and our server | Accept timestamps within +/- 300 seconds (5 minutes) window. Webhook handler compares `update.message.date` to server `Date.now()`. Log warning if skew > 60s. |
| 8 | Webhook replay attack (duplicate `telegramPaymentChargeId`) | Store `telegramPaymentChargeId` in SubscriptionLog with UNIQUE constraint. On duplicate insert, catch Prisma P2002 error, return 200 OK (idempotent), do not double-credit. |
| 9 | User cancels then resubscribes before expiry | Set `subscriptionCancelledAt` on cancel. If user resubscribes while `subscriptionExpires > now`, clear `subscriptionCancelledAt`, extend `subscriptionExpires` by 30 days from current expiry (not from now). |
| 10 | Trial user never pays after trial ends | `processExpirations` cron sets `subscriptionTier = free`, clears `subscriptionExpires`. User keeps all data but loses access to premium features. Show "Подписка истекла" on next app open. |
| 11 | Network error during invoice creation (TG API timeout) | Wrap `createInvoiceLink` in try/catch. On timeout/network error, return PAY_002. Do not write SubscriptionLog entry (no orphan records). Client retries. |
| 12 | User has `subscriptionTier = premium` but `subscriptionExpires` is null (data inconsistency) | `getSubscriptionStatus` treats this as active premium (grandfathered/manual). Log warning for ops review. `processExpirations` skips users where `subscriptionExpires IS NULL`. |
| 13 | Cron `processExpirations` runs twice in same hour (idempotent) | Uses `WHERE subscriptionExpires < NOW() AND subscriptionTier != 'free'` — second run finds 0 rows. SubscriptionLog dedup: check if `subscription_expired` event exists for this userId within last 2 hours. |
| 14 | Bot token invalid for Telegram payment API | `createInvoiceLink` catches 401 from Bot API. Log critical error, return PAY_002 to user. Alert team immediately. Do not retry (token won't self-fix). |
| 15 | Stars price changes (Telegram updates pricing) | `SUBSCRIPTION_PRICE_STARS` is a constant in `@vesna/shared`. Change requires code update + deploy. Existing active subscriptions keep their price until next renewal. Frontend always reads price from constant, not hardcoded in UI. |
| 16 | User has clinical tier (manually assigned) | `startTrial` and `processPayment` skip users with `subscriptionTier = clinical`. Clinical users are managed by admin, not self-service. |
| 17 | Redis unavailable during subscription status check | Fall through to PostgreSQL query. Cache miss is acceptable (60s TTL means at most 60s of extra DB load). Log warning. |
| 18 | User opens paywall, takes 10 minutes, then pays | Invoice link has no server-side expiry (Telegram handles expiry). If Telegram expires the invoice, user gets a new one on retry. `pre_checkout_query` re-validates current subscription state. |

---

## 3. Test Strategy

### 3.1 Unit Tests (`subscription-engine.test.ts`)

| Test ID | Function | Scenario | Expected |
|---------|----------|----------|----------|
| UT-P01 | `isTrialEligible` | User with `hasUsedTrial = false` | Returns `true` |
| UT-P02 | `isTrialEligible` | User with `hasUsedTrial = true` | Returns `false` |
| UT-P03 | `isTrialEligible` | User with `subscriptionTier = clinical` | Returns `false` (clinical managed by admin) |
| UT-P04 | `calculateTrialExpiry` | From a given start date | Returns startDate + 7 days |
| UT-P05 | `calculateTrialExpiry` | Handles month boundary (Jan 28 + 7d = Feb 4) | Correct date math |
| UT-P06 | `calculateSubscriptionExpiry` | From a given start date | Returns startDate + 30 days |
| UT-P07 | `calculateSubscriptionExpiry` | From existing expiry (renewal) | Returns existingExpiry + 30 days |
| UT-P08 | `getSubscriptionStatus` | Free user | Returns `{ tier: "free", isActive: false, ... }` |
| UT-P09 | `getSubscriptionStatus` | Premium user with future expiry | Returns `{ tier: "premium", isActive: true, expiresAt, ... }` |
| UT-P10 | `getSubscriptionStatus` | Premium user with past expiry | Returns `{ tier: "premium", isActive: false, isExpired: true, ... }` |
| UT-P11 | `getSubscriptionStatus` | Premium with null expiry (grandfathered) | Returns `{ tier: "premium", isActive: true, ... }` with warning flag |
| UT-P12 | `getSubscriptionStatus` | Cancelled user with future expiry | Returns `{ isActive: true, isCancelled: true, expiresAt }` |
| UT-P13 | `verifyWebhookSignature` | Valid hash | Returns `true` |
| UT-P14 | `verifyWebhookSignature` | Tampered payload | Returns `false` |
| UT-P15 | `verifyWebhookSignature` | Empty/missing hash | Returns `false` |
| UT-P16 | `shouldDowngradeWithActiveDuel` | User has active duel ending in future | Returns `false` (grace period) |
| UT-P17 | `shouldDowngradeWithActiveDuel` | User has no active duel | Returns `true` |
| UT-P18 | `buildInvoicePayload` | Standard subscription | Returns correct Telegram Stars invoice params with `SUBSCRIPTION_PRICE_STARS` |

### 3.2 Validator Tests (`subscription.test.ts`)

| Test ID | Schema | Scenario | Expected |
|---------|--------|----------|----------|
| VT-P01 | `startTrialSchema` | Valid request (empty body or `{}`) | Passes |
| VT-P02 | `webhookUpdateSchema` | Valid `pre_checkout_query` payload | Passes |
| VT-P03 | `webhookUpdateSchema` | Valid `successful_payment` payload with `telegramPaymentChargeId` | Passes |
| VT-P04 | `webhookUpdateSchema` | Missing required fields | Fails with descriptive error |
| VT-P05 | `webhookUpdateSchema` | Extra unknown fields (Telegram may add new fields) | Passes (`.passthrough()`) |
| VT-P06 | `cancelSubscriptionSchema` | Valid cancel reason enum | Passes |
| VT-P07 | `cronSecretSchema` | Valid `X-Cron-Secret` header | Passes |
| VT-P08 | `cronSecretSchema` | Missing or wrong secret | Fails |

### 3.3 Integration Tests (requires DB + Redis)

| Test ID | Route | Scenario | Expected |
|---------|-------|----------|----------|
| IT-P01 | `POST /api/subscriptions/trial` | Free user starts trial | 200, tier=premium, hasUsedTrial=true, expiresAt=now+7d |
| IT-P02 | `POST /api/subscriptions/trial` | User tries trial twice | 409, `{ error: { code: "PAY_001" } }` with "Trial уже использован" |
| IT-P03 | `GET /api/subscriptions/status` | Premium user | 200, returns active subscription details |
| IT-P04 | `POST /api/subscriptions/cancel` | Premium user cancels | 200, `subscriptionCancelledAt` set, tier still premium until expiry |
| IT-P05 | `POST /api/subscriptions/webhook` | Valid successful_payment | 200, tier upgraded, SubscriptionLog created |
| IT-P06 | `POST /api/subscriptions/webhook` | Duplicate `telegramPaymentChargeId` | 200 (idempotent), no double-credit |
| IT-P07 | `POST /api/subscriptions/webhook` | Invalid signature | 401 |
| IT-P08 | `POST /api/cron/subscriptions` | Processes expired subscriptions | Expired users downgraded to free |
| IT-P09 | `POST /api/cron/subscriptions` | Cron without `X-Cron-Secret` | 401 |

---

## 4. Performance Considerations

| Concern | Solution |
|---------|----------|
| Subscription status checked on every protected request | Cache in Redis with key `sub:status:{userId}`, TTL 60s. Invalidate on payment/cancel/expiry. |
| Cron queries all users every hour for expiration | Index on `users.subscription_expires_at` + `users.subscription_tier`. Query: `WHERE subscription_expires_at < NOW() AND subscription_tier != 'free'` — scans only expiring users. |
| Redis dedup for concurrent invoices | Key `invoice:pending:{userId}` with 300s TTL. ~64 bytes per key. At 10K users, negligible memory. |
| SubscriptionLog table growth | Index on `userId + createdAt`. Retention: delete logs > 180 days via monthly cron. |
| Webhook processing latency | Telegram expects <10s response. Handler does: verify signature (0ms) + DB upsert (5ms) + Redis invalidate (1ms) = well within budget. |

### Database Indexes (new)

```sql
-- Subscription expiration queries (cron)
CREATE INDEX idx_users_sub_expires ON users (subscription_expires_at)
  WHERE subscription_tier != 'free';

-- SubscriptionLog queries
CREATE INDEX idx_sub_log_user_created ON subscription_logs (user_id, created_at);
CREATE INDEX idx_sub_log_charge_id ON subscription_logs (telegram_payment_charge_id)
  WHERE telegram_payment_charge_id IS NOT NULL;
```

---

## 5. Security Hardening

### Webhook Signature Verification

```typescript
// Verify Telegram webhook update authenticity
// Telegram signs updates with HMAC-SHA256 using SHA256(bot_token) as secret key
function verifyWebhookSignature(
  body: string,
  receivedHash: string,
  botToken: string,
): boolean {
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(body)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(receivedHash, "hex"),
  );
}
```

### Security Checklist

| Rule | Implementation |
|------|---------------|
| Webhook auth | HMAC-SHA256 verification on every webhook request |
| Constant-time comparison | `crypto.timingSafeEqual` for hash comparison |
| No PII in SubscriptionLog | Store only: userId, event type, chargeId, amount, timestamp. No name/email/telegramId. |
| Cron endpoint auth | `X-Cron-Secret` header with constant-time comparison (same pattern as notifications cron) |
| Invoice dedup | Redis SETNX prevents duplicate invoice creation |
| Payment replay protection | UNIQUE constraint on `telegramPaymentChargeId` in SubscriptionLog |
| Bot token protection | `TG_BOT_TOKEN` never in client-side code, API responses, or logs |
| Rate limiting | Subscription endpoints: general rate limit (100/min). Webhook endpoint: exempt from user rate limit (Telegram server IPs). |
| Input validation | Zod schemas on all API inputs including webhook payloads (`.passthrough()` for forward compat) |
| Trial abuse prevention | `hasUsedTrial` is a persistent DB field, not session-based. Cannot be reset by clearing cookies. |

---

## 6. Monitoring

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| `pay.trial_started` | < expected conversion from quiz | Review paywall UX |
| `pay.payment_success` | < 80% of attempts | Check Telegram Stars API status |
| `pay.payment_failed` | > 20% of attempts in 1h | Alert team, check for systemic issue |
| `pay.webhook_signature_fail` | > 5 in 1h | Possible attack — alert security |
| `pay.webhook_replay` | > 0 (duplicate chargeId) | Log for audit, no action needed (idempotent) |
| `pay.cron_expired_count` | > 100 in single run | Unusual churn — alert product team |
| `pay.cron_duration` | > 30 seconds | Optimize query or batch size |
| `pay.api_error` (PAY_002) | > 3 in 10 min | Check Telegram Bot API status page |
| `pay.subscription_inconsistency` | > 0 (premium + null expiry) | Ops review — manual data fix needed |
