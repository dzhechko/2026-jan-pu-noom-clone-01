# Pseudocode: Paywall & Payments (F9)

## 1. Data Structures

```typescript
// Subscription status returned to frontend
interface SubscriptionStatus {
  tier: SubscriptionTier;            // "free" | "premium" | "clinical"
  isActive: boolean;                 // tier !== "free" && expires > now
  isTrialActive: boolean;            // hasUsedTrial && no telegramPaymentId in logs
  isCancelled: boolean;              // subscriptionCancelledAt !== null
  expiresAt: string | null;          // ISO datetime
  daysRemaining: number;             // max(0, ceil((expires - now) / day))
}

// Trial eligibility info
interface TrialInfo {
  eligible: boolean;                 // !hasUsedTrial
  durationDays: number;              // 7
  message: string;                   // eligibility reason (RU)
}

// Invoice data returned after createInvoice
interface InvoiceData {
  invoiceUrl: string;                // Telegram invoice link
  amount: number;                    // 250
  currency: string;                  // "XTR" (Telegram Stars)
  expiresAt: string;                 // ISO datetime (5 min TTL for dedup)
}

// Subscription log event types
type SubscriptionLogType =
  | "trial_started"
  | "payment_success"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_renewed";

// Constants
const TRIAL_DURATION_DAYS = 7;
const SUBSCRIPTION_DURATION_DAYS = 30;
const SUBSCRIPTION_PRICE_STARS = 250;
const INVOICE_DEDUP_TTL_SECONDS = 300;   // 5 min
```

## 2. Core Engine: subscription-engine.ts

### 2.1 startTrial(userId)

```
FUNCTION startTrial(userId):
  INPUT: userId (string)
  OUTPUT: SubscriptionStatus
  THROWS: PAY_001 if already trialed

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Check trial eligibility
  IF user.hasUsedTrial == true THEN
    THROW PAY_001 with details { reason: "trial_already_used" }

  // 3. Calculate expiry
  expiresAt = NOW() + TRIAL_DURATION_DAYS days

  // 4. Transaction: update user + log
  DB.transaction:
    DB.update("users", {
      id: userId,
      subscriptionTier: "premium",
      subscriptionExpires: expiresAt,
      hasUsedTrial: true
    })

    DB.create("subscription_logs", {
      userId,
      type: "trial_started",
      amount: 0,
      currency: "XTR",
      telegramPaymentId: null,
      createdAt: NOW()
    })

  // 5. Return status
  RETURN {
    tier: "premium",
    isActive: true,
    isTrialActive: true,
    isCancelled: false,
    expiresAt: expiresAt.toISOString(),
    daysRemaining: TRIAL_DURATION_DAYS
  }
```

### 2.2 createInvoice(userId)

```
FUNCTION createInvoice(userId):
  INPUT: userId (string)
  OUTPUT: InvoiceData
  THROWS: PAY_002 if TG Bot API unavailable

  // 1. Dedup check: prevent duplicate invoices within 5 min
  dedupKey = "sub:invoice:{userId}"
  TRY:
    cached = REDIS.GET(dedupKey)
    IF cached THEN RETURN JSON.parse(cached)
  CATCH:
    // Redis unavailable — proceed without dedup

  // 2. Fetch user for context
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 3. Build invoice payload for Telegram Bot API
  payload = {
    title: "Весна Premium",
    description: "Подписка на 30 дней: все уроки, AI-коуч, дуэли",
    payload: JSON.stringify({
      userId: userId,
      type: "premium_monthly",
      createdAt: NOW().toISOString()
    }),
    currency: "XTR",
    prices: [{ label: "Premium 30 дней", amount: SUBSCRIPTION_PRICE_STARS }]
  }

  // 4. Call Telegram Bot API /createInvoiceLink
  TRY:
    response = HTTP.POST(
      "https://api.telegram.org/bot{TG_BOT_TOKEN}/createInvoiceLink",
      payload
    )
    IF response.ok == false THEN THROW PAY_002
    invoiceUrl = response.result  // string URL
  CATCH error:
    LOG.error("[subscription] createInvoiceLink failed", error)
    THROW PAY_002

  // 5. Cache invoice URL for dedup
  result = {
    invoiceUrl,
    amount: SUBSCRIPTION_PRICE_STARS,
    currency: "XTR",
    expiresAt: (NOW() + INVOICE_DEDUP_TTL_SECONDS seconds).toISOString()
  }

  TRY:
    REDIS.SETEX(dedupKey, INVOICE_DEDUP_TTL_SECONDS, JSON.stringify(result))
  CATCH:
    // Redis unavailable — skip cache

  RETURN result
```

