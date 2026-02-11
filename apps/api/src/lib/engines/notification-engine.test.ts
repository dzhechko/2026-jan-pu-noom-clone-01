import { describe, it, expect } from "vitest";
import {
  getLocalHour,
  isQuietHours,
  isLocalHourWindow,
  getPreferenceKey,
  shouldSendNotification,
  parseNotificationPrefs,
  getNotificationTemplateText,
} from "./notification-engine";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TIMEZONE,
} from "@vesna/shared";

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
});

// UT-N03, UT-N04: isQuietHours
describe("isQuietHours", () => {
  it("returns true for 22:00-07:59 (quiet hours)", () => {
    // Create a date that is 23:00 in Moscow (UTC+3)
    // 23:00 MSK = 20:00 UTC
    const date = new Date("2026-02-11T20:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns true for 02:00 local (quiet hours)", () => {
    // 02:00 MSK = 23:00 UTC previous day
    const date = new Date("2026-02-10T23:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(true);
  });

  it("returns false for 08:00-21:59 (active hours)", () => {
    // 10:00 MSK = 07:00 UTC
    const date = new Date("2026-02-11T07:00:00Z");
    expect(isQuietHours(date, "Europe/Moscow")).toBe(false);
  });

  it("returns false for 15:00 (active hours)", () => {
    // 15:00 MSK = 12:00 UTC
    const date = new Date("2026-02-11T12:00:00Z");
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
});

// UT-N08: getPreferenceKey
describe("getPreferenceKey", () => {
  it("maps notification type to pref key", () => {
    expect(getPreferenceKey("lesson_reminder")).toBe("lessonReminder");
    expect(getPreferenceKey("streak_risk")).toBe("streakRisk");
    expect(getPreferenceKey("churn_2d")).toBe("churnPrevention");
    expect(getPreferenceKey("churn_5d")).toBe("churnPrevention");
    expect(getPreferenceKey("duel_accepted")).toBe("duelEvents");
    expect(getPreferenceKey("duel_completed")).toBe("duelEvents");
    expect(getPreferenceKey("weekly_report")).toBe("weeklyReport");
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
});
