# Architecture: Notifications (F8)

## 1. System Overview

```
┌──────────────────────────────────────────────────────┐
│                    Next.js API                        │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Cron     │  │ Event Hooks  │  │ Preferences   │  │
│  │ Endpoint │  │ (duels,etc)  │  │ API           │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
│       │               │                  │           │
│       ▼               ▼                  ▼           │
│  ┌─────────────────────────────────────────────┐     │
│  │        notification-engine.ts                │     │
│  │  sendNotification() ← prefs check, dedup,   │     │
│  │                       quiet hours, daily cap │     │
│  └──────────────────┬──────────────────────────┘     │
│                     │                                │
│            ┌────────┼────────┐                       │
│            ▼        ▼        ▼                       │
│       ┌────────┐ ┌──────┐ ┌───────────┐             │
│       │Telegram│ │Redis │ │PostgreSQL │             │
│       │Bot API │ │dedup │ │notif_logs │             │
│       └────────┘ └──────┘ └───────────┘             │
└──────────────────────────────────────────────────────┘
```

## 2. File Structure

```
apps/api/src/
├── lib/
│   ├── engines/
│   │   └── notification-engine.ts    # Core engine (send, prefs, templates)
│   ├── validators/
│   │   └── notifications.ts          # Zod schemas for preferences API
│   └── telegram-bot.ts               # Telegram Bot API HTTP client
├── app/
│   ├── api/
│   │   └── notifications/
│   │       ├── preferences/
│   │       │   └── route.ts          # GET + PATCH preferences
│   │       └── cron/
│   │           └── route.ts          # POST cron (scheduled sends)
│   └── profile/
│       └── notifications/
│           └── page.tsx              # Notification preferences UI (v2)
```

## 3. Data Model Changes

### New table: NotificationLog

```prisma
model NotificationLog {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  type      String   // lesson_reminder, streak_risk, churn_2d, etc.
  channel   String   @default("telegram")
  status    String   // sent, failed, skipped
  sentAt    DateTime @default(now()) @map("sent_at")
  metadata  Json     @default("{}")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type, sentAt])
  @@index([sentAt])
  @@map("notification_logs")
}
```

### Modified: User model

Add relation:
```prisma
notificationLogs NotificationLog[]
```

No schema change for settings — `User.settings` JSON already exists and will store:
```json
{
  "timezone": "Europe/Moscow",
  "notificationPrefs": {
    "lessonReminder": true,
    "streakRisk": true,
    "churnPrevention": true,
    "duelEvents": true,
    "weeklyReport": true
  }
}
```

## 4. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/notifications/preferences` | GET | JWT | Get user's notification prefs + timezone |
| `/api/notifications/preferences` | PATCH | JWT | Update notification prefs and/or timezone |
| `/api/notifications/cron` | POST | X-Cron-Secret | Trigger scheduled notification batch |

## 5. Integration Points

### Existing routes that call sendNotification():

| Route | Event | Notification Type |
|-------|-------|-------------------|
| `POST /api/duels/[id]/accept` | Opponent accepts duel | `duel_accepted` → challenger |
| `POST /api/duels/cron` (completeDuel) | Duel period ends | `duel_completed` → both players |

### Cron schedule:

| Job | Schedule | Types Processed |
|-----|----------|-----------------|
| `/api/notifications/cron` | Every hour `0 * * * *` | lesson_reminder, streak_risk, churn_2d, churn_5d, weekly_report |

## 6. Redis Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `notif:count:{userId}:{YYYY-MM-DD}` | 24h | Daily notification cap (max 3) |
| `notif:sent:{type}:{userId}:{YYYY-MM-DD}` | 24h | Dedup same-type-same-day |

## 7. Security

- Cron endpoint uses `X-Cron-Secret` header (same as duels/cron)
- Preferences API requires valid JWT
- Telegram bot token never exposed to client
- NotificationLog stores message text for audit but no PII beyond userId
- Rate limit: Telegram Bot API ≤30 msg/sec enforced via sleep between sends

## 8. Consistency with Project Architecture

- Follows existing pattern: engine in `lib/engines/`, validators in `lib/validators/`
- Cron route matches `duels/cron` pattern (X-Cron-Secret auth)
- Fire-and-forget hooks match duel score hook pattern (`.catch()`)
- Prisma model follows existing conventions (@@map, @map, snake_case DB columns)
- Zod validation on all API inputs
- Error codes follow existing NOTIF_001/002 pattern
