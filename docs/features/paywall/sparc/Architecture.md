# Architecture: Paywall & Payments (F9)

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js API                              │
│                                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Trial    │  │ Invoice   │  │ Cancel   │  │ Status        │  │
│  │ Endpoint │  │ Endpoint  │  │ Endpoint │  │ Endpoint      │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │             │                 │           │
│       ▼              ▼             ▼                 ▼           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              subscription-engine.ts                       │   │
│  │  startTrial() | createInvoice() | processPayment()       │   │
│  │  cancelSubscription() | getSubscriptionStatus()          │   │
│  │  processExpirations()                                    │   │
│  └───────┬──────────────┬───────────────────┬───────────────┘   │
│          │              │                   │                    │
│     ┌────▼────┐   ┌─────▼─────┐   ┌────────▼────────┐          │
│     │PostgreSQL│  │  Redis    │   │Telegram Bot API │          │
│     │users +   │  │  invoice  │   │/createInvoiceLink│          │
│     │sub_logs  │  │  dedup    │   └────────┬────────┘          │
│     └─────────┘  └───────────┘            │                    │
│                                            │                    │
│  ┌─────────────────────────────────────────▼──────────────────┐ │
│  │                    Webhook Endpoint                         │ │
│  │  /api/subscription/webhook                                 │ │
│  │                                                            │ │
│  │  ┌─ pre_checkout_query ──→ validate ──→ answerOK          │ │
│  │  │                                                         │ │
│  │  └─ successful_payment ──→ processPayment() ──→ upgrade   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐                                                    │
│  │ Cron     │──→ processExpirations() ──→ downgrade expired     │
│  │ Endpoint │                                                    │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘

Payment Flow (Telegram Stars):

  User                Mini App              API               Telegram
   │                    │                   │                    │
   │  tap "Subscribe"   │                   │                    │
   │──────────────────→ │                   │                    │
   │                    │  POST /invoice    │                    │
   │                    │─────────────────→ │                    │
   │                    │                   │ /createInvoiceLink │
   │                    │                   │──────────────────→ │
   │                    │                   │  ← invoice URL     │
   │                    │  ← { invoiceUrl } │                    │
   │                    │←────────────────  │                    │
   │                    │                   │                    │
   │  open invoiceUrl   │                   │                    │
   │──────────────────────────────────────────────────────────→ │
   │                    │                   │                    │
   │                    │                   │ pre_checkout_query │
   │                    │                   │←───────────────── │
   │                    │                   │ answer ok=true     │
   │                    │                   │──────────────────→ │
   │                    │                   │                    │
   │                    │                   │ successful_payment │
   │                    │                   │←───────────────── │
   │                    │                   │ processPayment()   │
   │                    │                   │                    │
   │  ← Premium active  │                   │                    │
   │←──────────────────────────────────────│                    │
