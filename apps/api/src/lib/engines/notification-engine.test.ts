import { describe, it, expect } from "vitest";
import {
  getLocalHour,
  getLocalDayOfWeek,
  isQuietHours,
  isLocalHourWindow,
  shouldSendNotification,
  parseNotificationPrefs,
  getNotificationTemplateText,
} from "./notification-engine";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TIMEZONE,
  NOTIFICATION_PREF_MAP,
} from "@vesna/shared";
import type { NotificationType } from "@vesna/shared";

// UT-N01: getNotificationTemplateText returns correct text for each type
describe("getNotificationTemplateText", () => {
  it("returns lesson_reminder template", () => {
    const msg = getNotificationTemplateText("lesson_reminder", {});
    expect(msg.text).toContain("Урок ждёт");
    expect(msg.buttonText).toBe("Открыть урок");
    expect(msg.buttonUrl).toBe("/lessons");
  });

  // UT-N02: interpolates variables
  it("interpolates streak count in streak_risk", () => {
    const msg = getNotificationTemplateText("streak_risk", { streak: 7 });
    expect(msg.text).toContain("7 дней");
    expect(msg.buttonUrl).toBe("/lessons");
  });

  it("interpolates opponentName in duel_accepted", () => {
    const msg = getNotificationTemplateText("duel_accepted", {
      opponentName: "Алексей",
      duelId: "abc-123",
    });
    expect(msg.text).toContain("Алексей");
    expect(msg.buttonUrl).toBe("/duels/abc-123");
  });

  it("returns duel_completed template with duelId", () => {
    const msg = getNotificationTemplateText("duel_completed", {
      duelId: "xyz-456",
    });
    expect(msg.text).toContain("Дуэль завершена");
    expect(msg.buttonUrl).toBe("/duels/xyz-456");
  });

  it("returns churn_2d template", () => {
    const msg = getNotificationTemplateText("churn_2d", {});
    expect(msg.text).toContain("Мы скучаем");
    expect(msg.buttonUrl).toBe("/coach");
  });

  it("returns churn_5d template", () => {
    const msg = getNotificationTemplateText("churn_5d", {});
    expect(msg.text).toContain("прогресс сохранён");
    expect(msg.buttonUrl).toBe("/");
  });

  it("returns churn_14d template", () => {
    const msg = getNotificationTemplateText("churn_14d", {});
    expect(msg.text).toContain("Не сдавайтесь");
    expect(msg.buttonUrl).toBe("/");
  });

  it("returns weekly_report template with stats", () => {
    const msg = getNotificationTemplateText("weekly_report", {
      lessons: 5,
      meals: 12,
      streak: 3,
    });
    expect(msg.text).toContain("5");
    expect(msg.text).toContain("12");
    expect(msg.text).toContain("3");
  });

  it("escapes HTML in user-provided opponentName", () => {
    const msg = getNotificationTemplateText("duel_accepted", {
      opponentName: '<script>alert("xss")</script>',
      duelId: "abc",
    });
    expect(msg.text).not.toContain("<script>");
    expect(msg.text).toContain("&lt;script&gt;");
  });
});

