# Solution Strategy: Notifications (F8)

## 1. First Principles Decomposition

**Core problem:** Users forget to engage daily → streaks break → motivation drops → churn.

**Fundamental truths:**
1. A reminder at the right time converts passive intent into action
2. Telegram bot messages have native presence — no install, no permission dialog
3. Over-notification causes mute/block — worse than no notification
4. Context-aware messages (streak count, lesson name) outperform generic ones by 2-3x

**Minimal viable solution:** Server sends Telegram bot message to user's chatId at scheduled times, with deep-link button back into Mini App.

## 2. SCQA Analysis

- **Situation:** Vesna has 14 CBT lessons, meal tracking, streaks, duels — but no automated re-engagement
- **Complication:** Without reminders, users who miss 2+ days rarely return; streaks break silently
- **Question:** How to re-engage users without causing notification fatigue in a Telegram-native context?
- **Answer:** Cron-based notification engine that sends targeted Telegram bot messages based on user activity state, with timezone awareness and daily caps

## 3. Key Contradictions (TRIZ)

| Contradiction | Resolution Principle |
|---|---|
| Must notify but not annoy | **Partial action** — send only when user hasn't acted today |
| Need real-time triggers but simple architecture | **Segmentation** — batch cron for scheduled, fire-and-forget for events |
| Want personalization but minimal DB queries | **Copying** — cache user activity state in Redis |
| Must handle timezones but users don't configure settings | **Self-service** — auto-detect via browser Intl API on first visit |

## 4. Notification Categories

| Category | Trigger | Timing | Priority |
|---|---|---|---|
| **lesson_reminder** | No lesson completed today | 10:00 local | Must |
| **streak_risk** | Streak > 2 AND no activity today | 20:00 local | Must |
| **churn_2d** | 2 days inactive | Morning after day 2 | Must |
| **churn_5d** | 5 days inactive | Morning after day 5 | Should |
| **churn_14d** | 14 days inactive | Morning after day 14 | Could |
| **duel_accepted** | Opponent accepts duel invite | Immediate (fire-and-forget) | Must |
| **duel_completed** | Duel 7-day period ends | Immediate (fire-and-forget) | Must |
| **weekly_report** | Sunday | 18:00 local | Should |

## 5. Two Delivery Modes

### Mode A: Scheduled (cron-driven)
- Cron runs hourly: `POST /api/notifications/cron`
- Queries eligible users per notification type
- Converts local times to UTC windows (e.g., 10:00 Moscow = 07:00 UTC)
- Sends via Telegram Bot API in batches (≤30/sec)
- Redis dedup: `notif:{type}:{userId}:{date}`

### Mode B: Event-driven (fire-and-forget)
- Called inline from existing routes (like duel score hooks)
- `sendNotification(userId, type, data)` — async, non-blocking
- Used for: duel_accepted, duel_completed
- No cron needed — triggered by user action

## 6. Data Model

```
User.settings (existing JSON field):
  + timezone: string (IANA, e.g. "Europe/Moscow")
  + notificationPrefs: {
      lessonReminder: boolean (default true)
      streakRisk: boolean (default true)
      churnPrevention: boolean (default true)
      duelEvents: boolean (default true)
      weeklyReport: boolean (default true)
    }

New table: NotificationLog
  - id: UUID
  - userId: FK → User
  - type: string (lesson_reminder, streak_risk, etc.)
  - channel: string ("telegram")
  - status: string ("sent", "failed", "skipped")
  - sentAt: DateTime
  - metadata: JSON (message content, error details)
  - @@index([userId, type, sentAt])
```

## 7. Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| User blocks bot | Can't send any notifications | Check delivery errors, mark user as `notifications_blocked` |
| Telegram API rate limit (429) | Messages delayed | Exponential backoff + queue with retry |
| Timezone detection fails | Wrong send time | Default to Europe/Moscow, allow manual override |
| Cron job fails | No notifications sent | Health check endpoint, alert on missed runs |
| Notification spam bug | Users mass-mute bot | Hard cap 3/day in Redis, idempotent dedup keys |
