# Gamification Enhancement — Completion Checklist

## Implementation Order

### Phase A: Bug Fixes (must-do first)
1. Fix GET /api/gamification response shape (add levelName, nextLevelXp, lessonsCompleted, flatten structure)
2. Fix /gamification page data binding to match new API shape
3. Add route tests for GET /api/gamification

### Phase B: Engines (parallel, no deps)
4. Create badge-engine.ts + tests
5. Create daily-goal-engine.ts + tests
6. Add awardXp helper to gamification-engine.ts + tests
7. Add BADGE_DEFINITIONS, MEAL_XP, DAILY_GOAL_XP to shared constants

### Phase C: API Integration
8. Add XP award to POST /api/meals (3 XP + daily goal check + badge check)
9. Add badge/daily-goal checks to POST /api/lessons/[id]/complete
10. Create GET /api/gamification/leaderboard route

### Phase D: Frontend
11. Add leaderboard section to /gamification page
12. Add badge grid to /gamification page
13. Add level-up celebration component
14. Wire celebration into meal/lesson responses

### Phase E: Tests
15. Route tests for leaderboard endpoint
16. Integration: meal XP award test
17. Full test suite passes

## Verification
```bash
npx vitest run        # all tests pass
npx tsc --noEmit      # TypeScript clean
```
