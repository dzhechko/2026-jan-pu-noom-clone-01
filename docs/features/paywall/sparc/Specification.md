# Specification: Paywall & Payments (F9)

## User Stories

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|-------------|-----------|:--------:|:------:|
| US-P01 | Free user (day 3-7) | начать 7-дневный бесплатный trial | попробовать все Premium-функции без оплаты | Must | 5 |
| US-P02 | пользователь после trial | оплатить подписку 250 Stars/мес через Telegram | продолжить пользоваться Premium-функциями | Must | 8 |
| US-P03 | подписчик | видеть статус подписки и дату окончания | знать, когда нужно продлить | Must | 3 |
| US-P04 | система | обработать webhook от Telegram о successful_payment | обновить подписку пользователя в БД | Must | 5 |
| US-P05 | Premium user | отменить подписку с сохранением доступа до конца периода | контролировать свои расходы | Should | 3 |
| US-P06 | Free user | увидеть привлекательную страницу paywall при попытке доступа к Premium-функции | понять ценность подписки и начать trial | Must | 5 |

**Total: 29 story points**

---

## Acceptance Criteria (Gherkin)

### US-P01: Start 7-Day Free Trial

```gherkin
Feature: Free Trial Activation

  Background:
    Given I am a registered free-tier user
    And I have never used a trial before

  Scenario: Start trial from paywall page
    Given I am on the /paywall page
    When I tap "Попробовать 7 дней бесплатно"
    Then the system calls POST /api/subscription/trial
    And I see confirmation: "Пробный период активен до {expiry_date}"
    And my subscriptionTier is set to "premium"
    And my subscriptionExpires is set to now + 7 days
    And my hasUsedTrial is set to true
    And all Premium features unlock immediately:
      | feature | status |
      | Lessons 4-14 | unlocked |
      | AI Coach | accessible |
      | Duels | enabled |
    And I am redirected to the previously blocked content

  Scenario: Trial already used
    Given I previously used my trial (hasUsedTrial = true)
    When I try to start a trial again
    Then I see error: "Пробный период уже был использован" (PAY_003)
    And I see CTA: "Оплатить подписку — 250 Stars/мес"

  Scenario: Already a premium user
    Given my subscriptionTier is "premium"
    When I visit /paywall
    Then I am redirected to /profile/subscription
    And I see my current subscription status

  Scenario: Trial expiry notification
    Given my trial expires tomorrow
    When the notification cron runs
    Then I receive a Telegram message:
      | text | "Ваш пробный период заканчивается завтра! Оплатите подписку, чтобы сохранить доступ к Premium." |
      | button | "Оплатить 250 Stars" |
      | link | /paywall |
```

### US-P02: Pay for Subscription via Telegram Stars

```gherkin
Feature: Telegram Stars Payment

  Background:
    Given I am a registered user with telegramId
    And my trial has expired OR I want to subscribe directly

  Scenario: Create invoice and pay
    Given I am on the /paywall page (or /profile/subscription)
    When I tap "Оплатить 250 Stars"
    Then the system calls POST /api/subscription/invoice
    And the server sends a Telegram Stars invoice via Bot API:
      | title | "Весна Premium" |
      | description | "Подписка на 30 дней: AI-коуч, 14 уроков, дуэли" |
      | amount | 250 |
      | currency | "XTR" |
    And Telegram shows the native payment dialog to me
    When I confirm the payment in Telegram
    Then Telegram sends pre_checkout_query to the bot
    And the server responds with OK
    And Telegram sends successful_payment to the webhook
    And my subscriptionTier is set to "premium"
    And my subscriptionExpires is extended by 30 days from now (or from current expiry if still active)
    And I see confirmation: "Подписка оформлена до {new_expiry_date}"

  Scenario: Payment while trial is still active
    Given my trial expires in 3 days
    When I pay 250 Stars
    Then my subscriptionExpires is extended by 30 days from current expiry (not from now)
    And trial days are not lost

  Scenario: Renewal payment (already premium)
    Given I am a premium user expiring in 5 days
    When I pay 250 Stars
    Then my subscriptionExpires is extended by 30 days from current expiry
    And I see "Подписка продлена до {new_date}"

  Scenario: User has no Telegram ID
    Given I registered via email only (no telegramId)
    When I try to pay via Telegram Stars
    Then I see error: "Для оплаты Stars откройте приложение через Telegram"

  Scenario: Payment amount validation
    Given someone sends a forged payment with amount != 250
    When the webhook receives successful_payment
    Then the server rejects the payment (amount mismatch)
    And logs a security warning
    And the subscription is NOT updated
```

