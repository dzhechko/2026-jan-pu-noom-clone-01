# Validation Report: Paywall & Payments (F9)

## Iteration 1 Results

| Validator | Score | Status | Key Findings |
|-----------|:-----:|:------:|-------------|
| User Stories (INVEST) | 82.8/100 | PASS | US-P01 scored lowest (75) due to implicit "day 3-7" trigger. All others 80+. |
| Acceptance Criteria (SMART) | 91/100 | PASS | Strong Gherkin coverage (29 scenarios). Minor: could add edge case for simultaneous payment attempts. |
| Architecture Consistency | 97/100 | PASS | Consistent with project architecture. Minor: Specification used `trialStartedAt` where Architecture uses `hasUsedTrial`. |
| Pseudocode Coverage | 62/100 | **FAIL** | 7 HIGH, 8 MEDIUM, 7 LOW gaps. See details below. |

**Average: 83.2/100 (weighted)**
**Blocked: Pseudocode < 70 threshold**

---

## Pseudocode Gaps (Iteration 1)

### HIGH Priority (must fix)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | Specification used `trialStartedAt` field; Pseudocode used `hasUsedTrial` boolean | Aligned Specification to use `hasUsedTrial` (simpler, matches Architecture/Completion) |
| 2 | Response shape mismatch: Pseudocode used `isActive/isTrialActive/isCancelled`; Specification uses `status/canStartTrial/features/trialEndsAt` | Rewrote Pseudocode SubscriptionStatus to match Specification API contract |
| 3 | Specification defined separate `Subscription` model; Pseudocode/Architecture used `SubscriptionLog` | Aligned Specification to use `SubscriptionLog` (single event-sourcing table) |
| 4 | Error codes PAY_003-006 missing from Pseudocode | Added all 6 error codes with mapping table (Section 7) |
| 5 | Missing webhook signature verification function | Added `verifyWebhookSignature()` as pure function (Section 2.7) |
| 6 | No amount validation in `handleSuccessfulPayment` | Added amount + currency validation before processing (defense in depth) |
| 7 | Missing trial cancellation rejection (PAY_006) | Added trial check in `cancelSubscription()` before allowing cancel |

### MEDIUM Priority (fixed)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | No pure function extraction | Added Section 2: 8 pure functions (isTrialEligible, calculateTrialExpiry, calculateSubscriptionExpiry, deriveSubscriptionStatus, buildSubscriptionResponse, buildInvoicePayload, verifyWebhookSignature, shouldDowngradeWithActiveDuel) |
| 2 | `processPayment` didn't handle P2002 (duplicate charge) | Added try/catch for Prisma P2002 → idempotent return |
| 3 | `processExpirations` didn't separate trial vs paid expirations | Added counting by type + trial warning notifications |
| 4 | `cancelSubscription` returned `SubscriptionStatus` without `lostFeatures` | Added `lostFeatures: SUBSCRIPTION_FEATURES_LOST` to cancel response |
| 5 | `createInvoice` didn't check for `telegramId` | Added PAY_001 check before invoice creation |
| 6 | `getSubscriptionStatus` returned flat object | Now returns `{ subscription, trial }` matching Specification |
| 7 | Missing `payment_failed` log type | Added to SubscriptionLogType union |
| 8 | Webhook handler didn't pass raw body for signature verification | Updated signature to accept `(update, rawBody, signatureHeader)` |

### LOW Priority (accepted)

| # | Gap | Notes |
|---|-----|-------|
| 1 | No `lastExpiredAt` in expired user status response | Derived: expired users have `expiresAt: null`, `status: "expired"`. Frontend can show generic message. |
| 2 | Cron response shape differs slightly (Spec: `processed.trialsExpired`, Pseudo: `trialsExpired`) | Implementation will use the Pseudocode shape (flatter). |
| 3 | Webhook route path: Spec uses `/api/subscription/webhook`, Architecture uses `/api/subscription/webhook` | Already consistent. |
| 4 | No explicit Redis cache invalidation for subscription status on payment | Added `REDIS.DEL` in processPayment. Status cache is separate concern (60s TTL, acceptable staleness). |
| 5 | Missing `Subscription` model → no `periodStart`/`periodEnd` tracking | SubscriptionLog is sufficient. Period is derived from User.subscriptionExpires. |
| 6 | No TG_WEBHOOK_SECRET mentioned in Pseudocode | Architecture.md covers this env var. Pseudocode references bot token hash instead. |
| 7 | US-P01 "day 3-7" trigger is implicit | Paywall triggers are already handled by existing feature gates (LESSON_001, DUEL_001, coach check). |

---

## Iteration 2 Results (after fixes)

All 7 HIGH and 8 MEDIUM gaps resolved. Re-evaluation:

| Validator | Score | Status |
|-----------|:-----:|:------:|
| User Stories (INVEST) | 82.8/100 | PASS |
| Acceptance Criteria (SMART) | 91/100 | PASS |
| Architecture Consistency | 98/100 | PASS (aligned data model) |
| Pseudocode Coverage | 93/100 | **PASS** |

**Average: 91.2/100**
**No BLOCKED items**

---

## Cross-Reference Check

| Specification Concept | Pseudocode Function | Architecture File | Status |
|-----------------------|--------------------|-------------------|--------|
| US-P01: Start trial | `startTrial()` | `subscription-engine.ts` | Covered |
| US-P02: Pay via Stars | `createInvoice()` + `processPayment()` | `subscription-engine.ts` + `telegram-payments.ts` | Covered |
| US-P03: View status | `getSubscriptionStatus()` | `subscription-engine.ts` | Covered |
| US-P04: Webhook handler | `handleWebhookUpdate()` | `webhook/route.ts` | Covered |
| US-P05: Cancel | `cancelSubscription()` | `subscription-engine.ts` | Covered |
| US-P06: Paywall page | `checkPaywall()` + `getTrialInfo()` | `paywall/page.tsx` | Covered |
| PAY_001-006 errors | All mapped in Section 7 | `errors.ts` | Covered |
| Cron expiration | `processExpirations()` | `cron/route.ts` | Covered |
| Webhook signature | `verifyWebhookSignature()` | `webhook/route.ts` | Covered |
| Active duel grace | `shouldDowngradeWithActiveDuel()` | `subscription-engine.ts` | Covered |

---

## Conclusion

**Validation PASSED** after 2 iterations. All documents are now internally consistent:
- Specification and Pseudocode use the same data model (`hasUsedTrial`, `subscriptionCancelledAt`, `SubscriptionLog`)
- Pseudocode covers all 6 user stories, 6 error codes, webhook security, and cron logic
- Architecture file structure aligns with Pseudocode function locations
- 8 pure functions extracted for unit testability
- Ready for Phase 3: IMPLEMENT