### 2.3 processPayment(userId, telegramPaymentChargeId)

```
FUNCTION processPayment(userId, telegramPaymentChargeId):
  INPUT: userId (string), telegramPaymentChargeId (string)
  OUTPUT: SubscriptionStatus
  THROWS: PAY_001 if user not found

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Calculate new expiry
  //    If user has active subscription, extend from current expiry
  //    Otherwise, start from now
  baseDate = IF user.subscriptionExpires != NULL
                AND user.subscriptionExpires > NOW()
             THEN user.subscriptionExpires
             ELSE NOW()
  expiresAt = baseDate + SUBSCRIPTION_DURATION_DAYS days

  // 3. Determine log type
  logType = IF user.subscriptionTier == "premium"
               AND user.subscriptionCancelledAt != NULL
            THEN "subscription_renewed"
            ELSE "payment_success"

  // 4. Transaction: update user + log
  DB.transaction:
    DB.update("users", {
      id: userId,
      subscriptionTier: "premium",
      subscriptionExpires: expiresAt,
      subscriptionCancelledAt: null   // clear cancellation if re-subscribing
    })

    DB.create("subscription_logs", {
      userId,
      type: logType,
      amount: SUBSCRIPTION_PRICE_STARS,
      currency: "XTR",
      telegramPaymentId: telegramPaymentChargeId,
      createdAt: NOW()
    })

  // 5. Invalidate any cached invoice
  TRY:
    REDIS.DEL("sub:invoice:{userId}")
  CATCH:
    // Redis unavailable

  daysRemaining = CEIL((expiresAt - NOW()) / ONE_DAY_MS)

  RETURN {
    tier: "premium",
    isActive: true,
    isTrialActive: false,
    isCancelled: false,
    expiresAt: expiresAt.toISOString(),
    daysRemaining
  }
```

### 2.4 cancelSubscription(userId)

```
FUNCTION cancelSubscription(userId):
  INPUT: userId (string)
  OUTPUT: SubscriptionStatus
  THROWS: PAY_001 if no active subscription

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Validate: must have active subscription
  IF user.subscriptionTier == "free" THEN
    THROW PAY_001 with details { reason: "no_active_subscription" }

  // 3. Mark as cancelled (keep access until expiry)
  DB.transaction:
    DB.update("users", {
      id: userId,
      subscriptionCancelledAt: NOW()
    })

    DB.create("subscription_logs", {
      userId,
      type: "subscription_cancelled",
      amount: 0,
      currency: "XTR",
      telegramPaymentId: null,
      createdAt: NOW()
    })

  // 4. Return status — still active until expiry
  daysRemaining = CEIL((user.subscriptionExpires - NOW()) / ONE_DAY_MS)
  daysRemaining = MAX(0, daysRemaining)

  RETURN {
    tier: user.subscriptionTier,
    isActive: true,
    isTrialActive: false,
    isCancelled: true,
    expiresAt: user.subscriptionExpires.toISOString(),
    daysRemaining
  }
```

### 2.5 getSubscriptionStatus(userId)