### US-P03: View Subscription Status

```gherkin
Feature: Subscription Status

  Scenario: Free user views status
    Given I am a free-tier user who never had a trial
    When I call GET /api/subscription/status
    Then I receive:
      | field | value |
      | tier | "free" |
      | status | "free" |
      | canStartTrial | true |
      | expiresAt | null |
      | cancelledAt | null |

  Scenario: Trial user views status
    Given I am in an active trial (3 days remaining)
    When I call GET /api/subscription/status
    Then I receive:
      | field | value |
      | tier | "premium" |
      | status | "trial" |
      | canStartTrial | false |
      | expiresAt | "{trial_expiry_date}" |
      | trialEndsAt | "{trial_expiry_date}" |
      | daysRemaining | 3 |

  Scenario: Paying premium user views status
    Given I am a paying premium subscriber (15 days remaining)
    When I call GET /api/subscription/status
    Then I receive:
      | field | value |
      | tier | "premium" |
      | status | "active" |
      | canStartTrial | false |
      | expiresAt | "{subscription_expiry_date}" |
      | daysRemaining | 15 |
      | cancelledAt | null |

  Scenario: Cancelled user views status
    Given I cancelled my subscription (10 days access remaining)
    When I call GET /api/subscription/status
    Then I receive:
      | field | value |
      | tier | "premium" |
      | status | "cancelled" |
      | expiresAt | "{expiry_date}" |
      | daysRemaining | 10 |
      | cancelledAt | "{cancellation_date}" |

  Scenario: Expired user views status
    Given my subscription expired yesterday
    When I call GET /api/subscription/status
    Then I receive:
      | field | value |
      | tier | "free" |
      | status | "expired" |
      | canStartTrial | false |
      | expiresAt | null |
      | lastExpiredAt | "{last_expiry_date}" |
```

### US-P04: Handle Payment Webhook

```gherkin
Feature: Telegram Payment Webhook

  Scenario: Successful payment processed
    Given a user with telegramId "123456" paid 250 Stars
    When Telegram sends successful_payment to POST /api/subscription/webhook:
      | field | value |
      | telegram_payment_charge_id | "charge_abc123" |
      | provider_payment_charge_id | "provider_xyz789" |
      | total_amount | 250 |
      | currency | "XTR" |
    Then the server creates a SubscriptionLog record:
      | field | value |
      | userId | "{user_id}" |
      | event | "payment_success" |
      | telegramPaymentChargeId | "charge_abc123" |
      | amount | 250 |
      | currency | "XTR" |
    And the User record is updated:
      | field | value |
      | subscriptionTier | "premium" |
      | subscriptionExpires | now + 30 days |
    And the server returns 200 OK

  Scenario: Duplicate webhook (idempotency)
    Given a payment with telegramPaymentChargeId "charge_abc123" was already processed
    When Telegram sends the same successful_payment again
    Then the server returns 200 OK (not an error)
    And no duplicate SubscriptionLog record is created
    And the subscription is NOT extended again

  Scenario: Invalid amount
    Given someone sends a webhook with total_amount = 100 (not 250)
    When the webhook is processed
    Then the server rejects the payment
    And logs error: "Invalid payment amount: expected 250, got 100"
    And the subscription is NOT updated

  Scenario: Unknown telegram user
    Given a webhook arrives for telegramId "999999" not in our database
    When the webhook is processed
    Then the server logs a warning
    And returns 200 OK (Telegram expects 200 to stop retries)

  Scenario: Pre-checkout query validation
    Given Telegram sends a pre_checkout_query for 250 XTR
    When the server validates the request
    Then the server responds with answerPreCheckoutQuery(ok: true)
    And the payment proceeds
```

### US-P05: Cancel Subscription

