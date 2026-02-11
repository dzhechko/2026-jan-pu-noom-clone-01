# Pseudocode: Notifications (F8)

## 1. Data Structures

```typescript
// Notification types
type NotificationType =
  | "lesson_reminder"
  | "streak_risk"
  | "churn_2d"
  | "churn_5d"
  | "churn_14d"
  | "duel_accepted"
  | "duel_completed"
  | "weekly_report";

// User notification preferences (stored in User.settings JSON)
interface NotificationPrefs {
  lessonReminder: boolean;   // default true
  streakRisk: boolean;       // default true
  churnPrevention: boolean;  // default true
  duelEvents: boolean;       // default true
  weeklyReport: boolean;     // default true
}

// Default preferences for new users
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  lessonReminder: true,
  streakRisk: true,
  churnPrevention: true,
  duelEvents: true,
  weeklyReport: true,
};

// Notification message template
interface NotificationMessage {
  text: string;              // Markdown V2 formatted
  buttonText: string;        // Inline keyboard button label
  buttonUrl: string;         // Deep link into Mini App
}

// Notification templates map
const NOTIFICATION_TEMPLATES: Record<NotificationType, (data: any) => NotificationMessage>
```

## 2. Core Engine: notification-engine.ts

### 2.1 sendTelegramMessage(telegramId, message)

```
FUNCTION sendTelegramMessage(telegramId, message):
  INPUT: telegramId (string), message (NotificationMessage)
  OUTPUT: { success: boolean, error?: string }

  url = "https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"

  body = {
    chat_id: telegramId,
    text: message.text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{
        text: message.buttonText,
        web_app: { url: MINI_APP_BASE_URL + message.buttonUrl }
      }]]
    }
  }

  TRY:
    response = HTTP.POST(url, body)
    IF response.status == 200 THEN RETURN { success: true }
    IF response.status == 403 THEN
      // User blocked bot — mark for suppression
      RETURN { success: false, error: "blocked" }
    IF response.status == 429 THEN
      retryAfter = response.retry_after
      WAIT(retryAfter * 1000)
      RETURN sendTelegramMessage(telegramId, message)  // retry once
    RETURN { success: false, error: response.description }
  CATCH error:
    RETURN { success: false, error: error.message }
```

### 2.2 sendNotification(userId, type, data)

```
FUNCTION sendNotification(userId, type, data):
  INPUT: userId (string), type (NotificationType), data (object)
  OUTPUT: void (fire-and-forget)

  // 1. Get user
  user = DB.findUnique("users", { id: userId })
  IF user == NULL OR user.telegramId == NULL THEN RETURN

  // 2. Check preferences
  prefs = user.settings.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS
  prefKey = PREF_MAP[type]  // e.g. "duel_accepted" → "duelEvents"
  IF prefs[prefKey] == false THEN RETURN

  // 3. Check daily cap (max 3/day)
  countKey = "notif:count:{userId}:{TODAY}"
  count = REDIS.GET(countKey) ?? 0
  IF count >= 3 THEN RETURN

  // 4. Check dedup (same type today)
  dedupKey = "notif:sent:{type}:{userId}:{TODAY}"
  IF REDIS.GET(dedupKey) THEN RETURN

  // 5. Check quiet hours (22:00–08:00 local)
  timezone = user.settings.timezone ?? "Europe/Moscow"
  localHour = getLocalHour(NOW(), timezone)
  IF localHour >= 22 OR localHour < 8 THEN RETURN

  // 6. Build and send message
  template = NOTIFICATION_TEMPLATES[type]
  message = template(data)
  result = sendTelegramMessage(user.telegramId, message)

  // 7. Log and update counters
  DB.create("notification_logs", {
    userId, type, channel: "telegram",
    status: result.success ? "sent" : "failed",
    sentAt: NOW(),
    metadata: { messageText: message.text, error: result.error }
  })

  IF result.success THEN
    REDIS.INCR(countKey)
    REDIS.EXPIRE(countKey, 86400)
    REDIS.SETEX(dedupKey, 86400, "1")
```

### 2.3 getNotificationPrefs(userId)

```
FUNCTION getNotificationPrefs(userId):
  INPUT: userId (string)
  OUTPUT: { preferences: NotificationPrefs, timezone: string }

  user = DB.findUnique("users", { id: userId, select: { settings: true } })
  settings = user.settings as JSON

  RETURN {
    preferences: settings.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS,
    timezone: settings.timezone ?? "Europe/Moscow"
  }
```

### 2.4 updateNotificationPrefs(userId, updates)

```
FUNCTION updateNotificationPrefs(userId, updates):
  INPUT: userId (string), updates (Partial<NotificationPrefs> & { timezone?: string })
  OUTPUT: { preferences: NotificationPrefs, timezone: string }

  user = DB.findUnique("users", { id: userId })
  settings = user.settings as JSON

  // Merge preferences
  currentPrefs = settings.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS
  IF updates has pref keys THEN
    newPrefs = { ...currentPrefs, ...pickPrefKeys(updates) }
    settings.notificationPrefs = newPrefs

  IF updates.timezone THEN
    settings.timezone = updates.timezone

  DB.update("users", { id: userId }, { settings })

  RETURN {
    preferences: settings.notificationPrefs,
    timezone: settings.timezone ?? "Europe/Moscow"
  }
```