```
FUNCTION getSubscriptionStatus(userId):
  INPUT: userId (string)
  OUTPUT: SubscriptionStatus

  user = DB.findUnique("users", {
    id: userId,
    select: {
      subscriptionTier, subscriptionExpires,
      hasUsedTrial, subscriptionCancelledAt
    }
  })
  IF user == NULL THEN THROW AUTH_001

  now = NOW()
  isExpired = user.subscriptionExpires != NULL
              AND user.subscriptionExpires <= now
  isActive = user.subscriptionTier != "free" AND NOT isExpired

  // Determine if current period is trial
  // Trial = hasUsedTrial AND no payment_success log exists
  isTrialActive = false
  IF isActive AND user.hasUsedTrial THEN
    paymentCount = DB.count("subscription_logs", {
      userId,
      type: "payment_success"
    })
    isTrialActive = paymentCount == 0

  isCancelled = user.subscriptionCancelledAt != NULL

  daysRemaining = 0
  IF user.subscriptionExpires != NULL AND user.subscriptionExpires > now THEN
    daysRemaining = CEIL((user.subscriptionExpires - now) / ONE_DAY_MS)

  RETURN {
    tier: IF isExpired THEN "free" ELSE user.subscriptionTier,
    isActive,
    isTrialActive,
    isCancelled,
    expiresAt: user.subscriptionExpires?.toISOString() ?? null,
    daysRemaining
  }
```

### 2.6 processExpirations()

```
FUNCTION processExpirations():
  INPUT: none (called by POST /api/subscription/cron)
  OUTPUT: { expired: number }

  // 1. Find users with expired subscriptions still marked as premium/clinical
  expiredUsers = DB.findMany("users", {
    where: {
      subscriptionTier: { in: ["premium", "clinical"] },
      subscriptionExpires: { lt: NOW() }
    },
    select: { id: true }
  })

  IF expiredUsers.length == 0 THEN RETURN { expired: 0 }

  // 2. Batch downgrade to free
  userIds = expiredUsers.map(u => u.id)

  DB.updateMany("users", {
    where: { id: { in: userIds } },
    data: {
      subscriptionTier: "free",
      subscriptionCancelledAt: null  // clean up
    }
  })

  // 3. Log expirations
  FOR EACH userId IN userIds:
    DB.create("subscription_logs", {
      userId,
      type: "subscription_expired",
      amount: 0,
      currency: "XTR",
      telegramPaymentId: null,
      createdAt: NOW()
    })

  // 4. Fire-and-forget: send notifications
  FOR EACH userId IN userIds:
    sendNotification(userId, "subscription_expired", {})
      .catch(err => LOG.error("[subscription] expiry notification", err))

  RETURN { expired: userIds.length }
```

## 3. Telegram Webhook Handler

### 3.1 handlePreCheckoutQuery(query)

```
FUNCTION handlePreCheckoutQuery(query):
  INPUT: query (TG pre_checkout_query object)
    {
      id: string,
      from: { id: number },
      currency: "XTR",
      total_amount: number,
      invoice_payload: string
    }
  OUTPUT: void (responds to Telegram)

  TRY:
    // 1. Parse and validate payload
    payload = JSON.parse(query.invoice_payload)
    IF payload.userId == NULL THEN
      answerPreCheckoutQuery(query.id, false, "Неверные данные заказа")
      RETURN

    IF payload.type != "premium_monthly" THEN
      answerPreCheckoutQuery(query.id, false, "Неизвестный тип подписки")
      RETURN

    // 2. Validate amount
    IF query.total_amount != SUBSCRIPTION_PRICE_STARS THEN
      answerPreCheckoutQuery(query.id, false, "Неверная сумма")
      RETURN

    // 3. Verify user exists
    user = DB.findUnique("users", { id: payload.userId })
    IF user == NULL THEN
      answerPreCheckoutQuery(query.id, false, "Пользователь не найден")
      RETURN

    // 4. Answer OK — allow payment to proceed
    answerPreCheckoutQuery(query.id, true)

  CATCH error:
    LOG.error("[webhook] pre_checkout_query error", error)
    answerPreCheckoutQuery(query.id, false, "Ошибка обработки")


FUNCTION answerPreCheckoutQuery(queryId, ok, errorMessage?):
  HTTP.POST(
    "https://api.telegram.org/bot{TG_BOT_TOKEN}/answerPreCheckoutQuery",
    {
      pre_checkout_query_id: queryId,
      ok: ok,
      error_message: errorMessage  // only if ok=false
    }
  )
```

