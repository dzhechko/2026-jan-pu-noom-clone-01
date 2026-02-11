# Specification: Notifications (F8)

## User Stories

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|-------------|-----------|:--------:|:------:|
| US-N01 | пользователь | получать напоминание об уроке в 10:00 | не забывал заниматься каждый день | Must | 5 |
| US-N02 | пользователь со streak > 2 | получать предупреждение в 20:00 если не занимался | не потерял серию | Must | 3 |
| US-N03 | неактивный пользователь (2 дня) | получить напоминание от коуча | вернулся к программе | Must | 3 |
| US-N04 | участник дуэли | получать уведомление о принятии дуэли | знал что соперник принял вызов | Must | 2 |
| US-N05 | участник дуэли | получать уведомление о завершении дуэли | посмотрел результаты | Must | 2 |
| US-N06 | пользователь | управлять типами уведомлений | отключил ненужные | Should | 3 |
| US-N07 | пользователь | получать еженедельный отчёт по воскресеньям | видел свой прогресс | Should | 3 |
| US-N08 | неактивный пользователь (5+ дней) | получить мотивирующее сообщение | вернулся с новой мотивацией | Could | 2 |

**Total: 23 story points**

## Acceptance Criteria (Gherkin)

### US-N01: Daily Lesson Reminder

```gherkin
Scenario: User receives lesson reminder at 10:00 local
  Given I have not completed a lesson today
  And my timezone is "Europe/Moscow"
  When the cron job runs at 07:00 UTC (= 10:00 MSK)
  Then I receive a Telegram message:
    | title | "Урок ждёт! 📚" |
    | body  | "3 минуты для новых привычек" |
  And the message has an inline button "Открыть урок"
  And tapping the button opens the Mini App at /lessons

Scenario: User already completed lesson today
  Given I completed lesson 5 today at 09:30
  When the cron job runs at 10:00
  Then I do NOT receive a lesson reminder

Scenario: User disabled lesson reminders
  Given I set notificationPrefs.lessonReminder = false
  When the cron job runs
  Then I do NOT receive a lesson reminder
```

### US-N02: Streak At Risk

```gherkin
Scenario: Streak at risk warning at 20:00
  Given my current streak is 5 days
  And I have not completed any lesson or logged any meal today
  When the cron job runs at 17:00 UTC (= 20:00 MSK)
  Then I receive: "Streak на кону! 🔥 Ваша серия 5 дней. Не потеряйте!"
  And the message has a button "Продолжить серию"

Scenario: Low streak not warned
  Given my current streak is 1 day
  And I have not completed anything today
  When the cron job runs at 20:00
  Then I do NOT receive a streak warning (streak ≤ 2)
```

### US-N03: Churn Prevention (2 days)

```gherkin
Scenario: 2-day inactive user gets nudge
  Given I last completed an activity 2 days ago
  When the cron job runs the next morning
  Then I receive: "Мы скучаем! 👋 Ваш AI-коуч подготовил новый совет"
  And the message links to /coach
```

### US-N04/N05: Duel Events

```gherkin
Scenario: Challenger notified when opponent accepts
  Given I created a duel invite
  When my friend accepts the duel
  Then I receive: "Дуэль началась! ⚔️ {opponent_name} принял вызов"
  And the message links to /duels/{id}

Scenario: Both players notified on duel completion
  Given a duel between me and {opponent} just completed
  When the duel is finalized
  Then both players receive: "Дуэль завершена! 🏆 Смотри результаты"
  And the message links to /duels/{id}
```

### US-N06: Notification Preferences

```gherkin
Scenario: User disables streak notifications
  Given I am on the /profile/notifications page
  When I toggle off "Предупреждение о серии"
  Then my notificationPrefs.streakRisk is set to false
  And I no longer receive streak risk warnings

Scenario: Default preferences
  Given I just registered
  Then all notification types are enabled by default
```

## API Contracts

### 1. GET /api/notifications/preferences
**Auth:** Bearer JWT
**Response 200:**
```json
{
  "preferences": {
    "lessonReminder": true,
    "streakRisk": true,
    "churnPrevention": true,
    "duelEvents": true,
    "weeklyReport": true
  },
  "timezone": "Europe/Moscow"
}
```

### 2. PATCH /api/notifications/preferences
**Auth:** Bearer JWT
**Body:**
```json
{
  "lessonReminder": false,
  "timezone": "Asia/Vladivostok"
}
```
**Response 200:**
```json
{
  "preferences": { ... },
  "timezone": "Asia/Vladivostok"
}
```

### 3. POST /api/notifications/cron
**Auth:** `X-Cron-Secret` header
**Response 200:**
```json
{
  "sent": { "lesson_reminder": 42, "streak_risk": 15, "churn_2d": 7 },
  "skipped": 120,
  "failed": 1
}
```

### 4. Internal: sendNotification(userId, type, data)
**Not an API route** — called from within other routes (duel accept, duel complete).
Fire-and-forget async function.

## Error Codes

| Code | HTTP | Trigger | Message |
|------|:----:|---------|---------|
| NOTIF_001 | 503 | Telegram API unreachable | "Уведомления временно недоступны" |
| NOTIF_002 | 400 | Invalid preference key | "Неверный параметр уведомлений" |

## Non-Functional Requirements

- **Latency:** Cron job completes within 5 minutes for ≤10,000 users
- **Reliability:** Failed sends logged but never crash the cron; retry once
- **Rate limiting:** Max 30 msg/sec to Telegram API; max 3 notifications/day per user
- **Quiet hours:** No sends between 22:00–08:00 local time
- **Idempotency:** Redis dedup keys prevent duplicate sends within same type+day