```gherkin
Feature: Subscription Cancellation

  Background:
    Given I am a premium user with an active subscription

  Scenario: Cancel at period end
    When I call POST /api/subscription/cancel
    Then I see what I will lose:
      | feature | description |
      | AI-коуч | Персональные CBT-рекомендации |
      | Уроки 4-14 | 11 продвинутых CBT-уроков |
      | Дуэли | Соревнования с друзьями |
    And my cancelledAt is set to now
    And my subscriptionTier remains "premium" until expiry
    And I see: "Подписка отменена. Доступ сохранится до {expiry_date}"

  Scenario: Access during cancellation period
    Given I cancelled but my subscription has not expired yet
    When I access AI Coach
    Then I can still use it (access until expiry)
    When my subscriptionExpires passes
    Then my subscriptionTier is set to "free" by the cron job
    And premium features are locked

  Scenario: Re-subscribe after cancellation
    Given I cancelled but my subscription has not expired (5 days left)
    When I pay 250 Stars again
    Then my cancelledAt is cleared (set to null)
    And my subscriptionExpires is extended by 30 days from current expiry
    And I see: "Подписка возобновлена до {new_date}"

  Scenario: Cannot cancel free tier
    Given I am a free-tier user
    When I call POST /api/subscription/cancel
    Then I receive error 400: "Нет активной подписки для отмены"

  Scenario: Cannot cancel trial
    Given I am in a trial period
    When I call POST /api/subscription/cancel
    Then I receive error 400: "Невозможно отменить пробный период. Он завершится автоматически."
```

### US-P06: Paywall Page

```gherkin
Feature: Paywall Page

  Background:
    Given I am a free-tier user

  Scenario: View paywall from lesson gate
    Given I tried to access lesson 4 and received LESSON_001
    When I am redirected to /paywall?source=lesson&blocked=4
    Then I see the paywall page with:
      | element | content |
      | hero_title | "Продолжите свой путь к здоровью" |
      | hero_subtitle | "Разблокируйте все возможности Весны" |
      | feature_comparison | table comparing Free vs Premium |
      | trial_cta | "Попробовать 7 дней бесплатно" |
      | price_info | "Затем 250 Stars/мес (~499 руб)" |
      | secondary_cta | "Не сейчас" → closes/goes back |
    And the feature comparison table shows:
      | feature | free | premium |
      | CBT-уроки | 3 урока | Все 14 уроков |
      | AI-коуч | — | Безлимитный доступ |
      | Дуэли с друзьями | — | Доступно |
      | Трекер питания | Доступно | Доступно |
      | Геймификация | Базовая | Полная |

  Scenario: View paywall from coach gate
    Given I tried to access /coach and was blocked (free tier)
    When I am redirected to /paywall?source=coach
    Then the paywall emphasizes AI Coach benefits
    And the hero text says: "Ваш персональный AI-коуч ждёт"

  Scenario: View paywall from duel gate
    Given I tried to create a duel and received DUEL_001
    When I am redirected to /paywall?source=duel
    Then the paywall emphasizes Duel feature
    And the hero text says: "Соревнуйтесь с друзьями"

  Scenario: Trial already used — show payment CTA
    Given I already used my trial (hasUsedTrial = true)
    When I view the paywall
    Then the primary CTA says "Оплатить 250 Stars/мес" (not trial)
    And the trial offer is hidden

  Scenario: Telegram Stars explainer
    Given I am on the paywall page
    When I tap "Что такое Stars?"
    Then I see a tooltip/modal explaining:
      "Telegram Stars — цифровая валюта Telegram.
       Купить Stars можно прямо в Telegram.
       250 Stars ≈ 499 руб."
```

---

## API Contracts

### 1. POST /api/subscription/trial

Start a 7-day free trial. Requires that the user has never used a trial before.

**Auth:** Bearer JWT

**Request Body:** _(empty)_

**Response 200:**
```json
{
  "subscription": {
    "tier": "premium",
    "status": "trial",
    "expiresAt": "2026-02-18T12:00:00.000Z",
    "trialEndsAt": "2026-02-18T12:00:00.000Z",
    "daysRemaining": 7
  }
}
```

**Response 400 (trial already used):**
```json
{
  "error": {
    "code": "PAY_003",
    "message": "Пробный период уже был использован"
  }
}
```

**Response 400 (already premium):**
```json
{
  "error": {
    "code": "PAY_004",
    "message": "У вас уже есть активная подписка"
  }
}
```

