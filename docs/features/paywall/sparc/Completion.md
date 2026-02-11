# Completion: Paywall & Payments (F9)

## 1. Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `TG_BOT_TOKEN` | Yes | — | Telegram Bot API token for invoice creation and webhook verification (already exists) |
| `TELEGRAM_PAYMENT_TOKEN` | No | `""` | Provider token for Telegram Payments. For Telegram Stars, this is an empty string `""`. Required only if using a third-party payment provider (e.g., YooKassa). |
| `CRON_SECRET` | Yes | — | Shared secret for cron endpoint auth via `X-Cron-Secret` header (already exists, same as notifications) |

### Notes
- `TG_BOT_TOKEN` is already used for Telegram auth and notifications. No new token needed.
- `CRON_SECRET` is shared across all cron endpoints (notifications, duels, subscriptions). Single secret simplifies ops.
- `TELEGRAM_PAYMENT_TOKEN` can be omitted or set to empty string for Telegram Stars (Stars is a native payment method, no provider token required).

---

## 2. Database Migration

### 2.1 Prisma Schema Changes

```prisma
// Add to User model:
model User {
  // ... existing fields ...
  hasUsedTrial           Boolean   @default(false) @map("has_used_trial")
  subscriptionCancelledAt DateTime? @map("subscription_cancelled_at")
  // ... existing relations ...
  subscriptionLogs       SubscriptionLog[]
}

// New model:
model SubscriptionLog {
  id                       String    @id @default(uuid())
  userId                   String    @map("user_id")
  event                    String    // trial_started, payment_success, payment_failed, subscription_expired, subscription_cancelled, subscription_reactivated
  amount                   Int?      // Telegram Stars amount (null for non-payment events)
  currency                 String?   @default("XTR") // XTR = Telegram Stars
  telegramPaymentChargeId  String?   @unique @map("telegram_payment_charge_id")
  providerPaymentChargeId  String?   @map("provider_payment_charge_id")
  metadata                 Json      @default("{}")
  createdAt                DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([event, createdAt])
  @@map("subscription_logs")
}
```

### 2.2 Migration Command

```bash
npx prisma migrate dev --name add-subscription-logs-and-trial-fields
```

This creates:
- `subscription_logs` table with indexes
- `has_used_trial` column on `users` (default `false`)
- `subscription_cancelled_at` column on `users` (nullable)
- Unique index on `telegram_payment_charge_id` (replay protection)

### 2.3 Data Migration (existing users)

