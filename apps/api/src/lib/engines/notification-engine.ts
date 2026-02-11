import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import type { NotificationType, NotificationPrefs } from "@vesna/shared";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TIMEZONE,
  NOTIFICATION_DAILY_CAP,
  NOTIFICATION_QUIET_START,
  NOTIFICATION_QUIET_END,
  NOTIFICATION_PREF_MAP,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_RATE_DELAY_MS,
} from "@vesna/shared";

// --- Helper functions (exported for testing) ---

export function getLocalHour(date: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(date);
    return parseInt(formatted, 10);
  } catch {
    // Invalid timezone — fallback to Moscow
    return getLocalHour(date, DEFAULT_TIMEZONE);
  }
}

export function isQuietHours(date: Date, timezone: string): boolean {
  const hour = getLocalHour(date, timezone);
  return hour >= NOTIFICATION_QUIET_START || hour < NOTIFICATION_QUIET_END;
}

export function isLocalHourWindow(
  date: Date,
  targetHour: number,
  timezone: string,
): boolean {
  const hour = getLocalHour(date, timezone);
  return hour === targetHour;
}

export function getPreferenceKey(
  type: NotificationType,
): keyof NotificationPrefs {
  return NOTIFICATION_PREF_MAP[type];
}

export function parseNotificationPrefs(
  settings: Record<string, unknown> | null,
): { preferences: NotificationPrefs; timezone: string } {
  try {
    const s = settings ?? {};
    const prefs = (s as Record<string, unknown>).notificationPrefs;
    const tz = (s as Record<string, unknown>).timezone;

    return {
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...((typeof prefs === "object" && prefs !== null ? prefs : {}) as Partial<NotificationPrefs>),
      },
      timezone: typeof tz === "string" ? tz : DEFAULT_TIMEZONE,
    };
  } catch {
    return {
      preferences: { ...DEFAULT_NOTIFICATION_PREFS },
      timezone: DEFAULT_TIMEZONE,
    };
  }
}

export function shouldSendNotification(
  prefs: NotificationPrefs,
  type: NotificationType,
  date: Date,
  timezone: string,
): boolean {
  // Check preference
  const prefKey = getPreferenceKey(type);
  if (!prefs[prefKey]) return false;

  // Check quiet hours
  if (isQuietHours(date, timezone)) return false;

  return true;
}

export function getNotificationTemplateText(
  type: NotificationType,
  data: Record<string, string | number>,
): { text: string; buttonText: string; buttonUrl: string } {
  const template = NOTIFICATION_TEMPLATES[type];
  return template(data);
}

// --- DB-dependent functions ---

export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, string | number> = {},
): Promise<void> {
  // 1. Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, settings: true },
  });

  if (!user || !user.telegramId) return;

  // 2. Check preferences
  const { preferences, timezone } = parseNotificationPrefs(
    user.settings as Record<string, unknown>,
  );
  const prefKey = getPreferenceKey(type);
  if (!preferences[prefKey]) return;

  // 3. Check daily cap
  const today = new Date().toISOString().slice(0, 10);
  const countKey = `notif:count:${userId}:${today}`;
  try {
    const count = await redis.get(countKey);
    if (count && parseInt(count, 10) >= NOTIFICATION_DAILY_CAP) return;
  } catch {
    // Redis unavailable — skip cap check
  }

  // 4. Check dedup (same type today)
  const dedupKey = `notif:sent:${type}:${userId}:${today}`;
  try {
    const exists = await redis.get(dedupKey);
    if (exists) return;
  } catch {
    // Redis unavailable — skip dedup
  }

  // 5. Check quiet hours
  const now = new Date();
  if (isQuietHours(now, timezone)) return;

  // 6. Build and send message
  const message = getNotificationTemplateText(type, data);
  const result = await sendTelegramMessage(user.telegramId, message);

  // 7. Log
  await prisma.notificationLog.create({
    data: {
      userId,
      type,
      channel: "telegram",
      status: result.success ? "sent" : "failed",
      metadata: { messageText: message.text, error: result.error },
    },
  });

  // 8. Update counters on success
  if (result.success) {
    try {
      await redis.incr(countKey);
      await redis.expire(countKey, 86400);
      await redis.setex(dedupKey, 86400, "1");
    } catch {
      // Redis unavailable
    }
  }
}

// --- Preferences API ---

