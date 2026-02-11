import { GAMIFICATION_LEVELS } from "@vesna/shared";

export interface LevelInfo {
  level: number;
  name: string;
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