**Zod Schema:**
```typescript
// No body needed — user identity from JWT
// Server-side validation:
// - user.hasUsedTrial must be null
// - user.subscriptionTier must be "free"
```

**Side Effects:**
- User.subscriptionTier = "premium"
- User.subscriptionExpires = now + 7 days
- User.hasUsedTrial = true

---

### 2. GET /api/subscription/status

Get current subscription status for the authenticated user.

**Auth:** Bearer JWT

**Response 200 (free user, trial available):**
```json
{
  "subscription": {
    "tier": "free",
    "status": "free",
    "canStartTrial": true,
    "expiresAt": null,
    "trialEndsAt": null,
    "cancelledAt": null,
    "daysRemaining": 0,
    "features": {
      "maxLessons": 3,
      "hasCoach": false,
      "hasDuels": false
    }
  }
}
```

**Response 200 (active trial):**
```json
{
  "subscription": {
    "tier": "premium",
    "status": "trial",
    "canStartTrial": false,
    "expiresAt": "2026-02-18T12:00:00.000Z",
    "trialEndsAt": "2026-02-18T12:00:00.000Z",
    "cancelledAt": null,
    "daysRemaining": 5,
    "features": {
      "maxLessons": 14,
      "hasCoach": true,
      "hasDuels": true
    }
  }
}
```

**Response 200 (paying premium):**
```json
{
  "subscription": {
    "tier": "premium",
    "status": "active",
    "canStartTrial": false,
    "expiresAt": "2026-03-15T12:00:00.000Z",
    "trialEndsAt": "2026-02-18T12:00:00.000Z",
    "cancelledAt": null,
    "daysRemaining": 22,
    "features": {
      "maxLessons": 14,
      "hasCoach": true,
      "hasDuels": true
    }
  }
}
```

**Response 200 (cancelled, still active):**
```json
{
  "subscription": {
    "tier": "premium",
    "status": "cancelled",
    "canStartTrial": false,
    "expiresAt": "2026-03-15T12:00:00.000Z",
    "trialEndsAt": "2026-02-18T12:00:00.000Z",
    "cancelledAt": "2026-03-01T10:00:00.000Z",
    "daysRemaining": 14,
    "features": {
      "maxLessons": 14,
      "hasCoach": true,
      "hasDuels": true
    }
  }
}
```

**Status Logic:**
```
IF tier == "free" AND hasUsedTrial == false        → status = "free"
IF tier == "free" AND hasUsedTrial == true         → status = "expired"
IF tier == "premium" AND hasUsedTrial == true
   AND no SubscriptionLog with event="payment_success" → status = "trial"
IF tier == "premium" AND subscriptionCancelledAt != null → status = "cancelled"
IF tier == "premium" AND subscriptionCancelledAt == null → status = "active"
```

---

### 3. POST /api/subscription/cancel

Cancel subscription at period end. User keeps access until subscriptionExpires.

**Auth:** Bearer JWT

**Request Body:** _(empty)_

**Response 200:**
```json
{
  "subscription": {
    "tier": "premium",
    "status": "cancelled",
    "expiresAt": "2026-03-15T12:00:00.000Z",
    "cancelledAt": "2026-03-01T10:00:00.000Z",
    "daysRemaining": 14,
    "lostFeatures": [
      { "name": "AI-коуч", "description": "Персональные CBT-рекомендации" },
      { "name": "Уроки 4-14", "description": "11 продвинутых CBT-уроков" },
      { "name": "Дуэли", "description": "Соревнования с друзьями" }
    ]
  }
}
```

**Response 400 (no active subscription):**
```json
{
  "error": {
    "code": "PAY_005",
    "message": "Нет активной подписки для отмены"
  }
}
```

**Response 400 (trial period):**
```json
{
  "error": {
    "code": "PAY_006",
    "message": "Невозможно отменить пробный период. Он завершится автоматически."
  }
}
```

**Side Effects:**
- User.subscriptionCancelledAt = now
- User.subscriptionTier remains "premium" (until expiry cron runs)

---

### 4. POST /api/subscription/invoice

Create a Telegram Stars invoice and send it to the user via the Bot API.

**Auth:** Bearer JWT

**Request Body:** _(empty)_

**Response 200:**
```json
{
  "invoice": {
    "invoiceLink": "https://t.me/$invoicelink",
    "amount": 250,
    "currency": "XTR",
    "description": "Весна Premium — 30 дней"
  }
}
```