```

## 2. File Structure

```
apps/api/src/
├── lib/
│   ├── engines/
│   │   └── subscription-engine.ts    # Core engine (trial, invoice, payment, cancel, status, cron)
│   └── validators/
│       └── subscription.ts           # Zod schemas for subscription API inputs
├── app/
│   ├── api/
│   │   └── subscription/
│   │       ├── trial/
│   │       │   └── route.ts          # POST — start free trial
│   │       ├── status/
│   │       │   └── route.ts          # GET — subscription status + trial info
│   │       ├── cancel/
│   │       │   └── route.ts          # POST — cancel subscription
│   │       ├── invoice/
│   │       │   └── route.ts          # POST — create Telegram Stars invoice
│   │       ├── webhook/
│   │       │   └── route.ts          # POST — Telegram payment webhook
│   │       └── cron/
│   │           └── route.ts          # POST — expire subscriptions (X-Cron-Secret)
│   ├── paywall/
│   │   └── page.tsx                  # Paywall screen (shown when free user hits limit)
│   └── profile/
│       └── subscription/
│           └── page.tsx              # Subscription management page
├── components/
│   └── paywall/
│       ├── paywall-card.tsx          # Paywall CTA card (trial + purchase options)
│       └── subscription-status-card.tsx  # Current subscription info display
```

## 3. Data Model Changes

### New model: SubscriptionLog

```prisma
model SubscriptionLog {
  id                 String   @id @default(uuid())
  userId             String   @map("user_id")
  type               String   // trial_started, payment_success, subscription_cancelled, subscription_expired, subscription_renewed
  amount             Int      @default(0)
  currency           String   @default("XTR")
  telegramPaymentId  String?  @unique @map("telegram_payment_id")
  createdAt          DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@index([createdAt])
  @@map("subscription_logs")
}
```

### Modified: User model

Add fields:
```prisma
model User {
  // ... existing fields ...

  hasUsedTrial            Boolean   @default(false) @map("has_used_trial")
  subscriptionCancelledAt DateTime? @map("subscription_cancelled_at")

  // ... existing relations ...
  subscriptionLogs SubscriptionLog[]
}
```

No changes to existing `subscriptionTier` (SubscriptionTier enum) or `subscriptionExpires` (DateTime?) fields -- they are already present and sufficient.

### Migration summary

| Change | Type | Table | Column |
|--------|------|-------|--------|
| New model | CREATE TABLE | `subscription_logs` | all columns |
| New field | ADD COLUMN | `users` | `has_used_trial` BOOLEAN DEFAULT false |
| New field | ADD COLUMN | `users` | `subscription_cancelled_at` TIMESTAMPTZ NULL |
| New index | CREATE INDEX | `subscription_logs` | `(user_id, type)` |
| New index | CREATE INDEX | `subscription_logs` | `(created_at)` |
| New unique | CREATE UNIQUE INDEX | `subscription_logs` | `(telegram_payment_id)` |

## 4. Redis Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `sub:invoice:{userId}` | 300s (5 min) | Invoice dedup -- prevents creating duplicate invoices for the same user within 5 minutes |

Minimal Redis usage: only one key pattern. Invoice dedup is the only operation that benefits from caching. Subscription status is read directly from PostgreSQL (low frequency, always fresh).

## 5. API Routes

| Route | Method | Auth | Request Body | Response | Status Codes |
|-------|--------|------|-------------|----------|--------------|
| `/api/subscription/status` | GET | JWT | -- | `{ subscription: SubscriptionStatus, trial: TrialInfo }` | 200, 401 |
| `/api/subscription/trial` | POST | JWT | -- | `{ subscription: SubscriptionStatus }` | 200, 401, 402 (already trialed) |
| `/api/subscription/invoice` | POST | JWT | -- | `{ invoice: InvoiceData }` | 200, 401, 502 (TG API down) |
| `/api/subscription/cancel` | POST | JWT | -- | `{ subscription: SubscriptionStatus }` | 200, 401, 402 (no subscription) |
| `/api/subscription/webhook` | POST | TG signature | Telegram Update JSON | `{ ok: true }` | 200, 401 (bad signature) |
| `/api/subscription/cron` | POST | X-Cron-Secret | -- | `{ expired: number }` | 200, 401 |

### Route implementation patterns

**Trial route:**
```typescript
// POST /api/subscription/trial/route.ts
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  try {
    const result = await startTrial(auth.user.userId);
    return NextResponse.json({ subscription: result });
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const { body, status } = apiError(error.code, error.details);
      return NextResponse.json(body, { status });
    }
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
```

**Webhook route:**
```typescript
// POST /api/subscription/webhook/route.ts
export async function POST(req: Request) {
  // 1. Verify Telegram webhook signature (secret_token header)
  const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse update
  const update = await req.json();

  // 3. Route to handler
  await handleWebhookUpdate(update);

  // 4. Always return 200 (Telegram expects it)
  return NextResponse.json({ ok: true });
}
```

**Cron route (matches duels/cron pattern):**
```typescript
// POST /api/subscription/cron/route.ts
export async function POST(req: Request) {
  // Authenticate via X-Cron-Secret (constant-time comparison)
  // ... same pattern as duels/cron ...
  const result = await processExpirations();
  return NextResponse.json(result);
}
```

## 6. Security

### Webhook signature verification

Telegram sends a `X-Telegram-Bot-Api-Secret-Token` header with each webhook request. The value matches the `secret_token` parameter set when configuring the webhook via `setWebhook`.

```
FUNCTION verifyWebhookSecret(headerValue):
  expected = process.env.TG_WEBHOOK_SECRET
  IF expected == NULL THEN RETURN false
  IF headerValue == NULL THEN RETURN false
  RETURN timingSafeEqual(Buffer.from(headerValue), Buffer.from(expected))