### 3.2 handleSuccessfulPayment(update)

```
FUNCTION handleSuccessfulPayment(update):
  INPUT: update (TG message with successful_payment)
    {
      message: {
        from: { id: number },
        successful_payment: {
          currency: "XTR",
          total_amount: number,
          invoice_payload: string,
          telegram_payment_charge_id: string,
          provider_payment_charge_id: string
        }
      }
    }
  OUTPUT: void

  payment = update.message.successful_payment

  TRY:
    // 1. Parse payload to get userId
    payload = JSON.parse(payment.invoice_payload)
    userId = payload.userId

    IF userId == NULL THEN
      LOG.error("[webhook] successful_payment: missing userId in payload")
      RETURN

    // 2. Idempotency check: has this charge been processed?
    existing = DB.findFirst("subscription_logs", {
      telegramPaymentId: payment.telegram_payment_charge_id
    })
    IF existing != NULL THEN
      LOG.info("[webhook] duplicate payment, already processed", { chargeId })
      RETURN

    // 3. Process the payment
    processPayment(userId, payment.telegram_payment_charge_id)

    // 4. Fire-and-forget: send confirmation notification
    sendNotification(userId, "subscription_activated", {})
      .catch(err => LOG.error("[webhook] payment notification", err))

  CATCH error:
    LOG.error("[webhook] successful_payment error", error)
    // Do NOT throw — Telegram doesn't retry webhooks based on error responses
    // Log for manual investigation
```

## 4. Webhook Router

```
FUNCTION handleWebhookUpdate(update):
  INPUT: update (raw Telegram Update object)
  OUTPUT: void

  // Route to appropriate handler based on update type
  IF update.pre_checkout_query THEN
    handlePreCheckoutQuery(update.pre_checkout_query)

  ELSE IF update.message?.successful_payment THEN
    handleSuccessfulPayment(update)

  // Other update types (messages, etc.) — ignore or handle elsewhere
```

## 5. Trial Eligibility Check (helper)

```
FUNCTION getTrialInfo(userId):
  INPUT: userId (string)
  OUTPUT: TrialInfo

  user = DB.findUnique("users", {
    id: userId,
    select: { hasUsedTrial: true, subscriptionTier: true }
  })

  IF user == NULL THEN THROW AUTH_001

  IF user.subscriptionTier != "free" THEN
    RETURN {
      eligible: false,
      durationDays: TRIAL_DURATION_DAYS,
      message: "У вас уже есть активная подписка"
    }

  IF user.hasUsedTrial THEN
    RETURN {
      eligible: false,
      durationDays: TRIAL_DURATION_DAYS,
      message: "Пробный период уже был использован"
    }

  RETURN {
    eligible: true,
    durationDays: TRIAL_DURATION_DAYS,
    message: "7 дней Premium бесплатно"
  }
```

## 6. Paywall Trigger Points

```
FUNCTION checkPaywall(userId, feature):
  INPUT: userId, feature ("lesson_4plus" | "coach" | "duels" | "advanced_meals")
  OUTPUT: { allowed: boolean, paywallReason?: string }

  // This is already handled by existing SUBSCRIPTION_TIERS constants
  // and requireAuth() tier checks in each route.
  // Documented here for completeness:

  user = requireAuth(request)
  tierConfig = SUBSCRIPTION_TIERS[user.tier]

  SWITCH feature:
    "lesson_4plus":
      allowed = tierConfig.maxLessons > 3
      reason = "Уроки 4-14 доступны в Premium"

    "coach":
      allowed = tierConfig.hasCoach
      reason = "AI-коуч доступен в Premium"

    "duels":
      allowed = tierConfig.hasDuels
      reason = "Дуэли доступны в Premium"

    "advanced_meals":
      allowed = tierConfig.maxLessons > 3  // reuse as proxy
      reason = "Аналитика питания доступна в Premium"

  RETURN { allowed, paywallReason: IF NOT allowed THEN reason ELSE undefined }
```