**Response 400 (no telegramId):**
```json
{
  "error": {
    "code": "PAY_001",
    "message": "Для оплаты Stars откройте приложение через Telegram"
  }
}
```

**Response 502 (Telegram API error):**
```json
{
  "error": {
    "code": "PAY_002",
    "message": "Сервис оплаты временно недоступен"
  }
}
```

**Server-Side Logic:**
```
1. Verify user has telegramId
2. Call Telegram Bot API: createInvoiceLink({
     title: "Весна Premium",
     description: "Подписка на 30 дней: AI-коуч, 14 уроков, дуэли",
     payload: JSON.stringify({ userId, timestamp }),
     currency: "XTR",
     prices: [{ label: "Premium подписка", amount: 250 }]
   })
3. Return the invoice link to the frontend
4. Frontend opens the link via window.open() or Telegram WebApp.openInvoice()
```

---

### 5. POST /api/subscription/webhook

Handle Telegram payment events (pre_checkout_query and successful_payment). Called by Telegram Bot API, authenticated by bot token verification.

**Auth:** Telegram bot webhook signature verification (not JWT)

**Request Body (successful_payment via Update object):**
```json
{
  "update_id": 123456789,
  "message": {
    "from": {
      "id": 123456,
      "first_name": "Мария"
    },
    "successful_payment": {
      "currency": "XTR",
      "total_amount": 250,
      "invoice_payload": "{\"userId\":\"uuid-here\",\"timestamp\":1234567890}",
      "telegram_payment_charge_id": "charge_abc123",
      "provider_payment_charge_id": "provider_xyz789"
    }
  }
}
```

**Request Body (pre_checkout_query via Update object):**
```json
{
  "update_id": 123456790,
  "pre_checkout_query": {
    "id": "query_123",
    "from": {
      "id": 123456,
      "first_name": "Мария"
    },
    "currency": "XTR",
    "total_amount": 250,
    "invoice_payload": "{\"userId\":\"uuid-here\",\"timestamp\":1234567890}"
  }
}
```

**Response:** Always 200 OK (Telegram expects this)

**Server-Side Logic:**
```
IF update.pre_checkout_query:
  1. Validate amount == 250 AND currency == "XTR"
  2. Validate payload.userId exists in DB
  3. Call answerPreCheckoutQuery(ok: true) or (ok: false, error_message)

IF update.message.successful_payment:
  1. Extract telegramChargeId from successful_payment
  2. Validate amount == 250 AND currency == "XTR"
  3. Check idempotency: if SubscriptionLog with this telegramPaymentChargeId exists, return 200
  4. Parse invoice_payload to get userId
  5. Calculate new expiry:
     - If user.subscriptionExpires > now: newExpiry = subscriptionExpires + 30 days
     - Else: newExpiry = now + 30 days
  6. Create SubscriptionLog record (event: "payment_success")
  7. Update User: subscriptionTier = premium,
     subscriptionExpires = newExpiry, subscriptionCancelledAt = null
  8. Return 200 OK
```

---

### 6. POST /api/subscription/cron

Expire trials and subscriptions. Called by external cron scheduler with CRON_SECRET.

**Auth:** `X-Cron-Secret` header

**Response 200:**
```json
{
  "processed": {
    "trialsExpired": 3,
    "subscriptionsExpired": 1,
    "trialWarningsSent": 5
  }
}
```

**Server-Side Logic:**
```
1. Find users WHERE subscriptionTier = "premium"
   AND subscriptionExpires < now
   → Set subscriptionTier = "free"
   → Log subscription expiry

2. Find users WHERE subscriptionTier = "premium"
   AND subscriptionExpires BETWEEN now AND now + 24h
   AND hasUsedTrial = true AND no SubscriptionLog with event="payment_success" (i.e., still on trial)
   → Send trial expiry notification via notification engine

3. Return counts
```

---

## Data Model Changes

### New Fields on User Model

```prisma
model User {
  // ... existing fields ...
  hasUsedTrial           Boolean   @default(false) @map("has_used_trial")
  subscriptionCancelledAt DateTime? @map("subscription_cancelled_at")
  // subscriptionTier and subscriptionExpires already exist
  // ... existing relations ...
  subscriptionLogs       SubscriptionLog[]
}
```

