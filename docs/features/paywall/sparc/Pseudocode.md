# Pseudocode: Paywall & Payments (F9)

## 1. Data Structures

```typescript
// Subscription status returned to frontend (matches Specification API contracts)
interface SubscriptionStatus {
  tier: SubscriptionTier;            // "free" | "premium" | "clinical"
  status: "free" | "trial" | "active" | "cancelled" | "expired";
  canStartTrial: boolean;            // !hasUsedTrial && tier == "free"
  expiresAt: string | null;          // ISO datetime
  trialEndsAt: string | null;        // ISO datetime (= expiresAt when status == "trial")
  cancelledAt: string | null;        // ISO datetime (when user cancelled)
  daysRemaining: number;             // max(0, ceil((expires - now) / day))
  features: {
    maxLessons: number;              // 3 (free) or 14 (premium/clinical)
    hasCoach: boolean;
    hasDuels: boolean;
  };
  lostFeatures?: LostFeature[];      // only in cancel response
}

// Lost feature item (cancel response)
interface LostFeature {
  name: string;
  description: string;
}

// Trial eligibility info
interface TrialInfo {
  eligible: boolean;                 // !hasUsedTrial && tier == "free"
  durationDays: number;              // 7
  message: string;                   // eligibility reason (RU)
}

// Invoice data returned after createInvoice
interface InvoiceData {
  invoiceUrl: string;                // Telegram invoice link
  amount: number;                    // 250
  currency: string;                  // "XTR" (Telegram Stars)
  description: string;               // "Весна Premium — 30 дней"
}

// Subscription log event types
type SubscriptionLogType =
  | "trial_started"
  | "payment_success"
  | "payment_failed"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_renewed";

// Constants
const TRIAL_DURATION_DAYS = 7;
const SUBSCRIPTION_DURATION_DAYS = 30;
const SUBSCRIPTION_PRICE_STARS = 250;
const INVOICE_DEDUP_TTL_SECONDS = 300;   // 5 min
const SUBSCRIPTION_CURRENCY = "XTR";
const SUBSCRIPTION_PRICE_RUB_APPROX = 499;
const TRIAL_EXPIRY_WARNING_HOURS = 24;

const SUBSCRIPTION_FEATURES_LOST = [
  { name: "AI-коуч", description: "Персональные CBT-рекомендации" },
  { name: "Уроки 4-14", description: "11 продвинутых CBT-уроков" },
  { name: "Дуэли", description: "Соревнования с друзьями" },
];
```

## 2. Pure Functions (unit-testable, no DB/IO)

### 2.1 isTrialEligible(user)

```
FUNCTION isTrialEligible(user):
  INPUT: user { hasUsedTrial: boolean, subscriptionTier: SubscriptionTier }
  OUTPUT: boolean

  IF user.subscriptionTier == "clinical" THEN RETURN false
  IF user.subscriptionTier != "free" THEN RETURN false
  IF user.hasUsedTrial == true THEN RETURN false
  RETURN true
```

### 2.2 calculateTrialExpiry(startDate)

```
FUNCTION calculateTrialExpiry(startDate):
  INPUT: startDate (Date)
  OUTPUT: Date

  RETURN new Date(startDate.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
```

### 2.3 calculateSubscriptionExpiry(baseDate)

```
FUNCTION calculateSubscriptionExpiry(baseDate):
  INPUT: baseDate (Date) — either NOW() or current subscriptionExpires
  OUTPUT: Date

  RETURN new Date(baseDate.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000)
```

### 2.4 deriveSubscriptionStatus(user, paymentCount)

```
FUNCTION deriveSubscriptionStatus(user, paymentCount):
  INPUT: user { subscriptionTier, subscriptionExpires, hasUsedTrial, subscriptionCancelledAt }
         paymentCount (number) — count of payment_success logs for this user
  OUTPUT: "free" | "trial" | "active" | "cancelled" | "expired"

  IF user.subscriptionTier == "free" THEN
    IF user.hasUsedTrial THEN RETURN "expired"
    RETURN "free"

  // Tier is premium or clinical
  isExpired = user.subscriptionExpires != NULL
              AND user.subscriptionExpires <= NOW()
  IF isExpired THEN RETURN "expired"

  IF user.subscriptionCancelledAt != NULL THEN RETURN "cancelled"

  IF user.hasUsedTrial AND paymentCount == 0 THEN RETURN "trial"

  RETURN "active"
```

### 2.5 buildSubscriptionResponse(user, status, paymentCount)