## 3. Cron Job: processScheduledNotifications()

```
FUNCTION processScheduledNotifications():
  INPUT: none (called by POST /api/notifications/cron)
  OUTPUT: { sent: Record<type, number>, skipped: number, failed: number }

  stats = { sent: {}, skipped: 0, failed: 0 }
  now = NOW()

  // --- Lesson Reminders (10:00 local) ---
  eligibleForLesson = DB.query("""
    SELECT u.id, u.telegram_id, u.settings
    FROM users u
    WHERE u.telegram_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM lesson_progress lp
      WHERE lp.user_id = u.id
      AND lp.completed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE
        COALESCE(u.settings->>'timezone', 'Europe/Moscow'))
    )
  """)

  FOR user IN eligibleForLesson:
    IF isLocalHourWindow(user, 10, now) THEN
      sendNotification(user.id, "lesson_reminder", {})
      stats.sent.lesson_reminder = (stats.sent.lesson_reminder ?? 0) + 1
    ELSE
      stats.skipped++

  // --- Streak At Risk (20:00 local, streak > 2) ---
  eligibleForStreak = DB.query("""
    SELECT u.id, u.telegram_id, u.settings, s.current_streak
    FROM users u
    JOIN streaks s ON s.user_id = u.id
    WHERE u.telegram_id IS NOT NULL
    AND s.current_streak > 2
    AND s.last_active_date < DATE_TRUNC('day', NOW() AT TIME ZONE
      COALESCE(u.settings->>'timezone', 'Europe/Moscow'))
  """)

  FOR user IN eligibleForStreak:
    IF isLocalHourWindow(user, 20, now) THEN
      sendNotification(user.id, "streak_risk", { streak: user.current_streak })
      stats.sent.streak_risk = (stats.sent.streak_risk ?? 0) + 1

  // --- Churn Prevention (2 days, morning 10:00) ---
  eligibleForChurn2d = DB.query("""
    SELECT u.id, u.telegram_id, u.settings
    FROM users u
    LEFT JOIN streaks s ON s.user_id = u.id
    WHERE u.telegram_id IS NOT NULL
    AND (s.last_active_date IS NULL OR s.last_active_date <= NOW() - INTERVAL '2 days')
    AND (s.last_active_date IS NULL OR s.last_active_date > NOW() - INTERVAL '3 days')
  """)

  FOR user IN eligibleForChurn2d:
    IF isLocalHourWindow(user, 10, now) THEN
      sendNotification(user.id, "churn_2d", {})
      stats.sent.churn_2d = (stats.sent.churn_2d ?? 0) + 1

  // Rate limiting: sleep 35ms between sends (≈28/sec < 30/sec limit)
  // Applied inside sendTelegramMessage via queue

  RETURN stats


FUNCTION isLocalHourWindow(user, targetHour, now):
  // Returns true if current local hour matches target (±30 min window for hourly cron)
  timezone = user.settings?.timezone ?? "Europe/Moscow"
  localTime = convertToTimezone(now, timezone)
  localHour = localTime.getHours()
  localMinute = localTime.getMinutes()

  RETURN localHour == targetHour AND localMinute < 59
```

## 4. Notification Templates

```
TEMPLATES:

lesson_reminder:
  text: "📚 <b>Урок ждёт!</b>\n3 минуты для новых привычек"
  buttonText: "Открыть урок"
  buttonUrl: "/lessons"

streak_risk:
  text: "🔥 <b>Streak на кону!</b>\nВаша серия {streak} дней. Не потеряйте!"
  buttonText: "Продолжить серию"
  buttonUrl: "/lessons"

churn_2d:
  text: "👋 <b>Мы скучаем!</b>\nВаш AI-коуч подготовил новый совет"
  buttonText: "Поговорить с коучем"
  buttonUrl: "/coach"

churn_5d:
  text: "💪 <b>Ваш прогресс сохранён!</b>\nВернитесь и продолжите путь к цели"
  buttonText: "Вернуться"
  buttonUrl: "/"

duel_accepted:
  text: "⚔️ <b>Дуэль началась!</b>\n{opponentName} принял ваш вызов"
  buttonText: "К дуэли"
  buttonUrl: "/duels/{duelId}"

duel_completed:
  text: "🏆 <b>Дуэль завершена!</b>\nСмотри результаты"
  buttonText: "Результаты"
  buttonUrl: "/duels/{duelId}"

weekly_report:
  text: "📊 <b>Итоги недели</b>\nУроков: {lessons} | Приёмов пищи: {meals} | Серия: {streak}"
  buttonText: "Подробнее"
  buttonUrl: "/"
```

## 5. Preference-to-Type Mapping

```
PREF_MAP = {
  lesson_reminder  → "lessonReminder",
  streak_risk      → "streakRisk",
  churn_2d         → "churnPrevention",
  churn_5d         → "churnPrevention",
  churn_14d        → "churnPrevention",
  duel_accepted    → "duelEvents",
  duel_completed   → "duelEvents",
  weekly_report    → "weeklyReport",
}
```
