# PRD: Paywall & Payments (F9)

## Executive Summary

Subscription and payment system for the Vesna platform using **Telegram Stars** as the payment method. Enables free-to-premium conversion through a 7-day trial, handles recurring monthly payments (250 Stars/month, ~499 RUB equivalent), and provides subscription lifecycle management (trial, active, cancelled, expired). Integrates with Telegram Bot Payments API for invoice creation and webhook processing.

## Problem

Free users hit feature gates (lesson 4+, AI Coach, Duels) but have no clear path to upgrade. Current paywall triggers return 403 errors with "Доступно в Premium" message but lead nowhere actionable. Without a frictionless upgrade flow:
- Users bounce at the paywall and never return (estimated 40-60% permanent churn at first gate)
- The platform generates zero revenue despite engaged users (days 3-7 are peak conversion window)
- Feature gates feel punitive rather than motivational — users feel rejected, not invited

The existing RevenueCat integration referenced in the original PRD is incompatible with Telegram Mini Apps (RevenueCat requires native iOS/Android SDKs or App Store/Google Play billing). Since Vesna is a Telegram Mini App, the only viable in-app payment method is **Telegram Stars** via the Bot Payments API.

## Solution

End-to-end subscription system built on Telegram Stars:

1. **Paywall page** (`/paywall`) — attractive upgrade screen shown when free users hit any feature gate, with clear value proposition and one-tap trial activation
2. **7-day free trial** — no payment upfront, all premium features unlock immediately, tracked server-side in PostgreSQL
3. **Telegram Stars payment** — after trial, user pays 250 Stars/month via Telegram's native invoice UI (bot sends invoice, user confirms in Telegram, webhook confirms payment)
4. **Subscription management** (`/profile/subscription`) — view current status, expiry date, cancel at period end
5. **Automated expiry handling** — cron job checks trial/subscription expiry, downgrades expired users to free tier
6. **Webhook processing** — receives `successful_payment` events from Telegram, extends subscription by 30 days

### Why Telegram Stars

| Factor | Telegram Stars | RevenueCat / In-App Purchase |
|--------|---------------|------------------------------|
| Works in Telegram Mini App | Yes (native) | No (requires native app) |
| Payment friction | Zero — built into Telegram UI | High — requires app store account |
| Processing fee | ~0% (Telegram subsidizes) | 15-30% (Apple/Google cut) |
| Refund handling | Telegram manages | App Store manages |
| Geographic availability | All Telegram users | Limited by store availability |
| Implementation complexity | Low (Bot API webhooks) | Medium (SDK integration) |

## Target Users

### Primary: Free users on days 3-7

Users who have completed C-screen quiz, finished lessons 1-3, and are engaged enough to attempt lesson 4 or try to access AI Coach. They have experienced the product value (Medical Aha moment, first CBT concepts) and are motivated to continue but blocked by the free tier.

**Behavioral signals:**
- Completed 3 lessons (sequential engagement)
- Streak of 3+ days (habit forming)
- Attempted to access a gated feature (intent signal)
- Average session time > 3 minutes (genuine engagement)

### Secondary: Churned premium users

Users whose trial expired without converting, or who cancelled subscription. Re-engagement through churn prevention notifications (already implemented in F8) that deep-link to the paywall page.

### Anti-personas
- Users who only completed the quiz but never started lessons (not engaged enough)
- Users seeking free workarounds (will not convert regardless of UX)

## Key Metrics

| Metric | Baseline | Target M3 | Target M6 | Target M12 |
|--------|:--------:|:---------:|:---------:|:----------:|
| Free-to-trial conversion | 0% | 12% | 15% | 18% |
| Trial-to-paid conversion | 0% | 35% | 45% | 55% |
| Overall free-to-paid (30d) | 0% | 4% | 5% | 6% |
| MRR (Stars equivalent) | 0 | 45K RUB | 488K RUB | 2.6M RUB |
| Voluntary churn rate | — | <12%/mo | <10%/mo | <8%/mo |
| Paywall page → trial CTA tap | — | 25% | 30% | 35% |
| Average revenue per paying user | — | 499 RUB/mo | 499 RUB/mo | 499 RUB/mo |
| Payment failure rate | — | <3% | <2% | <1% |

## Scope

### MVP (Must)

| Component | Description |
|-----------|-------------|
| **Paywall page** (`/paywall`) | Attractive upgrade page with feature comparison, trial CTA, shown at all feature gates |
| **Trial activation** | `POST /api/subscription/trial` — start 7-day trial, no payment upfront |
| **Subscription status API** | `GET /api/subscription/status` — current tier, expiry, can_trial, etc. |
| **Telegram Stars invoice** | `POST /api/subscription/invoice` — create Telegram Stars invoice for 250 Stars |
| **Payment webhook** | `POST /api/subscription/webhook` — handle Telegram `successful_payment` event |
| **Subscription cancellation** | `POST /api/subscription/cancel` — cancel at period end |
| **Subscription management page** | `/profile/subscription` — view status, cancel, see history |
| **Expiry cron job** | Hourly cron via `POST /api/subscription/cron` — expire trials and subscriptions |
| **Trial expiry notification** | Telegram message 1 day before trial ends, via existing notification engine |
| **DB schema additions** | New `Subscription` model for payment history; new fields on `User` for trial tracking |
| **Error codes** | PAY_001 through PAY_006 for payment-related errors |

### v2 (Should — Phase 2)