```
FUNCTION buildSubscriptionResponse(user, status, paymentCount):
  INPUT: user { subscriptionTier, subscriptionExpires, hasUsedTrial, subscriptionCancelledAt }
         status: string (from deriveSubscriptionStatus)
         paymentCount: number
  OUTPUT: SubscriptionStatus

  now = NOW()
  tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier]

  daysRemaining = 0
  IF user.subscriptionExpires != NULL AND user.subscriptionExpires > now THEN
    daysRemaining = CEIL((user.subscriptionExpires - now) / ONE_DAY_MS)

  trialEndsAt = null
  IF user.hasUsedTrial AND paymentCount == 0 AND user.subscriptionExpires != NULL THEN
    trialEndsAt = user.subscriptionExpires.toISOString()

  RETURN {
    tier: IF status == "expired" THEN "free" ELSE user.subscriptionTier,
    status,
    canStartTrial: !user.hasUsedTrial AND user.subscriptionTier == "free",
    expiresAt: IF status == "expired" THEN null ELSE user.subscriptionExpires?.toISOString() ?? null,
    trialEndsAt,
    cancelledAt: user.subscriptionCancelledAt?.toISOString() ?? null,
    daysRemaining,
    features: {
      maxLessons: IF status == "expired" THEN 3 ELSE tierConfig.maxLessons,
      hasCoach: IF status == "expired" THEN false ELSE tierConfig.hasCoach,
      hasDuels: IF status == "expired" THEN false ELSE tierConfig.hasDuels
    }
  }
```

### 2.6 buildInvoicePayload(userId)

```
FUNCTION buildInvoicePayload(userId):
  INPUT: userId (string)
  OUTPUT: Telegram Bot API createInvoiceLink params

  RETURN {
    title: "Весна Premium",
    description: "Подписка на 30 дней: AI-коуч, 14 уроков, дуэли",
    payload: JSON.stringify({
      userId: userId,
      type: "premium_monthly",
      createdAt: NOW().toISOString()
    }),
    currency: "XTR",
    prices: [{ label: "Premium 30 дней", amount: SUBSCRIPTION_PRICE_STARS }]
  }
```

### 2.7 verifyWebhookSignature(body, receivedHash, botToken)

```
FUNCTION verifyWebhookSignature(body, receivedHash, botToken):
  INPUT: body (string — raw request body),
         receivedHash (string — X-Telegram-Bot-Api-Secret-Token header),
         botToken (string — TG_BOT_TOKEN)
  OUTPUT: boolean

  IF receivedHash == NULL OR receivedHash == "" THEN RETURN false
  IF botToken == NULL OR botToken == "" THEN RETURN false

  // Telegram uses the secret_token set during setWebhook
  // For simple verification: constant-time compare with known secret
  expected = crypto.createHash("sha256").update(botToken).digest("hex")

  // Constant-time comparison to prevent timing attacks
  IF expected.length != receivedHash.length THEN RETURN false
  RETURN crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(receivedHash)
  )
```

### 2.8 shouldDowngradeWithActiveDuel(user, activeDuels)

```
FUNCTION shouldDowngradeWithActiveDuel(activeDuels):
  INPUT: activeDuels — array of active duels for user
  OUTPUT: boolean (true = should downgrade, false = grace period)

  IF activeDuels.length == 0 THEN RETURN true

  // Check if any duel ends in the future
  FOR EACH duel IN activeDuels:
    IF duel.endDate > NOW() THEN RETURN false   // grace period

  RETURN true
```

## 3. Core Engine: subscription-engine.ts

### 3.1 startTrial(userId)

```
FUNCTION startTrial(userId):
  INPUT: userId (string)
  OUTPUT: SubscriptionStatus
  THROWS: PAY_003 if already trialed, PAY_004 if already premium

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Check eligibility using pure function
  IF user.subscriptionTier == "clinical" THEN
    THROW PAY_004 with details { reason: "clinical_managed_by_admin" }

  IF user.subscriptionTier != "free" THEN
    THROW PAY_004 with details { reason: "already_premium" }

  IF user.hasUsedTrial == true THEN
    THROW PAY_003 with details { reason: "trial_already_used" }

  // 3. Calculate expiry using pure function
  expiresAt = calculateTrialExpiry(NOW())

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
      event: "trial_started",
      amount: 0,
      currency: "XTR",
      telegramPaymentChargeId: null,
      createdAt: NOW()
    })

  // 5. Return status
  RETURN {
    tier: "premium",
    status: "trial",
    canStartTrial: false,
    expiresAt: expiresAt.toISOString(),
    trialEndsAt: expiresAt.toISOString(),
    cancelledAt: null,
    daysRemaining: TRIAL_DURATION_DAYS,
    features: SUBSCRIPTION_TIERS["premium"]
  }
```

