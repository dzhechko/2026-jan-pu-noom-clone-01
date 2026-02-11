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

// --- Constants ---

const CRON_BATCH_SIZE = 1000;

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
    // Invalid timezone — fallback to hardcoded Moscow (not DEFAULT_TIMEZONE to prevent infinite recursion)
    const formatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Moscow",
    }).format(date);
    return parseInt(formatted, 10);
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

export function parseNotificationPrefs(
  settings: Record<string, unknown> | null,
): { preferences: NotificationPrefs; timezone: string } {
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
}

export function shouldSendNotification(
  prefs: NotificationPrefs,
  type: NotificationType,
  date: Date,
  timezone: string,
): boolean {
  const prefKey = NOTIFICATION_PREF_MAP[type];
  if (!prefs[prefKey]) return false;
  if (isQuietHours(date, timezone)) return false;
  return true;
}

export function getNotificationTemplateText(
  type: NotificationType,
  data: Record<string, string | number>,
): { text: string; buttonText: string; buttonUrl: string } {
  return NOTIFICATION_TEMPLATES[type](data);
}

// --- Core send (internal, accepts pre-fetched user data to avoid N+1) ---

async function sendNotificationDirect(
  userId: string,
  telegramId: string,
  preferences: NotificationPrefs,
  timezone: string,
  type: NotificationType,
  data: Record<string, string | number>,
): Promise<void> {
  // 1. Check preferences + quiet hours via shouldSendNotification
  if (!shouldSendNotification(preferences, type, new Date(), timezone)) return;

  // 2. Check daily cap (fail-closed: skip if Redis unavailable)
  const today = getLocalDateString(new Date(), timezone);
  const countKey = `notif:count:${userId}:${today}`;
  try {
    const count = await redis.get(countKey);
    if (count && parseInt(count, 10) >= NOTIFICATION_DAILY_CAP) return;
  } catch {
    console.warn("[notification] Redis unavailable for daily cap, skipping send (fail-closed)");
    return;
  }

  // 3. Atomic dedup (SETNX — prevents race conditions)
  const dedupKey = `notif:sent:${type}:${userId}:${today}`;
  try {
    const wasSet = await redis.set(dedupKey, "1", "EX", 86400, "NX");
    if (!wasSet) return; // Already sent this type today
  } catch {
    console.warn("[notification] Redis unavailable for dedup, skipping send (fail-closed)");
    return;
  }

  // 4. Build and send message
  const message = getNotificationTemplateText(type, data);
  const result = await sendTelegramMessage(telegramId, message);

  // 5. Log (no PII — only type and error)
  await prisma.notificationLog.create({
    data: {
      userId,
      type,
      channel: "telegram",
      status: result.success ? "sent" : "failed",
      metadata: { error: result.error ?? null },
    },
  });

  // 6. Update daily counter on success
  if (result.success) {
    try {
      const pipeline = redis.pipeline();
      pipeline.incr(countKey);
      pipeline.expire(countKey, 86400);
      await pipeline.exec();
    } catch {
      // Counter update non-critical — dedup key already set
    }
  }
}

// --- Public API: send notification by userId (for event-driven hooks) ---