export async function getNotificationPrefs(
  userId: string,
): Promise<{ preferences: NotificationPrefs; timezone: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  return parseNotificationPrefs(
    (user?.settings as Record<string, unknown>) ?? null,
  );
}

export async function updateNotificationPrefs(
  userId: string,
  updates: Partial<NotificationPrefs> & { timezone?: string },
): Promise<{ preferences: NotificationPrefs; timezone: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = ((user?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  // Merge preferences
  const currentPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...((settings.notificationPrefs as Partial<NotificationPrefs>) ?? {}),
  };

  const { timezone: newTimezone, ...prefUpdates } = updates;

  const newPrefs = { ...currentPrefs, ...prefUpdates };
  settings.notificationPrefs = newPrefs;

  if (newTimezone) {
    settings.timezone = newTimezone;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { settings: settings as Record<string, unknown> as never },
  });

  return {
    preferences: newPrefs,
    timezone: (settings.timezone as string) ?? DEFAULT_TIMEZONE,
  };
}

// --- Cron: scheduled notifications ---

interface CronStats {
  sent: Record<string, number>;
  skipped: number;
  failed: number;
}

export async function processScheduledNotifications(): Promise<CronStats> {
  const stats: CronStats = { sent: {}, skipped: 0, failed: 0 };
  const now = new Date();

  // --- Lesson Reminders (10:00 local) ---
  const allUsersForLesson = await prisma.user.findMany({
    where: { telegramId: { not: null } },
    select: {
      id: true,
      telegramId: true,
      settings: true,
      lessonProgress: {
        where: {
          completedAt: { gte: startOfLocalDay(now, DEFAULT_TIMEZONE) },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  for (const user of allUsersForLesson) {
    // Skip if already completed a lesson today
    if (user.lessonProgress.length > 0) {
      stats.skipped++;
      continue;
    }

    const tz = getUserTimezone(user.settings as Record<string, unknown>);
    if (!isLocalHourWindow(now, 10, tz)) {
      stats.skipped++;
      continue;
    }

    try {
      await sendNotification(user.id, "lesson_reminder", {});
      stats.sent.lesson_reminder = (stats.sent.lesson_reminder ?? 0) + 1;
    } catch {
      stats.failed++;
    }

    await sleep(NOTIFICATION_RATE_DELAY_MS);
  }

  // --- Streak At Risk (20:00 local, streak > 2) ---
  const usersForStreak = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      streak: {
        currentStreak: { gt: 2 },
        lastActiveDate: { lt: startOfLocalDay(now, DEFAULT_TIMEZONE) },
      },
    },
    select: {
      id: true,
      settings: true,
      streak: { select: { currentStreak: true } },
    },
  });

  for (const user of usersForStreak) {
    const tz = getUserTimezone(user.settings as Record<string, unknown>);
    if (!isLocalHourWindow(now, 20, tz)) {
      stats.skipped++;
      continue;
    }

    try {
      await sendNotification(user.id, "streak_risk", {
        streak: user.streak!.currentStreak,
      });
      stats.sent.streak_risk = (stats.sent.streak_risk ?? 0) + 1;
    } catch {
      stats.failed++;
    }

    await sleep(NOTIFICATION_RATE_DELAY_MS);
  }

  // --- Churn Prevention 2-day (10:00 local) ---
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const usersForChurn = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      OR: [
        {
          streak: {
            lastActiveDate: { lte: twoDaysAgo, gt: threeDaysAgo },
          },
        },
        { streak: null, createdAt: { lte: twoDaysAgo, gt: threeDaysAgo } },
      ],
    },
    select: { id: true, settings: true },
  });

  for (const user of usersForChurn) {
    const tz = getUserTimezone(user.settings as Record<string, unknown>);
    if (!isLocalHourWindow(now, 10, tz)) {
      stats.skipped++;
      continue;
    }

    try {
      await sendNotification(user.id, "churn_2d", {});
      stats.sent.churn_2d = (stats.sent.churn_2d ?? 0) + 1;
    } catch {
      stats.failed++;
    }

    await sleep(NOTIFICATION_RATE_DELAY_MS);
  }

  return stats;
}

// --- Internal helpers ---

function getUserTimezone(settings: Record<string, unknown> | null): string {
  try {
    return (typeof settings?.timezone === "string"
      ? settings.timezone
      : DEFAULT_TIMEZONE) as string;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function startOfLocalDay(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDate = formatter.format(date); // YYYY-MM-DD
  return new Date(localDate + "T00:00:00Z");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