Note: Uses `hasUsedTrial` (boolean) rather than `hasUsedTrial` (DateTime) because:
- Only need to know IF trial was used, not WHEN (the trial end date = subscriptionExpires)
- Simpler check: `hasUsedTrial == true` vs `hasUsedTrial != null`
- The `trialEndsAt` in API responses is derived from `subscriptionExpires` when in trial status

### New Model: SubscriptionLog (Event Log + Payment History)

```prisma
model SubscriptionLog {
  id                       String    @id @default(uuid())
  userId                   String    @map("user_id")
  event                    String    // trial_started, payment_success, payment_failed, subscription_cancelled, subscription_expired, subscription_renewed
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

Note: Uses a single `SubscriptionLog` model (event sourcing) rather than a separate `Subscription` model because:
- Captures both payment events AND lifecycle events (trial, cancel, expire, renew) in one table
- Unique constraint on `telegramPaymentChargeId` provides replay protection
- Simpler queries: count `event = "payment_success"` to distinguish trial from paid users

---

## Error Codes

| Code | HTTP | Trigger | User Message (RU) | System Action |
|------|:----:|---------|-------------------|---------------|
| PAY_001 | 400 | No telegramId for Stars payment | "Для оплаты Stars откройте приложение через Telegram" | Log, suggest TG |
| PAY_002 | 502 | Telegram Bot API unavailable | "Сервис оплаты временно недоступен" | Log, retry later |
| PAY_003 | 400 | Trial already used | "Пробный период уже был использован" | Show payment CTA |
| PAY_004 | 400 | Already premium (trying to start trial) | "У вас уже есть активная подписка" | Redirect to status |
| PAY_005 | 400 | Cancel with no active subscription | "Нет активной подписки для отмены" | — |
| PAY_006 | 400 | Cancel during trial | "Невозможно отменить пробный период. Он завершится автоматически." | — |

Note: Existing PAY_001 and PAY_002 in the error matrix will be remapped. The new codes replace the old RevenueCat-oriented ones.

---

## State Machine

```
Subscription Flow States:
  [free] → [trial] → [active] → [cancelled] → [expired] → [free]
                   ↘ [expired] → [free]
  [free] → [active]  (direct payment, no trial)
  [cancelled] → [active]  (re-subscribe before expiry)
  [expired/free] → [active]  (re-subscribe after expiry)

Transitions:
  free → trial:       POST /api/subscription/trial (hasUsedTrial = now)
  trial → active:     Webhook successful_payment (during trial)
  trial → expired:    Cron job (subscriptionExpires < now, no payment)
  active → cancelled: POST /api/subscription/cancel (cancelledAt = now)
  cancelled → active: Webhook successful_payment (cancelledAt = null)
  cancelled → expired: Cron job (subscriptionExpires < now)
  expired → free:     Cron job (subscriptionTier = free)
  free → active:      Webhook successful_payment (direct, trial already used)
  expired → active:   Webhook successful_payment (re-subscribe)
```

---

## Constants

```typescript
// packages/shared/src/constants/index.ts additions

export const SUBSCRIPTION_PRICE_STARS = 250;
export const SUBSCRIPTION_CURRENCY = "XTR"; // Telegram Stars
export const SUBSCRIPTION_PRICE_RUB_APPROX = 499;
export const TRIAL_DURATION_DAYS = 7;
export const SUBSCRIPTION_PERIOD_DAYS = 30;
export const TRIAL_EXPIRY_WARNING_HOURS = 24; // notify 24h before trial ends