### 3.2 createInvoice(userId)

```
FUNCTION createInvoice(userId):
  INPUT: userId (string)
  OUTPUT: InvoiceData
  THROWS: PAY_001 if no telegramId, PAY_002 if TG Bot API unavailable

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Require telegramId
  IF user.telegramId == NULL THEN
    THROW PAY_001 with details { reason: "no_telegram_id" }

  // 3. Dedup check: prevent duplicate invoices within 5 min
  dedupKey = "sub:invoice:{userId}"
  TRY:
    cached = REDIS.GET(dedupKey)
    IF cached THEN RETURN JSON.parse(cached)
  CATCH:
    // Redis unavailable — proceed without dedup

  // 4. Build invoice payload using pure function
  payload = buildInvoicePayload(userId)

  // 5. Call Telegram Bot API /createInvoiceLink
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

  // 6. Cache invoice URL for dedup
  result = {
    invoiceUrl,
    amount: SUBSCRIPTION_PRICE_STARS,
    currency: "XTR",
    description: "Весна Premium — 30 дней"
  }

  TRY:
    REDIS.SETEX(dedupKey, INVOICE_DEDUP_TTL_SECONDS, JSON.stringify(result))
  CATCH:
    // Redis unavailable — skip cache

  RETURN result
```

### 3.3 processPayment(userId, telegramPaymentChargeId, amount)

```
FUNCTION processPayment(userId, telegramPaymentChargeId, amount):
  INPUT: userId (string), telegramPaymentChargeId (string), amount (number)
  OUTPUT: SubscriptionStatus
  THROWS: AUTH_001 if user not found

  // 1. Validate amount
  IF amount != SUBSCRIPTION_PRICE_STARS THEN
    LOG.error("[subscription] Invalid payment amount", { expected: SUBSCRIPTION_PRICE_STARS, got: amount })
    THROW PAY_001 with details { reason: "invalid_amount" }

  // 2. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 3. Calculate new expiry using pure function
  //    If user has active subscription, extend from current expiry
  //    Otherwise, start from now
  baseDate = IF user.subscriptionExpires != NULL
                AND user.subscriptionExpires > NOW()
             THEN user.subscriptionExpires
             ELSE NOW()
  expiresAt = calculateSubscriptionExpiry(baseDate)

  // 4. Determine log type
  logType = IF user.subscriptionTier == "premium"
               AND user.subscriptionCancelledAt != NULL
            THEN "subscription_renewed"
            ELSE "payment_success"

  // 5. Transaction: update user + log
  TRY:
    DB.transaction:
      DB.update("users", {
        id: userId,
        subscriptionTier: "premium",
        subscriptionExpires: expiresAt,
        subscriptionCancelledAt: null   // clear cancellation if re-subscribing
      })

      DB.create("subscription_logs", {
        userId,
        event: logType,
        amount: SUBSCRIPTION_PRICE_STARS,
        currency: "XTR",
        telegramPaymentChargeId: telegramPaymentChargeId,
        createdAt: NOW()
      })
  CATCH error:
    // Handle P2002 (unique constraint on telegramPaymentChargeId) — idempotent
    IF error.code == "P2002" THEN
      LOG.info("[subscription] duplicate payment charge", { telegramPaymentChargeId })
      RETURN getSubscriptionStatus(userId)
    THROW error

  // 6. Invalidate any cached invoice
  TRY:
    REDIS.DEL("sub:invoice:{userId}")
  CATCH:
    // Redis unavailable

  daysRemaining = CEIL((expiresAt - NOW()) / ONE_DAY_MS)

  RETURN {
    tier: "premium",
    status: "active",
    canStartTrial: false,
    expiresAt: expiresAt.toISOString(),
    trialEndsAt: null,
    cancelledAt: null,
    daysRemaining,
    features: SUBSCRIPTION_TIERS["premium"]
  }
```

### 3.4 cancelSubscription(userId)

