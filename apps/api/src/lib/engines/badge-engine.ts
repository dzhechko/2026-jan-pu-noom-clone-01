import { BADGE_DEFINITIONS, TOTAL_LESSONS } from "@vesna/shared";

interface BadgeCheckInput {
  existingBadges: string[];
  longestStreak: number;
  lessonsCompleted: number;
  totalMeals: number;
}

/**
 * Check all badge conditions and return newly earned badge IDs.
 * Pure function — does not persist. Caller must save to DB.
 */
export function checkBadgeConditions(input: BadgeCheckInput): string[] {
  const { existingBadges, longestStreak, lessonsCompleted, totalMeals } = input;
  const newBadges: string[] = [];

  // Streak badges
  const streakBadges = [
    { id: "streak_7", threshold: 7 },
    { id: "streak_14", threshold: 14 },
    { id: "streak_30", threshold: 30 },
    { id: "streak_60", threshold: 60 },
  ];
  for (const badge of streakBadges) {
    if (longestStreak >= badge.threshold && !existingBadges.includes(badge.id)) {
      newBadges.push(badge.id);
    }
  }

  // All lessons badge
  if (lessonsCompleted >= TOTAL_LESSONS && !existingBadges.includes("lessons_all")) {
    newBadges.push("lessons_all");
  }

  // Meals badge
  if (totalMeals >= 100 && !existingBadges.includes("meals_100")) {
    newBadges.push("meals_100");
  }

  return newBadges;
}

/** Get badge definition by ID */
export function getBadgeDefinition(id: string) {
  return BADGE_DEFINITIONS.find((b) => b.id === id) ?? null;
}