export const SUBSCRIPTION_FEATURES_LOST = [
  { name: "AI-коуч", description: "Персональные CBT-рекомендации" },
  { name: "Уроки 4-14", description: "11 продвинутых CBT-уроков" },
  { name: "Дуэли", description: "Соревнования с друзьями" },
] as const;
```

---

## Non-Functional Requirements

### Performance Budget

| Operation | P50 | P99 | Max |
|-----------|:---:|:---:|:---:|
| Trial activation | 100ms | 300ms | 500ms |
| Subscription status | 50ms | 150ms | 300ms |
| Invoice creation | 200ms | 800ms | 2s |
| Webhook processing | 100ms | 300ms | 500ms |
| Cancel subscription | 80ms | 200ms | 400ms |
| Cron job (per 1000 users) | 2s | 5s | 10s |

### Security

| Requirement | Implementation |
|-------------|---------------|
| Webhook authentication | Verify request comes from Telegram (bot token in URL path or signature check) |
| Idempotent payments | Unique constraint on `telegramPaymentChargeId` in SubscriptionLog prevents double-processing |
| Amount validation | Server-side check: `total_amount === 250 AND currency === "XTR"` |
| Trial abuse prevention | `hasUsedTrial` boolean per user — one trial per account ever |
| Payload integrity | Invoice payload includes userId + timestamp, verified on webhook |
| No client-side subscription state | Server is single source of truth — client always fetches from API |

### Caching

| Data | Cache Layer | TTL | Invalidation |
|------|-------------|:---:|--------------|
| Subscription status | Redis | 60s | On tier change, payment, cancellation |
| Invoice link | None (generated fresh) | — | — |
| Webhook dedup | Redis | 24h | Auto-expire |

---

## Integration with Existing Features

### Feature Gate Redirects

When existing paywall triggers fire, they should redirect to `/paywall` with context:

| Trigger | Current Behavior | New Behavior |
|---------|-----------------|--------------|
| LESSON_001 (lesson 4+) | Return 403 JSON | Frontend redirects to `/paywall?source=lesson&blocked={id}` |
| DUEL_001 (create duel) | Return 403 JSON | Frontend redirects to `/paywall?source=duel` |
| Coach tier check | Return 403 JSON | Frontend redirects to `/paywall?source=coach` |

### Notification Integration

Add new notification types to the existing notification engine (F8):

| Type | Trigger | Template |
|------|---------|----------|
| `trial_expiring` | Cron: trial expires in 24h | "Пробный период заканчивается завтра! Оплатите подписку." [Оплатить] |
| `subscription_expired` | Cron: subscription just expired | "Подписка истекла. Вернитесь в Premium!" [Продлить] |
| `payment_success` | Webhook: successful_payment | "Подписка оформлена до {date}!" |

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/lib/engines/subscription-engine.ts` | Business logic: trial, cancel, expiry, status |
| `apps/api/src/lib/engines/subscription-engine.test.ts` | Unit tests for subscription engine |
| `apps/api/src/lib/telegram-payments.ts` | Telegram Bot Payments API client (createInvoiceLink, answerPreCheckoutQuery) |
| `apps/api/src/lib/validators/subscription.ts` | Zod schemas for webhook payload validation |
| `apps/api/src/app/api/subscription/trial/route.ts` | POST /api/subscription/trial |
| `apps/api/src/app/api/subscription/status/route.ts` | GET /api/subscription/status |
| `apps/api/src/app/api/subscription/cancel/route.ts` | POST /api/subscription/cancel |
| `apps/api/src/app/api/subscription/invoice/route.ts` | POST /api/subscription/invoice |
| `apps/api/src/app/api/subscription/webhook/route.ts` | POST /api/subscription/webhook |
| `apps/api/src/app/api/subscription/cron/route.ts` | POST /api/subscription/cron |
| `apps/api/src/app/paywall/page.tsx` | Paywall UI page |
| `apps/api/src/app/profile/subscription/page.tsx` | Subscription management page |
| `apps/api/src/components/paywall/feature-comparison.tsx` | Feature comparison table component |
| `apps/api/src/components/paywall/trial-cta.tsx` | Trial/payment CTA button component |
| `prisma/migrations/XXXX_add_subscription/migration.sql` | DB migration |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add SubscriptionLog model, hasUsedTrial + subscriptionCancelledAt to User |
| `packages/shared/src/types/index.ts` | Add SubscriptionStatus, SubscriptionInfo types |
| `packages/shared/src/constants/index.ts` | Add subscription constants |
| `apps/api/src/lib/errors.ts` | Remap PAY_001/PAY_002, add PAY_003 through PAY_006 error codes |
| `apps/api/src/app/lessons/[id]/page.tsx` | Redirect to /paywall on LESSON_001 instead of just showing error |
| `apps/api/src/app/duels/page.tsx` | Redirect to /paywall on free tier check |
| `apps/api/src/app/coach/page.tsx` | Redirect to /paywall on free tier check |
| `apps/api/src/app/profile/page.tsx` | Add "Управление подпиской" link |