```
FUNCTION cancelSubscription(userId):
  INPUT: userId (string)
  OUTPUT: SubscriptionStatus
  THROWS: PAY_005 if no active subscription, PAY_006 if trial period

  // 1. Fetch user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL THEN THROW AUTH_001

  // 2. Validate: must have active subscription
  IF user.subscriptionTier == "free" THEN
    THROW PAY_005 with details { reason: "no_active_subscription" }

  // 3. Check if user is on trial (cannot cancel trial)
  IF user.hasUsedTrial THEN
    paymentCount = DB.count("subscription_logs", {
      userId, event: "payment_success"
    })
    IF paymentCount == 0 THEN
      THROW PAY_006 with details { reason: "cannot_cancel_trial" }

  // 4. Mark as cancelled (keep access until expiry)
  DB.transaction:
    DB.update("users", {
      id: userId,
      subscriptionCancelledAt: NOW()
    })

    DB.create("subscription_logs", {
      userId,
      event: "subscription_cancelled",
      amount: 0,
      currency: "XTR",
      telegramPaymentChargeId: null,
      createdAt: NOW()
    })

  // 5. Return status — still active until expiry
  daysRemaining = CEIL((user.subscriptionExpires - NOW()) / ONE_DAY_MS)
  daysRemaining = MAX(0, daysRemaining)

  RETURN {
    tier: user.subscriptionTier,
    status: "cancelled",
    canStartTrial: false,
    expiresAt: user.subscriptionExpires.toISOString(),
    trialEndsAt: null,
    cancelledAt: NOW().toISOString(),
    daysRemaining,
    features: SUBSCRIPTION_TIERS[user.subscriptionTier],
    lostFeatures: SUBSCRIPTION_FEATURES_LOST
  }
```

### 3.5 getSubscriptionStatus(userId)

```
FUNCTION getSubscriptionStatus(userId):
  INPUT: userId (string)
  OUTPUT: { subscription: SubscriptionStatus, trial: TrialInfo }

  user = DB.findUnique("users", {
    id: userId,
    select: {
      subscriptionTier, subscriptionExpires,
      hasUsedTrial, subscriptionCancelledAt
    }
  })
  IF user == NULL THEN THROW AUTH_001

  // Count payment_success logs (needed for trial vs active distinction)
  paymentCount = DB.count("subscription_logs", {
    userId, event: "payment_success"
  })

  // Derive status using pure function
  status = deriveSubscriptionStatus(user, paymentCount)

  // Build response using pure function
  subscription = buildSubscriptionResponse(user, status, paymentCount)

  // Build trial info using pure function
  trial = getTrialInfo(user)

  RETURN { subscription, trial }
```

### 3.6 processExpirations()

```
FUNCTION processExpirations():
  INPUT: none (called by POST /api/subscription/cron)
  OUTPUT: { trialsExpired: number, subscriptionsExpired: number, trialWarningsSent: number }

  now = NOW()
  trialsExpired = 0
  subscriptionsExpired = 0
  trialWarningsSent = 0

  // 1. Find users with expired subscriptions still marked as premium/clinical
  expiredUsers = DB.findMany("users", {
    where: {
      subscriptionTier: { in: ["premium", "clinical"] },
      subscriptionExpires: { lt: now }
    },
    select: { id: true, hasUsedTrial: true },
    take: 1000  // batch cap
  })

  IF expiredUsers.length > 0 THEN
    userIds = expiredUsers.map(u => u.id)

    // 1a. Batch downgrade to free
    DB.updateMany("users", {
      where: { id: { in: userIds } },
      data: {
        subscriptionTier: "free",
        subscriptionCancelledAt: null  // clean up
      }
    })

    // 1b. Log expirations + count by type
    FOR EACH user IN expiredUsers:
      DB.create("subscription_logs", {
        userId: user.id,
        event: "subscription_expired",
        amount: 0,
        currency: "XTR",
        telegramPaymentChargeId: null,
        createdAt: now
      })

      // Count trial vs paid expirations
      paymentCount = DB.count("subscription_logs", {
        userId: user.id, event: "payment_success"
      })
      IF paymentCount == 0 THEN trialsExpired++
      ELSE subscriptionsExpired++

    // 1c. Fire-and-forget: send notifications
    FOR EACH userId IN userIds:
      sendNotification(userId, "subscription_expired", {})
        .catch(err => LOG.error("[subscription] expiry notification", err))

  // 2. Trial expiry warnings (24h before)
  warningThreshold = now + TRIAL_EXPIRY_WARNING_HOURS * 60 * 60 * 1000
  trialUsers = DB.findMany("users", {
    where: {
      subscriptionTier: "premium",
      subscriptionExpires: { gt: now, lt: warningThreshold },
      hasUsedTrial: true
    },
    select: { id: true },
    take: 1000
  })

  FOR EACH user IN trialUsers:
    // Check if this is still trial (no payments)
    paymentCount = DB.count("subscription_logs", {
      userId: user.id, event: "payment_success"
    })
    IF paymentCount == 0 THEN
      sendNotification(user.id, "trial_expiring", {})
        .catch(err => LOG.error("[subscription] trial warning", err))
      trialWarningsSent++

  RETURN { trialsExpired, subscriptionsExpired, trialWarningsSent }
```