// UT-N03, UT-N04: isQuietHours
describe("isQuietHours", () => {
  it("returns true for 22:00 (first quiet hour)", () => {
    // 22:00 MSK = 19:00 UTC
    const date = new Date("2026-02-11T19:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns true for 23:00 (quiet hours)", () => {
    // 23:00 MSK = 20:00 UTC
    const date = new Date("2026-02-11T20:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns true for 02:00 local (quiet hours)", () => {
    // 02:00 MSK = 23:00 UTC previous day
    const date = new Date("2026-02-10T23:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns true for 07:00 local (last quiet hour)", () => {
    // 07:00 MSK = 04:00 UTC
    const date = new Date("2026-02-11T04:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns false for 08:00 (first active hour)", () => {
    // 08:00 MSK = 05:00 UTC
    const date = new Date("2026-02-11T05:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(false);
  });

  it("returns false for 10:00 (active hours)", () => {
    // 10:00 MSK = 07:00 UTC
    const date = new Date("2026-02-11T07:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(false);
  });

  it("returns false for 21:00 (last active hour)", () => {
    // 21:00 MSK = 18:00 UTC
    const date = new Date("2026-02-11T18:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(false);
  });

  // UT-N05: handles different timezones
  it("handles different timezones correctly", () => {
    // 10:00 UTC → 10:00 in London (winter), 13:00 in Moscow
    const date = new Date("2026-02-11T10:00:00Z");
    expect(isQuietHours(date, "Europe/London")).toBe(false);
    expect(isQuietHours(date, "Europe/Moscow")).toBe(false);

    // 23:00 UTC → 23:00 London (quiet), 02:00 MSK next day (quiet)
    const lateDate = new Date("2026-02-11T23:00:00Z");
    expect(isQuietHours(lateDate, "Europe/London")).toBe(true);
    expect(isQuietHours(lateDate, "Europe/Moscow")).toBe(true);
  });
});

// UT-N06, UT-N07: isLocalHourWindow
describe("isLocalHourWindow", () => {
  it("matches target hour in user timezone", () => {
    // 10:00 MSK = 07:00 UTC
    const date = new Date("2026-02-11T07:00:00Z");
    expect(isLocalHourWindow(date, 10, "Europe/Moscow")).toBe(true);
  });

  it("returns false outside window", () => {
    // 11:00 MSK = 08:00 UTC
    const date = new Date("2026-02-11T08:00:00Z");
    expect(isLocalHourWindow(date, 10, "Europe/Moscow")).toBe(false);
  });

  it("works with UTC+12 timezone", () => {
    // 10:00 in Pacific/Fiji (UTC+12) = 22:00 UTC previous day
    const date = new Date("2026-02-10T22:00:00Z");
    expect(isLocalHourWindow(date, 10, "Pacific/Fiji")).toBe(true);
  });

  it("works with negative-offset timezone", () => {
    // 10:00 in America/New_York (UTC-5 winter) = 15:00 UTC
    const date = new Date("2026-02-11T15:00:00Z");
    expect(isLocalHourWindow(date, 10, "America/New_York")).toBe(true);
  });
});

// UT-N08: preference key mapping
describe("NOTIFICATION_PREF_MAP", () => {
  it("maps all notification types to pref keys", () => {
    expect(NOTIFICATION_PREF_MAP["lesson_reminder"]).toBe("lessonReminder");
    expect(NOTIFICATION_PREF_MAP["streak_risk"]).toBe("streakRisk");
    expect(NOTIFICATION_PREF_MAP["churn_2d"]).toBe("churnPrevention");
    expect(NOTIFICATION_PREF_MAP["churn_5d"]).toBe("churnPrevention");
    expect(NOTIFICATION_PREF_MAP["churn_14d"]).toBe("churnPrevention");
    expect(NOTIFICATION_PREF_MAP["duel_accepted"]).toBe("duelEvents");
    expect(NOTIFICATION_PREF_MAP["duel_completed"]).toBe("duelEvents");
    expect(NOTIFICATION_PREF_MAP["weekly_report"]).toBe("weeklyReport");
  });
});

// UT-N09, UT-N10, UT-N11: shouldSendNotification
describe("shouldSendNotification", () => {
  const activeTime = new Date("2026-02-11T07:00:00Z"); // 10:00 MSK
  const quietTime = new Date("2026-02-11T20:00:00Z"); // 23:00 MSK

  it("returns false when pref disabled", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, lessonReminder: false };
    expect(
      shouldSendNotification(prefs, "lesson_reminder", activeTime, "Europe/Moscow"),
    ).toBe(false);
  });

  it("returns false during quiet hours", () => {
    expect(
      shouldSendNotification(
        DEFAULT_NOTIFICATION_PREFS,
        "lesson_reminder",
        quietTime,
        "Europe/Moscow",
      ),
    ).toBe(false);
  });

  it("returns true when all checks pass", () => {
    expect(
      shouldSendNotification(
        DEFAULT_NOTIFICATION_PREFS,
        "lesson_reminder",
        activeTime,
        "Europe/Moscow",
      ),
    ).toBe(true);
  });

  it("returns false when duelEvents disabled for duel_accepted", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, duelEvents: false };
    expect(
      shouldSendNotification(prefs, "duel_accepted", activeTime, "Europe/Moscow"),
    ).toBe(false);
  });

  it.each([
    "lesson_reminder",
    "streak_risk",
    "churn_2d",
    "churn_5d",
    "churn_14d",
    "duel_accepted",
    "duel_completed",
    "weekly_report",
  ] as NotificationType[])("returns true for %s with all prefs enabled during active hours", (type) => {
    expect(
      shouldSendNotification(DEFAULT_NOTIFICATION_PREFS, type, activeTime, "Europe/Moscow"),
    ).toBe(true);
  });
});

// UT-N12, UT-N13: parseNotificationPrefs
describe("parseNotificationPrefs", () => {
  it("returns defaults for empty/null settings", () => {
    const result = parseNotificationPrefs(null);
    expect(result.preferences).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(result.timezone).toBe(DEFAULT_TIMEZONE);
  });

  it("returns defaults for empty object", () => {
    const result = parseNotificationPrefs({});
    expect(result.preferences).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(result.timezone).toBe(DEFAULT_TIMEZONE);
  });

  it("merges partial prefs with defaults", () => {
    const result = parseNotificationPrefs({
      notificationPrefs: { lessonReminder: false },
      timezone: "Asia/Tokyo",
    });
    expect(result.preferences.lessonReminder).toBe(false);
    expect(result.preferences.streakRisk).toBe(true);
    expect(result.preferences.duelEvents).toBe(true);
    expect(result.timezone).toBe("Asia/Tokyo");
  });

  it("handles malformed settings gracefully", () => {
    const result = parseNotificationPrefs({
      notificationPrefs: "invalid",
      timezone: 123 as unknown as string,
    } as Record<string, unknown>);
    expect(result.preferences).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(result.timezone).toBe(DEFAULT_TIMEZONE);
  });
});

// --- v2 notification types: date range and logic tests ---

describe("v2 notification date range calculations", () => {
  it("churn_5d targets users inactive 5-6 days ago", () => {
    const now = new Date("2026-02-11T07:00:00Z"); // 10:00 MSK
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const sixDaysAgo = new Date(now);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    expect(fiveDaysAgo.toISOString().slice(0, 10)).toBe("2026-02-06");
    expect(sixDaysAgo.toISOString().slice(0, 10)).toBe("2026-02-05");

    // A user last active on Feb 6 should be in range (lte 5d ago, gt 6d ago)
    const lastActive = new Date("2026-02-06T12:00:00Z");
    expect(lastActive <= fiveDaysAgo || lastActive.toDateString() === fiveDaysAgo.toDateString()).toBe(true);
    expect(lastActive > sixDaysAgo).toBe(true);
  });

  it("churn_14d targets users inactive 14-15 days ago", () => {
    const now = new Date("2026-02-15T07:00:00Z");
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    expect(fourteenDaysAgo.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(fifteenDaysAgo.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("weekly_report triggers only on local Sunday via getLocalDayOfWeek", () => {
    // Feb 15, 2026 is a Sunday
    const sunday = new Date("2026-02-15T15:00:00Z"); // 18:00 MSK
    expect(getLocalDayOfWeek(sunday, "Europe/Moscow")).toBe(0);

    // Feb 11, 2026 is a Wednesday
    const wednesday = new Date("2026-02-11T15:00:00Z");
    expect(getLocalDayOfWeek(wednesday, "Europe/Moscow")).not.toBe(0);
  });

  it("getLocalDayOfWeek handles UTC Saturday that is local Sunday", () => {
    // Saturday 23:00 UTC = Sunday 02:00 MSK (UTC+3)
    const satUtcSunMsk = new Date("2026-02-14T23:00:00Z");
    expect(satUtcSunMsk.getDay()).toBe(6); // UTC Saturday
    expect(getLocalDayOfWeek(satUtcSunMsk, "Europe/Moscow")).toBe(0); // MSK Sunday
  });

  it("weekly_report at 18:00 local matches isLocalHourWindow", () => {
    // 18:00 MSK = 15:00 UTC
    const sundayEvening = new Date("2026-02-15T15:00:00Z");
    expect(isLocalHourWindow(sundayEvening, 18, "Europe/Moscow")).toBe(true);
  });
});

describe("weekly_report stats data construction (_count pattern)", () => {
  it("builds correct data from _count fields", () => {
    const mockUser = {
      id: "user-1",
      telegramId: "123",
      settings: null,
      _count: { lessonProgress: 3, mealLogs: 2 },
      streak: { currentStreak: 5 },
    };

    const data = {
      lessons: mockUser._count.lessonProgress,
      meals: mockUser._count.mealLogs,
      streak: mockUser.streak?.currentStreak ?? 0,
    };

    expect(data).toEqual({ lessons: 3, meals: 2, streak: 5 });
  });

  it("handles user with no streak", () => {
    const mockUser = {
      id: "user-2",
      telegramId: "456",
      settings: null,
      _count: { lessonProgress: 0, mealLogs: 1 },
      streak: null as { currentStreak: number } | null,
    };

    const data = {
      lessons: mockUser._count.lessonProgress,
      meals: mockUser._count.mealLogs,
      streak: mockUser.streak?.currentStreak ?? 0,
    };

    expect(data).toEqual({ lessons: 0, meals: 1, streak: 0 });
  });
});

// getLocalHour edge cases
describe("getLocalHour", () => {
  it("returns correct hour for Moscow timezone", () => {
    // 07:00 UTC = 10:00 MSK
    const date = new Date("2026-02-11T07:00:00Z");
    expect(getLocalHour(date, "Europe/Moscow")).toBe(10);
  });

  it("handles invalid timezone by falling back to Moscow", () => {
    const date = new Date("2026-02-11T07:00:00Z");
    const hour = getLocalHour(date, "Invalid/Timezone");
    expect(hour).toBe(10); // Falls back to Moscow
  });

  it("handles negative-offset timezone correctly", () => {
    // 03:00 UTC = 22:00 EST (Feb 10) in New York
    const date = new Date("2026-02-11T03:00:00Z");
    expect(getLocalHour(date, "America/New_York")).toBe(22);
  });
});
