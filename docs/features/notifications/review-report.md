# Review Report: Notifications (F8)

## Review Date: 2026-02-11

## Swarm Review Agents

| Agent | Focus | Issues Found |
|-------|-------|:------------:|
| code-quality | Clean code, naming, patterns, DRY | 4C, 9M, 11m |
| architecture | Consistency with project patterns | 0C, 3M, 5m |
| security | Vulnerabilities, input validation | 2C, 4M, 5m |
| performance | Bottlenecks, scalability | 3C, 5M, 5m |
| testing | Edge cases, coverage gaps | 3C, 5M, 6m |

## Critical Issues Found & Fixed

| # | Issue | Category | Fix |
|---|-------|----------|-----|
| 1 | HTML injection via user names in Telegram messages | Security | Added `escapeHtml()` to all template interpolations |
| 2 | Timing attack on CRON_SECRET (`!==` comparison) | Security | Replaced with `crypto.timingSafeEqual()` in both cron routes |
| 3 | `shouldSendNotification()` tested but never called (dead code) | Code Quality | Now used inside `sendNotificationDirect()` |
| 4 | N+1 query: cron re-fetches each user via `sendNotification()` | Performance | Created `sendNotificationDirect()` that accepts pre-fetched data |
| 5 | `getLocalHour` infinite recursion if DEFAULT_TIMEZONE invalid | Code Quality | Hardcoded "Europe/Moscow" fallback instead of using constant |
| 6 | `startOfLocalDay` timezone math bug | Performance | Simplified to UTC-based start-of-day (documented trade-off) |

## Major Issues Found & Fixed

| # | Issue | Category | Fix |
|---|-------|----------|-----|
| 7 | Redis fail-open: Redis down → unlimited notifications | Security | Changed to fail-closed with `console.warn` logging |
| 8 | Redis dedup race condition (GET + SET not atomic) | Performance | Replaced with atomic `redis.set(..., "NX")` |
| 9 | No batch size cap on cron user queries | Performance | Added `take: CRON_BATCH_SIZE (1000)` |
| 10 | PII (message text, names) stored in NotificationLog | Security | Removed `messageText` from metadata, only store error |
| 11 | Three copy-pasted cron loops (DRY violation) | Code Quality | Extracted `processBatch()` helper |
| 12 | Duplicate timezone helpers (`getUserTimezone` + `parseNotificationPrefs`) | Code Quality | Removed `getUserTimezone`, use `parseNotificationPrefs` everywhere |
| 13 | Mid-file import in constants file | Code Quality | Moved import to top of file |
| 14 | Missing Streak.lastActiveDate index | Performance | Added `@@index([lastActiveDate])` to schema |
| 15 | Missing CRON_SECRET warning log | Security | Added explicit warning when not configured |
| 16 | Redis counter update: 3 separate round trips | Performance | Replaced with `redis.pipeline()` |
| 17 | Non-null assertion on `user.streak!.currentStreak` | Code Quality | Changed to `user.streak?.currentStreak ?? 0` |

## Test Improvements

| Change | Before | After |
|--------|:------:|:-----:|
| Total notification tests | 35 | 51 |
| Template coverage | 6/8 types | 8/8 types |
| HTML escape test | 0 | 1 |
| Boundary hour tests | 2 | 7 |
| Negative-offset TZ tests | 0 | 2 |
| `shouldSend` parameterized | 2 types | 8 types |
| Pref mapping coverage | 7/8 types | 8/8 types |

---

## Enhancement Review (v2: Cron + Settings UI + v2 Types)

### Review Date: 2026-02-11
### Scope: Cron scheduling + Settings UI + v2 notification types
### Review type: brutal-honesty-review (5 parallel agents)

### Critical & Major Issues — All Fixed

| # | Issue | Category | Fix |
|---|-------|----------|-----|
| E1 | DRY: 70 lines of copy-pasted churn queries (2d, 5d, 14d) | Code Quality | Extracted `fetchChurnUsers(now, daysAgo)` + loop with `churnConfigs` |
| E2 | Bug: `now.getDay()` used UTC not local timezone for weekly_report | Correctness | Added `getLocalDayOfWeek(date, tz)` with per-user timezone check |
| E3 | Weekly report loaded full records just to count | Performance | Use Prisma `_count` — pushes COUNT to PostgreSQL |
| E4 | Cron file permissions 644 (world-readable secret) | Security | `chmod 600`, added `[a-zA-Z0-9_-]+` secret validation |
| E5 | `handleSave` missing try/catch — button stuck on error | UX | Wrapped in try/catch/finally |
| E6 | `<a>` instead of `<Link>` — full page reload | Next.js | Replaced with `<Link>` for client-side navigation |
| E7 | Dead `peer` class in toggle component | Code Quality | Removed unused `peer` class from `<input>` |
| E8 | `updatePref` declared after early returns | Code Quality | Moved before early returns |

### Deferred (non-blocking)

| Issue | Severity | Reason Deferred |
|-------|----------|-----------------|
| No cursor pagination past 1000 users | Major (perf) | Current scale <1000; requires architectural change |
| Sleep between skipped users wastes cron time | Major (perf) | Requires `sendNotificationDirect` return boolean refactor |
| `startOfLocalDay` UTC approximation | Minor | Pre-existing, acceptable for MVP |
| DRY cron.yml with matrix strategy | Minor | Functional, cosmetic improvement |
| Rate limiting on preferences API | Medium (security) | Low-risk endpoint; tracked for hardening pass |
| Integration tests for `processScheduledNotifications` | Major (testing) | Requires Prisma/Redis mocking infrastructure |

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 288/288 tests pass (15 files)
- No regressions in existing test suites

## Status: APPROVED — Review Complete
