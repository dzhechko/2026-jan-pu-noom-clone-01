import { GAMIFICATION_LEVELS } from "@vesna/shared";

export interface LevelInfo {
  level: number;
  name: string;
}

export interface ExtendedLevelInfo extends LevelInfo {
  nextLevelXp: number | null;
}

/**
 * Calculate level from total XP using GAMIFICATION_LEVELS thresholds.
 * Returns the highest level whose xpRequired <= xpTotal.
 */
export function calculateLevel(xpTotal: number): LevelInfo {
  let result: LevelInfo = { level: 1, name: GAMIFICATION_LEVELS[0].name };

  for (const entry of GAMIFICATION_LEVELS) {
    if (xpTotal >= entry.xpRequired) {
      result = { level: entry.level, name: entry.name };
    }
  }

  return result;
}

/**
 * Calculate level with next level XP threshold.
 */
export function calculateLevelExtended(xpTotal: number): ExtendedLevelInfo {
  const levelInfo = calculateLevel(xpTotal);
  const nextLevel = GAMIFICATION_LEVELS.find((l) => l.level === levelInfo.level + 1);
  return { ...levelInfo, nextLevelXp: nextLevel?.xpRequired ?? null };
}

/**
 * Determine if awarding `amount` XP causes a level up.
 */
export function wouldLevelUp(currentXp: number, amount: number): { leveledUp: boolean; newLevel: LevelInfo | null } {
  const oldLevel = calculateLevel(currentXp);
  const newLevel = calculateLevel(currentXp + amount);
  if (newLevel.level > oldLevel.level) {
    return { leveledUp: true, newLevel };
  }
  return { leveledUp: false, newLevel: null };
}
