# Completion: Notifications (F8)

## 1. Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `TG_BOT_TOKEN` | Yes | — | Telegram bot token (already exists) |
| `CRON_SECRET` | Yes | — | Cron endpoint auth (already exists) |
| `MINI_APP_URL` | Yes | — | Base URL for deep links in notifications |

## 2. Database Migration

```bash
npx prisma migrate dev --name add-notification-logs
```

Creates `notification_logs` table with indexes.

## 3. Cron Setup

### Option A: External cron (VPS crontab)
```cron
0 * * * * curl -s -X POST https://app.vesna.ru/api/notifications/cron -H "X-Cron-Secret: $CRON_SECRET"
```

### Option B: GitHub Actions scheduled workflow
```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.APP_URL }}/api/notifications/cron \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

## 4. Deployment Checklist

- [ ] `TG_BOT_TOKEN` set in production .env
- [ ] `CRON_SECRET` set in production .env
- [ ] `MINI_APP_URL` set in production .env
- [ ] Run database migration
- [ ] Set up hourly cron job
- [ ] Verify bot can send messages (test with known chatId)
- [ ] Monitor first hour of sends for errors
- [ ] Check NotificationLog for successful deliveries

## 5. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Disable cron job (comment out crontab or disable GH Actions) |
| 2 | Revert migration: `npx prisma migrate resolve --rolled-back add-notification-logs` |
| 3 | Remove notification hooks from duel routes (git revert) |
| 4 | Deploy previous version |

Notifications are additive and non-blocking — disabling cron stops all scheduled sends immediately. Fire-and-forget hooks in duel routes fail silently.

## 6. Implementation Order

| Step | Files | Depends On |
|------|-------|------------|
| 1 | Shared types + constants | — |
| 2 | Prisma schema + migration | — |
| 3 | Zod validators | — |
| 4 | telegram-bot.ts (TG API client) | — |
| 5 | notification-engine.ts | 1-4 |
| 6 | Unit tests | 5 |
| 7 | API routes (preferences + cron) | 5 |
| 8 | Duel event hooks | 5, 7 |
| 9 | Frontend preferences page (v2) | 7 |