## 4. Telegram Webhook Handler

### 4.1 handleWebhookUpdate(update, rawBody, signatureHeader)

```
FUNCTION handleWebhookUpdate(update, rawBody, signatureHeader):
  INPUT: update (raw Telegram Update object), rawBody (string), signatureHeader (string)
  OUTPUT: void

  // 1. Verify webhook signature
  IF NOT verifyWebhookSignature(rawBody, signatureHeader, process.env.TG_BOT_TOKEN) THEN
    LOG.warn("[webhook] signature verification failed", {
      ip: request.headers["x-forwarded-for"]
    })
    THROW PAY_003   // 401

  // 2. Route to appropriate handler based on update type
  IF update.pre_checkout_query THEN
    handlePreCheckoutQuery(update.pre_checkout_query)

  ELSE IF update.message?.successful_payment THEN
    handleSuccessfulPayment(update)

  // Other update types — ignore
```

### 4.2 handlePreCheckoutQuery(query)

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

    // 3. Validate currency
    IF query.currency != "XTR" THEN
      answerPreCheckoutQuery(query.id, false, "Неверная валюта")
      RETURN

    // 4. Verify user exists
    user = DB.findUnique("users", { id: payload.userId })
    IF user == NULL THEN
      answerPreCheckoutQuery(query.id, false, "Пользователь не найден")
      RETURN

    // 5. Answer OK — allow payment to proceed
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

### 4.3 handleSuccessfulPayment(update)

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
    // 1. Validate amount (defense in depth — pre_checkout also checks)
    IF payment.total_amount != SUBSCRIPTION_PRICE_STARS THEN
      LOG.error("[webhook] successful_payment: invalid amount", {
        expected: SUBSCRIPTION_PRICE_STARS,
        got: payment.total_amount
      })
      RETURN   // Do not process, but return 200 to Telegram

    // 2. Validate currency
    IF payment.currency != "XTR" THEN
      LOG.error("[webhook] successful_payment: invalid currency", {
        expected: "XTR",
        got: payment.currency
      })
      RETURN

    // 3. Parse payload to get userId
    payload = JSON.parse(payment.invoice_payload)
    userId = payload.userId

    IF userId == NULL THEN
      LOG.error("[webhook] successful_payment: missing userId in payload")
      RETURN

    // 4. Idempotency check: has this charge been processed?
    existing = DB.findFirst("subscription_logs", {
      telegramPaymentChargeId: payment.telegram_payment_charge_id
    })
    IF existing != NULL THEN
      LOG.info("[webhook] duplicate payment, already processed", {
        chargeId: payment.telegram_payment_charge_id
      })
      RETURN

    // 5. Process the payment (amount already validated above)
    processPayment(userId, payment.telegram_payment_charge_id, payment.total_amount)

    // 6. Fire-and-forget: send confirmation notification
    sendNotification(userId, "payment_success", {})
      .catch(err => LOG.error("[webhook] payment notification", err))

  CATCH error:
    LOG.error("[webhook] successful_payment error", error)
    // Do NOT throw — Telegram doesn't retry webhooks based on error responses
    // Log for manual investigation
```

## 5. Trial Eligibility Check (helper)

```
FUNCTION getTrialInfo(user):
  INPUT: user { hasUsedTrial: boolean, subscriptionTier: SubscriptionTier }
  OUTPUT: TrialInfo

  // Use pure function for eligibility check
  eligible = isTrialEligible(user)

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

## 7. Error Code Mapping

| Error | HTTP | Trigger | Used In |
|-------|:----:|---------|---------|
| PAY_001 | 400 | No telegramId for Stars payment | createInvoice |
| PAY_002 | 502 | Telegram Bot API unavailable | createInvoice |
| PAY_003 | 400 | Trial already used | startTrial |
| PAY_004 | 400 | Already premium / clinical | startTrial |
| PAY_005 | 400 | No active subscription to cancel | cancelSubscription |
| PAY_006 | 400 | Cannot cancel trial period | cancelSubscription |
