/**
 * Check if user has completed both a lesson and logged a meal today.
 * Pure function — takes boolean inputs, returns bonus XP amount.
 */
export function checkDailyGoalEligibility(
  hasLessonToday: boolean,
  hasMealToday: boolean,
  alreadyAwarded: boolean
): { eligible: boolean; bonusXp: number } {
  if (alreadyAwarded) {
    return { eligible: false, bonusXp: 0 };
  }
  if (hasLessonToday && hasMealToday) {
    return { eligible: true, bonusXp: 15 };
  }
  return { eligible: false, bonusXp: 0 };
}
