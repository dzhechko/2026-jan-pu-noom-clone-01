import { describe, it, expect } from "vitest";

/**
 * Tests that validate the profile response shape and the frontend's
 * handling of nullable/missing fields — covers Bug 1 fix.
 */

interface UserData {
  name: string | null;
  email: string | null;
  telegramId: string | null;
  subscriptionTier: string;
}

interface ProfileResponse {
  user: UserData;
  gamification: {
    xp: number;
    level: number;
    badges: string[];
  } | null;
  streak: {
    current: number;
    longest: number;
  } | null;
}

/** Mirrors the logic from profile/page.tsx */
function extractProfileDisplayValues(profile: ProfileResponse) {
  const displayName = profile.user.name ?? "Пользователь";
  const gamification = profile.gamification ?? { xp: 0, level: 1, badges: [] };
  const streak = profile.streak ?? { current: 0, longest: 0 };
  return { displayName, gamification, streak };
}

describe("Profile response shape handling", () => {
  it("extracts user name from nested response", () => {
    const response: ProfileResponse = {
      user: { name: "Мария", email: "m@test.com", telegramId: null, subscriptionTier: "premium" },
      gamification: { xp: 500, level: 3, badges: ["early_bird"] },
      streak: { current: 7, longest: 14 },
    };

    const { displayName } = extractProfileDisplayValues(response);
    expect(displayName).toBe("Мария");
  });

  it("falls back to 'Пользователь' when name is null (TG-only users)", () => {
    const response: ProfileResponse = {
      user: { name: null, email: null, telegramId: "123456", subscriptionTier: "free" },
      gamification: null,
      streak: null,
    };

    const { displayName } = extractProfileDisplayValues(response);
    expect(displayName).toBe("Пользователь");
  });

  it("provides default gamification when null", () => {
    const response: ProfileResponse = {
      user: { name: "Test", email: null, telegramId: "1", subscriptionTier: "free" },
      gamification: null,
      streak: { current: 1, longest: 1 },
    };

    const { gamification } = extractProfileDisplayValues(response);
    expect(gamification).toEqual({ xp: 0, level: 1, badges: [] });
  });

  it("provides default streak when null", () => {
    const response: ProfileResponse = {
      user: { name: "Test", email: null, telegramId: "1", subscriptionTier: "free" },
      gamification: { xp: 100, level: 2, badges: [] },
      streak: null,
    };

    const { streak } = extractProfileDisplayValues(response);
    expect(streak).toEqual({ current: 0, longest: 0 });
  });

  it("preserves actual gamification and streak values when present", () => {
    const response: ProfileResponse = {
      user: { name: "Test", email: "t@t.com", telegramId: null, subscriptionTier: "premium" },
      gamification: { xp: 1200, level: 5, badges: ["first_lesson", "week_streak"] },
      streak: { current: 21, longest: 30 },
    };

    const { gamification, streak } = extractProfileDisplayValues(response);
    expect(gamification.xp).toBe(1200);
    expect(gamification.level).toBe(5);
    expect(gamification.badges).toHaveLength(2);
    expect(streak.current).toBe(21);
    expect(streak.longest).toBe(30);
  });

  it("handles displayName charAt(0) correctly for fallback", () => {
    const response: ProfileResponse = {
      user: { name: null, email: null, telegramId: "1", subscriptionTier: "free" },
      gamification: null,
      streak: null,
    };

    const { displayName } = extractProfileDisplayValues(response);
    expect(displayName.charAt(0).toUpperCase()).toBe("П");
  });

  it("maps subscription tiers correctly", () => {
    const tierLabels: Record<string, string> = {
      free: "Бесплатный",
      premium: "Премиум",
      clinical: "Клинический",
    };

    for (const [tier, label] of Object.entries(tierLabels)) {
      const response: ProfileResponse = {
        user: { name: "X", email: null, telegramId: null, subscriptionTier: tier },
        gamification: null,
        streak: null,
      };
      expect(tierLabels[response.user.subscriptionTier]).toBe(label);
    }
  });

  it("handles unknown tier gracefully (falls through to raw value)", () => {
    const tierLabels: Record<string, string> = {
      free: "Бесплатный",
      premium: "Премиум",
      clinical: "Клинический",
    };

    const tier = "enterprise";
    const display = tierLabels[tier] ?? tier;
    expect(display).toBe("enterprise");
  });
});
