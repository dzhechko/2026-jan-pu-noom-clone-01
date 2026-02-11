# Research Findings: Notifications (F8)

## 1. Delivery Channel Analysis

### Option A: OneSignal Web Push (Primary for non-Telegram users)
- **SDK:** `@onesignal/node-onesignal` (official Node.js SDK)
- **API:** `POST https://onesignal.com/api/v1/notifications`
- **Auth:** REST API Key + App ID (server-side)
- **Free tier:** 10,000 subscribers, unlimited notifications
- **Rate limit:** Max 10x subscriber count per 15 minutes
- **Targeting:** By `external_user_id` (maps to our `User.id`), segments, filters
- **Pros:** Handles service workers, retry logic, delivery tracking
- **Cons:** Requires HTTPS + service worker; Telegram WebView may block permission prompt

### Option B: Telegram Bot API (Primary for TG Mini App users)
- **API:** `POST https://api.telegram.org/bot{token}/sendMessage`
- **Auth:** Bot token from BotFather (env `TG_BOT_TOKEN`)
- **Rate limits:**
  - 1:1 chat: ~1 msg/sec (short bursts allowed)
  - Bulk broadcast: ~30 msg/sec (free), 1000 msg/sec (paid via BotFather)
  - 429 errors return `retry_after` header — must respect
- **Message format:** Markdown V2, inline keyboards, deep links
- **Pros:** Zero setup for TG users (already have chatId = telegramId); native in-app feel
- **Cons:** Users can mute bot; open rates 40% lower than native push; no rich media push

### Decision: **Telegram Bot API as primary channel**
**Rationale:** 100% of Vesna users come through Telegram Mini App. They already have `telegramId` stored. Telegram bot messages appear as native chat messages — no permission dialog needed. OneSignal adds complexity with minimal benefit for TG-only audience.

**Fallback:** If user has no `telegramId` (email-only registration), skip notification silently. OneSignal can be added later as v2 enhancement.

## 2. Telegram Bot Message Patterns

### Deep linking back to Mini App
```
https://t.me/{bot_username}?startapp={param}
```
- Tapping a bot message with inline button opens the Mini App directly
- `start_param` can encode destination: `lesson_5`, `duels`, `coach`

### Inline keyboard for actions
```json
{
  "reply_markup": {
    "inline_keyboard": [[
      { "text": "Открыть урок", "web_app": { "url": "https://app.vesna.ru/lessons" } }
    ]]
  }
}
```

## 3. Scheduling Architecture

### Option A: External cron (Vercel Cron, GitHub Actions)
- Triggers `POST /api/notifications/cron` on schedule
- Simple, no extra infrastructure
- Already used for duel cleanup (`/api/duels/cron`)

### Option B: BullMQ + Redis (job queue)
- Fine-grained scheduling per user
- Retry logic built in
- More complex, requires worker process

### Decision: **Cron-based batch processing** (same pattern as duels)
- `POST /api/notifications/cron` called hourly
- Queries users eligible for each notification type
- Sends in batches of 30/sec (Telegram rate limit)
- Redis dedup key prevents duplicate sends within same day
- Simple, fits existing architecture

## 4. Timezone Handling

### Sources of timezone data:
1. **Telegram `initData`** — `initDataUnsafe.user` does NOT include timezone
2. **User settings** — Store `timezone` in `User.settings` JSON field (already exists)
3. **Default:** `Europe/Moscow` (UTC+3) — 80%+ of Russian users

### Approach:
- On first Mini App open: detect via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Store in `User.settings.timezone`
- Cron job converts "10:00 local" to UTC before querying eligible users

## 5. Notification Fatigue Prevention

Based on industry research:
- **Max 3 notifications/day** per user (hard cap)
- **Quiet hours:** 22:00–08:00 local time (no sends)
- **Cooldown:** Min 2 hours between notifications of same type
- **Mute after ignore:** If user ignores 5 consecutive notifications, reduce frequency by 50%
- Redis counter: `notif:count:{userId}:{date}` with TTL 24h

## 6. Required Environment Variables

```
TG_BOT_TOKEN          # Already exists — Telegram bot token
ONESIGNAL_APP_ID      # Future v2 — not needed for MVP
ONESIGNAL_API_KEY     # Future v2 — not needed for MVP
CRON_SECRET           # Already exists — shared with duels cron
```

## Sources

- [OneSignal REST API Push Sample](https://github.com/OneSignalDevelopers/OneSignal-REST-API-Push-Sample)
- [OneSignal Node.js SDK](https://www.npmjs.com/package/onesignal-node)
- [Telegram Bot API FAQ — Rate Limits](https://core.telegram.org/bots/faq)
- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot Push Notification Service](https://kanishk.io/posts/telegram-push-notification-service/)
- [Telegram Rate Limits](https://gramio.dev/rate-limits)