No data migration needed. Existing users:
- `hasUsedTrial = false` by default (correct for users who haven't tried trial)
- `subscriptionCancelledAt = null` by default (correct)
- Premium users who already have `subscriptionTier = premium` keep their status

---

## 3. Cron Setup

### Subscription Expiration Check (hourly)

Same pattern as notifications cron. Runs every hour to:
1. Find users where `subscriptionExpires < NOW()` and `subscriptionTier != free`
2. Check for active duels (grace period if duel is ongoing)
3. Downgrade to `free` tier
4. Log `subscription_expired` event to SubscriptionLog
5. Invalidate Redis cache for affected users
6. Send notification via notification engine (optional, uses existing `sendNotification`)

### Option A: VPS crontab (recommended, same as notifications)
```cron
# Subscription expiration check — every hour at :30 (offset from notifications at :00)
30 * * * * curl -s -X POST https://app.vesna.ru/api/cron/subscriptions -H "X-Cron-Secret: $CRON_SECRET"
```

### Option B: GitHub Actions scheduled workflow
```yaml
on:
  schedule:
    - cron: '30 * * * *'  # Every hour at :30
jobs:
  expire-subscriptions:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -f -X POST ${{ secrets.APP_URL }}/api/cron/subscriptions \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

### Cron Route Pattern

```
POST /api/cron/subscriptions
  Headers: { X-Cron-Secret: string }
  Response: { expired: number, skipped: number, errors: number }
```

Auth: constant-time comparison of `X-Cron-Secret` header (same implementation as notifications cron).

---

## 4. Deployment Checklist

### Pre-deploy
- [ ] `TG_BOT_TOKEN` verified for payment API access (call `getMe` to confirm bot is active)
- [ ] `TELEGRAM_PAYMENT_TOKEN` set in `.env` (empty string `""` for Telegram Stars)
- [ ] `CRON_SECRET` already set (shared with notifications)
- [ ] Telegram bot has "Payments" enabled in BotFather settings
- [ ] `SUBSCRIPTION_PRICE_STARS` constant reviewed (250 Stars/month)

### Deploy
- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Verify migration: check `subscription_logs` table exists, `has_used_trial` column on `users`
- [ ] Deploy new API code
- [ ] Health check passes: `GET /api/health`

### Post-deploy
- [ ] Set up cron job for `/api/cron/subscriptions` (hourly at :30)
- [ ] Set Telegram webhook URL (if not already set for notifications): `POST /api/subscriptions/webhook`
- [ ] Test trial flow end-to-end with test user:
  1. Free user opens paywall
  2. Taps "7 days free"
  3. Verify `hasUsedTrial = true` in DB
  4. Verify `subscriptionTier = premium` and `subscriptionExpires = now + 7d`
- [ ] Test payment flow with Telegram Stars (use test mode if available)
- [ ] Verify webhook receives `successful_payment` after Stars payment
- [ ] Check SubscriptionLog has entries
- [ ] Monitor first cron run for errors
- [ ] Verify Redis cache invalidation works (check subscription status before/after payment)

### Verification Queries
```sql
-- Check migration applied
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('has_used_trial', 'subscription_cancelled_at');

-- Check subscription_logs table
SELECT count(*) FROM subscription_logs;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'subscription_logs';
```

---

## 5. Rollback Plan

| Step | Action | Impact |
|------|--------|--------|
| 1 | Disable subscription cron job | No new expirations processed. Users keep current tier until manual fix. |
| 2 | Remove webhook route (or return 200 OK no-op) | Payments stop processing. Users who pay see no change. Manual reconciliation needed. |
| 3 | Revert API code to previous version | Trial/cancel endpoints gone. Existing premium users unaffected. |
| 4 | Rollback migration (if needed) | `npx prisma migrate resolve --rolled-back add-subscription-logs-and-trial-fields` |
| 5 | Manual data cleanup (if any users affected) | Set affected users back to their pre-deploy state based on SubscriptionLog. |

### Rollback Safety Notes
- **Subscriptions are additive**: rolling back code does not revoke premium access. Users keep their `subscriptionTier` and `subscriptionExpires` values.
- **Cron is the only downgrading mechanism**: disabling cron means no one gets downgraded. This is safe for a short rollback window.
- **Webhook is idempotent**: re-processing the same webhook after rollback+redeploy is safe due to `telegramPaymentChargeId` UNIQUE constraint.
- **SubscriptionLog is append-only**: no data loss from rollback. Logs persist even if feature is disabled.

---

## 6. Implementation Order

| Step | Files | Depends On | Parallel? |
|------|-------|------------|:---------:|
| 1 | `packages/shared/src/types/index.ts` — Add subscription types (`SubscriptionStatus`, `SubscriptionEvent`, `SubscriptionLogEntry`) | — | Yes |
| 2 | `packages/shared/src/constants/index.ts` — Add `SUBSCRIPTION_PRICE_STARS`, `TRIAL_DURATION_DAYS`, `SUBSCRIPTION_DURATION_DAYS`, `SUBSCRIPTION_CACHE_TTL_SECONDS` | — | Yes (parallel with 1) |
| 3 | `apps/api/prisma/schema.prisma` — Add `SubscriptionLog` model, `hasUsedTrial` + `subscriptionCancelledAt` to User | — | Yes (parallel with 1, 2) |
| 4 | `apps/api/src/lib/validators/subscription.ts` — Zod schemas for trial, cancel, webhook, cron | — | Yes (parallel with 1-3) |
| 5 | `apps/api/src/lib/errors.ts` — Add `PAY_003` error code | — | Yes (parallel with 1-4) |
| 6 | Run migration: `npx prisma migrate dev --name add-subscription-logs-and-trial-fields` | 3 | No (sequential after 3) |
| 7 | `apps/api/src/lib/engines/subscription-engine.ts` — Core business logic: `startTrial`, `processPayment`, `cancelSubscription`, `getSubscriptionStatus`, `processExpirations`, `verifyWebhookSignature`, `buildInvoicePayload` | 1, 2, 5, 6 | No |
| 8 | `apps/api/src/lib/engines/subscription-engine.test.ts` — Unit tests (18+ tests from Refinement.md section 3.1) | 7 | No |
| 9 | `apps/api/src/app/api/subscriptions/trial/route.ts` — `POST /api/subscriptions/trial` | 4, 7 | Yes |
| 10 | `apps/api/src/app/api/subscriptions/status/route.ts` — `GET /api/subscriptions/status` | 4, 7 | Yes (parallel with 9) |
| 11 | `apps/api/src/app/api/subscriptions/cancel/route.ts` — `POST /api/subscriptions/cancel` | 4, 7 | Yes (parallel with 9, 10) |
| 12 | `apps/api/src/app/api/subscriptions/webhook/route.ts` — `POST /api/subscriptions/webhook` (Telegram webhook handler for `pre_checkout_query` and `successful_payment`) | 4, 7 | Yes (parallel with 9-11) |
| 13 | `apps/api/src/app/api/cron/subscriptions/route.ts` — `POST /api/cron/subscriptions` (hourly expiration check) | 7 | Yes (parallel with 9-12) |
| 14 | `apps/api/src/lib/validators/subscription.test.ts` — Validator tests (8 tests) | 4 | Yes (parallel with 7+) |
| 15 | Frontend: paywall page (`apps/api/src/app/paywall/page.tsx`), subscription status component, trial CTA component | 9, 10, 11 | No (after API routes) |

### Dependency Graph

```
Step 1 (types) ──────────┐
Step 2 (constants) ───────┤
Step 3 (schema) ──→ Step 6 (migration) ──┐
Step 4 (validators) ─────┤                │
Step 5 (error code) ─────┘                │
                                          ▼
                                   Step 7 (engine)
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                    Step 8 (tests)  Step 9-13 (routes)  Step 14 (validator tests)
                                          │
                                          ▼
                                   Step 15 (frontend)
```

### Estimated Effort

| Step | Effort | Notes |
|------|--------|-------|
| 1-5 | 1h | Boilerplate: types, constants, schema, validators, error code |
| 6 | 5min | Run migration |
| 7 | 3h | Core engine — most complex piece (trial logic, payment processing, expiry) |
| 8 | 2h | 18+ unit tests |
| 9-13 | 2h | API routes (follow existing patterns from auth/lessons/notifications) |
| 14 | 30min | Validator tests |
| 15 | 2h | Frontend paywall page + components |
| **Total** | **~10h** | |