```

### No PII in logs

SubscriptionLog stores:
- `userId` (UUID, not PII)
- `type` (event type string)
- `amount` / `currency` (payment metadata)
- `telegramPaymentId` (Telegram's charge ID, not user-identifiable)

SubscriptionLog does NOT store:
- User name, email, or any personal data
- Payment method details
- Telegram user ID (only stored in User model)

### Cron endpoint protection

Same pattern as `duels/cron` and `notifications/cron`:
- Requires `X-Cron-Secret` header
- Constant-time string comparison via `crypto.timingSafeEqual`
- `CRON_SECRET` environment variable (shared across all cron endpoints)

### Invoice payload integrity

The `invoice_payload` field in Telegram invoices contains a JSON string with `userId` and `type`. This is set by our backend when creating the invoice and returned unchanged by Telegram during pre_checkout and successful_payment. Since only our backend creates invoices (via bot token), the payload is trusted. The pre_checkout handler additionally validates:
- `payload.userId` exists in database
- `payload.type` matches expected value
- `total_amount` matches expected price

### Rate limiting

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| `/api/subscription/trial` | 10 req/min (general auth rate) | One-time operation |
| `/api/subscription/invoice` | 10 req/min | Prevent invoice spam |
| `/api/subscription/cancel` | 10 req/min | One-time operation |
| `/api/subscription/webhook` | No rate limit | Telegram controls send rate |
| `/api/subscription/cron` | No rate limit | Protected by secret header |

## 7. Constants (packages/shared)

Add to `packages/shared/src/constants/index.ts`:

```typescript
// --- Subscription constants ---
export const TRIAL_DURATION_DAYS = 7;
export const SUBSCRIPTION_DURATION_DAYS = 30;
export const SUBSCRIPTION_PRICE_STARS = 250;
export const INVOICE_DEDUP_TTL_SECONDS = 300;
```

Add to `packages/shared/src/types/index.ts`:

```typescript
// --- Subscription types ---
export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  isTrialActive: boolean;
  isCancelled: boolean;
  expiresAt: string | null;
  daysRemaining: number;
}

export interface TrialInfo {
  eligible: boolean;
  durationDays: number;
  message: string;
}

export interface InvoiceData {
  invoiceUrl: string;
  amount: number;
  currency: string;
  expiresAt: string;
}

export type SubscriptionLogType =
  | "trial_started"
  | "payment_success"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_renewed";
```

## 8. Cron Schedule

| Job | Schedule | Endpoint | Types Processed |
|-----|----------|----------|-----------------|
| Subscription expiry | Every hour `30 * * * *` | `/api/subscription/cron` | Downgrade expired premium/clinical to free |

Offset by 30 minutes from existing cron jobs (duels at `0 * * * *`, notifications at `0 * * * *`) to spread load.

## 9. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `TG_BOT_TOKEN` | Yes (existing) | Telegram Bot API calls (createInvoiceLink, answerPreCheckoutQuery) |
| `TG_WEBHOOK_SECRET` | Yes (new) | Verify incoming webhook requests from Telegram |
| `CRON_SECRET` | Yes (existing) | Authenticate cron endpoint calls |

No new external service dependencies. Telegram Bot Payments API is part of the existing Telegram Bot API (same token).

## 10. Consistency with Project Architecture

- Engine in `lib/engines/subscription-engine.ts` follows `duel-engine.ts` pattern: pure functions + DB functions, custom Error class with ErrorCode
- Validators in `lib/validators/subscription.ts` follow `duels.ts` pattern: Zod schemas
- Cron route matches `duels/cron` pattern: X-Cron-Secret auth, constant-time comparison
- Error codes use existing PAY_001 (402) and PAY_002 (502) from `lib/errors.ts`
- Fire-and-forget notifications follow duel completion pattern: `.catch(err => console.error(...))`
- Prisma model follows conventions: `@@map` for table name, `@map` for column names, snake_case DB columns
- API response format matches existing pattern: `{ subscription: SubscriptionStatus }` wrapper
- Redis usage follows existing pattern: try/catch with fallthrough on Redis unavailability
- Webhook route is the only new pattern -- but follows standard Next.js API route conventions
