# PRD: Notifications (F8)

## Executive Summary

Push notifications for the Vesna platform delivered via Telegram Bot API. Automated reminders for lessons, streak protection, churn prevention, and duel events. Cron-based scheduled delivery with fire-and-forget event triggers.

## Problem

Users who don't receive timely reminders lose 70% of engagement within the first week. Without streak-at-risk warnings, 60% of streaks break at day 3-4. No automated way to re-engage churning users.

## Solution

Server-side notification engine that sends targeted Telegram bot messages based on user activity state:
- **Scheduled:** Cron-driven hourly batch processing (lesson reminders, streak warnings, churn prevention, weekly reports)
- **Event-driven:** Fire-and-forget inline calls from existing routes (duel events)

## Target Users

- All registered users with `telegramId` (primary audience)
- Notifications respect user preferences and timezone

## Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lesson reminder tap-through | 15%+ | Deep link clicks / sends |
| Streak saves from warnings | 30%+ | Streaks that continue after warning |
| Day-3 retention improvement | +20% | Cohort comparison pre/post |
| Bot block rate | < 5% | Failed sends / total sends |

## Scope

### MVP (Must)
- Telegram Bot API delivery
- Daily lesson reminder (10:00 local)
- Streak-at-risk warning (20:00 local)
- 2-day churn prevention nudge
- Duel accepted/completed notifications
- Notification preferences API
- Cron endpoint with dedup

### v2 (Should)
- Weekly report summary
- Notification preferences UI page
- 5-day churn with discount offer

### v3 (Could)
- OneSignal web push as additional channel
- 14-day churn with temporary premium grant
- A/B testing notification copy
- Engagement analytics dashboard

## Dependencies

- `TG_BOT_TOKEN` environment variable (already configured)
- `CRON_SECRET` environment variable (already configured)
- User.telegramId populated (done during Telegram auth)
- User.settings JSON field (already exists in schema)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users block bot | Medium | High | Monitor block rate, respect quiet hours, cap 3/day |
| Telegram API downtime | Low | Medium | Log failures, retry once, no user-facing error |
| Wrong timezone | Medium | Low | Default Moscow, auto-detect on first visit |
