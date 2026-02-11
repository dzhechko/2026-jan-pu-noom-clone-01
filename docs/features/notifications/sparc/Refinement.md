# Refinement: Notifications (F8)

## 1. Error Handling Matrix

| Code | HTTP | Trigger | User Message | System Action |
|------|:----:|---------|-------------|---------------|
| NOTIF_001 | 503 | Telegram API unreachable | "Уведомления временно недоступны" | Log error, skip user, continue batch |
| NOTIF_002 | 400 | Invalid preference key in PATCH | "Неверный параметр уведомлений" | Return validation errors |

## 2. Edge Cases

| # | Case | Expected Behavior |
|---|------|-------------------|
| 1 | User has no telegramId (email-only) | Skip silently, no error |
| 2 | User blocked the bot (403 from TG) | Log as "failed", don't retry, mark in metadata |
| 3 | Telegram returns 429 (rate limit) | Wait retry_after seconds, retry once |
| 4 | Telegram returns 5xx (server error) | Log as "failed", don't retry |
| 5 | User in timezone UTC+12 (edge) | Correctly compute local hour from IANA timezone |
| 6 | User has no timezone set | Default to "Europe/Moscow" |
| 7 | Cron runs twice in same hour (idempotent) | Redis dedup prevents double-send |
| 8 | User already received 3 notifications today | Skip, log as "skipped" |
| 9 | Notification during quiet hours (22-08) | Skip, don't queue for later |
| 10 | User disabled specific notification type | Skip, respect prefs |
| 11 | Concurrent cron executions | Redis dedup ensures at-most-once delivery |
| 12 | User created today (no streak record) | Don't send streak_risk or churn |
| 13 | Malformed User.settings JSON | Use defaults, don't crash |
| 14 | CRON_SECRET not configured | Return 401, log warning |

## 3. Test Strategy

### Unit Tests (notification-engine.test.ts)

| Test ID | Function | Scenario |
|---------|----------|----------|
| UT-N01 | getNotificationTemplateText | Returns correct text for each type |
| UT-N02 | getNotificationTemplateText | Interpolates variables (streak count, name) |
| UT-N03 | isQuietHours | Returns true for 22:00-07:59 |
| UT-N04 | isQuietHours | Returns false for 08:00-21:59 |
| UT-N05 | isQuietHours | Handles different timezones correctly |
| UT-N06 | isLocalHourWindow | Matches target hour in user's timezone |
| UT-N07 | isLocalHourWindow | Returns false outside window |
| UT-N08 | getPreferenceKey | Maps notification type to pref key |
| UT-N09 | shouldSendNotification | Returns false when pref disabled |
| UT-N10 | shouldSendNotification | Returns false during quiet hours |
| UT-N11 | shouldSendNotification | Returns true when all checks pass |
| UT-N12 | parseNotificationPrefs | Returns defaults for empty settings |
| UT-N13 | parseNotificationPrefs | Merges partial prefs with defaults |

### Validator Tests (notifications.test.ts)

| Test ID | Schema | Scenario |
|---------|--------|----------|
| VT-N01 | prefsUpdateSchema | Accepts valid partial update |
| VT-N02 | prefsUpdateSchema | Accepts timezone string |
| VT-N03 | prefsUpdateSchema | Rejects invalid timezone |
| VT-N04 | prefsUpdateSchema | Rejects non-boolean pref values |
| VT-N05 | prefsUpdateSchema | Accepts empty object (no-op) |

### Integration Tests (requires DB)

| Test ID | Route | Scenario |
|---------|-------|----------|
| IT-N01 | GET /api/notifications/preferences | Returns default prefs for new user |
| IT-N02 | PATCH /api/notifications/preferences | Updates lessonReminder to false |
| IT-N03 | PATCH /api/notifications/preferences | Updates timezone |
| IT-N04 | POST /api/notifications/cron | Rejects without X-Cron-Secret |
| IT-N05 | POST /api/notifications/cron | Returns send counts |

## 4. Performance Considerations

| Concern | Solution |
|---------|----------|
| Cron queries all users every hour | Index on `streaks.last_active_date`, `notification_logs.sent_at` |
| Telegram rate limit 30/sec | Sleep 35ms between sends; batch size ≤ 1000 per cron run |
| Redis memory for dedup keys | TTL 24h auto-cleanup; ~100 bytes/key × 10K users = 1MB |
| NotificationLog table growth | Partition by month or add retention policy (delete > 90 days) |

## 5. Security Hardening

- Cron endpoint: `X-Cron-Secret` constant-time comparison
- No user PII in NotificationLog.metadata (only userId reference)
- TG_BOT_TOKEN never in client-side code or API responses
- Preferences API rate-limited (general 100/min)
- Input validation via Zod on all PATCH body fields

## 6. Monitoring

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| `notif.sent.count` | < 50% of expected per hour | Check cron health |
| `notif.failed.count` | > 10% of attempts | Check TG API status |
| `notif.blocked.count` | > 5% of user base | Review message content/frequency |
| `notif.cron.duration` | > 5 minutes | Optimize queries or increase batch parallelism |
