# Gamification Enhancement — Specification

## API Changes

### 1. GET /api/gamification (FIX — reshape response)

**Current broken response:**
```json
{
  "gamification": {"xpTotal": 150, "level": 2, "badges": []},
  "streak": {"currentStreak": 5, "longestStreak": 12, "lastActiveDate": "..."}
}
```

**New response:**
```json
{
  "xp": 150,
  "level": 2,
  "levelName": "Ученик",
  "nextLevelXp": 400,
  "badges": ["streak_7", "streak_14"],
  "streak": {
    "current": 5,
    "longest": 12
  },
  "lessonsCompleted": 8,
  "totalLessons": 14
}
```

### 2. GET /api/gamification/leaderboard (NEW)

**Query params:** `?limit=50` (default 50, max 100)

**Response:**
```json
{
  "leaderboard": [
    {"rank": 1, "displayName": "Ал***", "xp": 1200, "level": 4, "levelName": "Мастер"}
  ],
  "userRank": 15,
  "userXp": 450
}
```

### 3. POST /api/meals — add XP award (CHANGE)

After creating meal, award 3 XP:
- Upsert Gamification record (increment xpTotal by 3)
- Recalculate level via `calculateLevel()`
- Check daily goal completion (if lesson also done today → +15 bonus)
- Check badge conditions

### 4. POST /api/lessons/[id]/complete — add badge/daily-goal checks (CHANGE)

After existing XP award:
- Check daily goal completion (if meal also logged today → +15 bonus)
- Check badge conditions (lessons_all if 14/14 completed)

## Data Model Changes

### Gamification table — no schema change
Existing `badges: Json @default("[]")` already supports array of badge IDs.

### New: Badge definitions (constants, not DB table)

```typescript
export const BADGE_DEFINITIONS = [
  { id: "streak_7", name: "7 дней подряд", icon: "fire", description: "Серия 7 дней" },
  { id: "streak_14", name: "2 недели подряд", icon: "fire", description: "Серия 14 дней" },
  { id: "streak_30", name: "Месяц подряд", icon: "fire", description: "Серия 30 дней" },
  { id: "streak_60", name: "2 месяца подряд", icon: "fire", description: "Серия 60 дней" },
  { id: "lessons_all", name: "Все уроки пройдены", icon: "book", description: "14 из 14 уроков" },
  { id: "meals_100", name: "100 приёмов пищи", icon: "utensils", description: "Записано 100 приёмов" },
  { id: "duel_champion", name: "Чемпион Дуэли", icon: "trophy", description: "Победа в дуэли" },
];
```

## Error Codes
No new error codes needed. Uses existing GEN_001 for server errors.

## Frontend Changes

### /gamification page
1. Fix data binding to match new API response shape
2. Add leaderboard tab/section
3. Add badge grid with earned/unearned states
4. Add level-up celebration overlay

### POST /api/meals response
Add optional `xpEarned` and `leveledUp` fields to meal creation response.