| Component | Description |
|-----------|-------------|
| Clinical tier (4,990 RUB/mo) | Higher-tier subscription with doctor consultations |
| Promo codes | Discount codes for influencer campaigns, referral rewards |
| Downgrade offer | When cancelling, offer reduced price (150 Stars/month) |
| Pause subscription | 1-month freeze option instead of cancellation |
| Payment retry | Automatic retry for failed payments (1, 3, 7 days) |
| Revenue analytics | Dashboard with MRR, churn, LTV, cohort analysis |

### v3 (Could — Phase 3)

| Component | Description |
|-----------|-------------|
| Family plans | Shared premium access for 2-5 family members |
| Annual subscription | 2,500 Stars/year (2 months free) |
| Corporate plans | B2B wellness programs with bulk licensing |
| Multiple payment methods | TON cryptocurrency, bank cards via external gateway |
| Gift subscriptions | Buy premium for a friend |

## User Journeys

### Journey 1: Free user hits paywall and starts trial

```
Step 1: Feature Gate Trigger
  User: Completes lesson 3, taps on lesson 4
  System: Returns LESSON_001 (403), redirects to /paywall?source=lesson&blocked=4

Step 2: Paywall Page
  User: Sees "Продолжите свой путь к здоровью"
  System: Shows feature comparison (free vs premium),
          7-day trial CTA, price "затем 250 Stars/мес (~499 руб)"
  User: Taps "Попробовать 7 дней бесплатно"

Step 3: Trial Activation
  System: POST /api/subscription/trial
          - Sets subscriptionTier = premium
          - Sets trialStartedAt = now
          - Sets subscriptionExpires = now + 7 days
          - Returns confirmation
  User: Sees "Trial активен до {date}! Все Premium-функции открыты"
  System: Redirects to previously blocked content (/lessons/4)

Step 4: Day 6 — Trial Expiry Warning
  System: Sends Telegram notification:
          "Ваш пробный период заканчивается завтра.
           Оплатите подписку, чтобы продолжить."
          [Оплатить 250 Stars]

Step 5: Payment
  User: Taps payment button → Telegram shows Stars invoice
  System: Bot sends invoice via Telegram Bot Payments API
  User: Confirms payment in Telegram UI
  Telegram: Sends pre_checkout_query → server answers OK
  Telegram: Sends successful_payment webhook
  System: POST /api/subscription/webhook processes payment:
          - Extends subscriptionExpires by 30 days
          - Creates Subscription record (payment history)
  Outcome: Paying subscriber
```

### Journey 2: Premium user manages subscription

```
Step 1: View Subscription
  User: Opens /profile/subscription
  System: Shows current tier (Premium), expiry date,
          payment history, cancel button

Step 2: Cancel Decision
  User: Taps "Отменить подписку"
  System: Shows "Что вы потеряете:" list:
          - AI-коуч
          - Уроки 4-14
          - Дуэли
          And "Ваш доступ сохранится до {expiry_date}"
  User: Confirms cancellation

Step 3: Grace Period
  System: Sets cancelledAt = now
          Access continues until subscriptionExpires
          After expiry, downgrades to free tier
```

### Journey 3: Trial expires without payment

```
Step 1: Trial Ends
  System: Cron job detects subscriptionExpires < now AND no payment record
  System: Sets subscriptionTier = free
  System: Sends notification: "Пробный период завершён. Оплатите подписку."

Step 2: Downgraded Experience
  User: Opens app, sees free tier limits restored
  System: Lesson progress preserved, but lessons 4+ locked again
  User: Sees gentle reminder on dashboard: "Вернитесь в Premium"
```

## Dependencies

| Dependency | Status | Risk | Mitigation |
|------------|--------|------|------------|
| `TG_BOT_TOKEN` env var | Configured | Low | Already used for auth + notifications |
| Telegram Bot Payments API | Available | Low | Stable API, well-documented |
| User.telegramId populated | Done (Telegram auth) | Low | Required for invoice delivery |
| Existing paywall triggers (LESSON_001, DUEL_001, Coach tier check) | Implemented | Low | Need to add redirect to /paywall |
| Notification engine (F8) | Implemented | Low | Reuse for trial expiry reminders |
| CRON_SECRET env var | Configured | Low | Reuse from notification cron |

## Risks

| ID | Risk | Prob. | Impact | Mitigation |
|----|------|:-----:|:------:|------------|
| R-P01 | Telegram Stars price changes | Low | Medium | Store Stars amount in config constant, easy to update |
| R-P02 | Trial abuse (create new accounts) | Medium | Medium | Limit trial to 1 per telegramId, track trialUsed flag |
| R-P03 | Webhook delivery failure | Low | High | Idempotent processing, reconciliation cron, Telegram retries |
| R-P04 | Free-to-paid < 2% | Medium | High | A/B test trial length (7/14d), paywall copy, price (150/250 Stars) |
| R-P05 | Users don't understand Telegram Stars | Medium | Medium | Add explainer on paywall page, show RUB equivalent |
| R-P06 | Subscription state desync | Low | High | Server-side single source of truth, webhook idempotency keys |

## Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-P01 | Should trial be 7 or 14 days? | Product | Start with 7, A/B test later |
| Q-P02 | Should we show RUB equivalent on paywall? | Product | Yes, "250 Stars (~499 руб)" |
| Q-P03 | Do we need a grace period after subscription expires? | Product | MVP: no grace, instant downgrade. v2: 3-day grace |
| Q-P04 | Should cancelled users see a re-subscribe offer on dashboard? | Product | Yes, gentle banner |
| Q-P05 | How to handle Telegram Stars refund requests? | Product | Telegram manages refunds; webhook for `refunded_payment` in v2 |