export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, string | number> = {},
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, settings: true },
  });

  if (!user || !user.telegramId) return;

  const { preferences, timezone } = parseNotificationPrefs(
    user.settings as Record<string, unknown>,
  );

  await sendNotificationDirect(userId, user.telegramId, preferences, timezone, type, data);
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

  const currentPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...((settings.notificationPrefs as Partial<NotificationPrefs>) ?? {}),
  };

  const { timezone: newTimezone, ...prefUpdates } = updates;

  const newPrefs = { ...currentPrefs, ...prefUpdates };
  settings.notificationPrefs = newPrefs;

  if (newTimezone !== undefined) {
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

interface CronUser {
  id: string;
  telegramId: string | null;
  settings: unknown;
}

async function processBatch(
  users: CronUser[],
  targetHour: number,
  type: NotificationType,
  now: Date,
  stats: CronStats,
  getData: (user: CronUser) => Record<string, string | number>,
): Promise<void> {
  for (const user of users) {
    if (!user.telegramId) {
      stats.skipped++;
      continue;
    }

    const { preferences, timezone } = parseNotificationPrefs(
      user.settings as Record<string, unknown>,
    );

    if (!isLocalHourWindow(now, targetHour, timezone)) {
      stats.skipped++;
      continue;
    }

    try {
      await sendNotificationDirect(
        user.id,
        user.telegramId,
        preferences,
        timezone,
        type,
        getData(user),
      );
      stats.sent[type] = (stats.sent[type] ?? 0) + 1;
    } catch {
      stats.failed++;
    }

    await sleep(NOTIFICATION_RATE_DELAY_MS);
  }
}

export async function processScheduledNotifications(): Promise<CronStats> {
  const stats: CronStats = { sent: {}, skipped: 0, failed: 0 };
  const now = new Date();

  // --- Lesson Reminders (10:00 local) ---
  const usersForLesson = await prisma.user.findMany({
    where: { telegramId: { not: null } },
    select: {
      id: true,
      telegramId: true,
      settings: true,
      lessonProgress: {
        where: {
          completedAt: { gte: startOfLocalDay(now) },
        },
        select: { id: true },
        take: 1,
      },
    },
    take: CRON_BATCH_SIZE,
  });

  // Filter out users who already completed a lesson today
  const lessonEligible = usersForLesson.filter(
    (u) => u.lessonProgress.length === 0,
  );

  await processBatch(lessonEligible, 10, "lesson_reminder", now, stats, () => ({}));

  // --- Streak At Risk (20:00 local, streak > 2) ---
  const usersForStreak = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      streak: {
        currentStreak: { gt: 2 },
        lastActiveDate: { lt: startOfLocalDay(now) },
      },
    },
    select: {
      id: true,
      telegramId: true,
      settings: true,
      streak: { select: { currentStreak: true } },
    },
    take: CRON_BATCH_SIZE,
  });

  await processBatch(usersForStreak, 20, "streak_risk", now, stats, (user) => ({
    streak: (user as typeof usersForStreak[number]).streak?.currentStreak ?? 0,
  }));

  // --- Churn Prevention 2d / 5d / 14d (10:00 local) ---
  const churnConfigs: Array<[number, NotificationType]> = [
    [2, "churn_2d"],
    [5, "churn_5d"],
    [14, "churn_14d"],
  ];

  for (const [days, type] of churnConfigs) {
    const users = await fetchChurnUsers(now, days);
    await processBatch(users, 10, type, now, stats, () => ({}));
  }

  // --- Weekly Report (Sunday 18:00 local, per-user timezone check) ---
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const usersForWeekly = await prisma.user.findMany({
    where: { telegramId: { not: null } },
    select: {
      id: true,
      telegramId: true,
      settings: true,
      _count: {
        select: {
          lessonProgress: { where: { completedAt: { gte: sevenDaysAgo } } },
          mealLogs: { where: { loggedAt: { gte: sevenDaysAgo } } },
        },
      },
      streak: { select: { currentStreak: true } },
    },
    take: CRON_BATCH_SIZE,
  });

  // Filter to users whose local day is Sunday (not UTC-based getDay())
  const sundayUsers = usersForWeekly.filter((u) => {
    const { timezone } = parseNotificationPrefs(u.settings as Record<string, unknown>);
    return getLocalDayOfWeek(now, timezone) === 0;
  });

  await processBatch(sundayUsers, 18, "weekly_report", now, stats, (user) => {
    const u = user as typeof usersForWeekly[number];
    return {
      lessons: u._count.lessonProgress,
      meals: u._count.mealLogs,
      streak: u.streak?.currentStreak ?? 0,
    };
  });

  return stats;
}

// --- Internal helpers ---

async function fetchChurnUsers(now: Date, daysAgo: number): Promise<CronUser[]> {
  const since = new Date(now);
  since.setDate(since.getDate() - daysAgo);
  const before = new Date(now);
  before.setDate(before.getDate() - (daysAgo + 1));

  return prisma.user.findMany({
    where: {
      telegramId: { not: null },
      OR: [
        { streak: { lastActiveDate: { lte: since, gt: before } } },
        { streak: null, createdAt: { lte: since, gt: before } },
      ],
    },
    select: { id: true, telegramId: true, settings: true },
    take: CRON_BATCH_SIZE,
  });
}

export function getLocalDayOfWeek(date: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timezone,
    }).format(date);
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[formatted] ?? date.getDay();
  } catch {
    return date.getDay();
  }
}

function getLocalDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfLocalDay(now: Date): Date {
  // Use UTC-based approximation: start of today in UTC
  // This is used for "completed today" checks — a few hours of offset is acceptable
  // for the purpose of not re-reminding users who just completed a lesson
  const utcDate = now.toISOString().slice(0, 10);
  return new Date(utcDate + "T00:00:00Z");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
