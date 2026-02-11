import { STREAK_MILESTONES } from "@vesna/shared";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
}

export interface StreakUpdateResult {
  current: number;
  longest: number;
  bonusXp: number;
  isNewDay: boolean;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const aDay = startOfDay(a);
  const bDay = startOfDay(b);
  return Math.round((bDay.getTime() - aDay.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Compute streak update as a pure function.
 * Returns what the new streak values should be.
 */
export function computeStreakUpdate(
  existing: StreakData | null,
  today: Date
): StreakUpdateResult {
  if (!existing) {
    // First ever activity
    return { current: 1, longest: 1, bonusXp: 0, isNewDay: true };
  }

  const diff = daysBetween(existing.lastActiveDate, today);

  if (diff === 0) {
    // Already active today
    return {
      current: existing.currentStreak,
      longest: existing.longestStreak,
      bonusXp: 0,
      isNewDay: false,
    };
  }

  if (diff === 1) {
    // Consecutive day
    const newStreak = existing.currentStreak + 1;
    const newLongest = Math.max(newStreak, existing.longestStreak);

    let bonusXp = 0;
    for (const milestone of STREAK_MILESTONES) {
      if (newStreak === milestone.days) {
        bonusXp = milestone.bonusXp;
        break;
      }
    }

    return { current: newStreak, longest: newLongest, bonusXp, isNewDay: true };
  }

  // Streak broken (diff > 1)
  return {
    current: 1,
    longest: existing.longestStreak,
    bonusXp: 0,
    isNewDay: true,
  };
}
