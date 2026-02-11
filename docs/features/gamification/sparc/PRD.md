# Gamification Enhancement — PRD

## Context
Core gamification exists: XP (lessons + streaks), 5 levels, streak tracking, 1 badge (duel champion), frontend page. This enhancement fixes bugs and adds missing features from the spec.

## User Stories

### Bug Fixes
| ID | Story | Priority |
|----|-------|----------|
| GE-001 | As a user, when I open /gamification, I see my correct XP, level, streak, and lessons progress (currently broken — API shape mismatch) | Must |
| GE-002 | As a user, when I log a meal, I earn 3 XP (currently no XP for meals) | Must |

### New Features
| ID | Story | Priority |
|----|-------|----------|
| GE-003 | As a user, I want to see a leaderboard of top users by XP so I feel competitive motivation | Should |
| GE-004 | As a user, I want to earn badges for achievements (streak milestones, lesson milestones, meal milestones) so I can collect them | Should |
| GE-005 | As a user, I want to see a celebration when I level up so I feel rewarded | Should |
| GE-006 | As a user, I want to earn XP for completing daily goals (lesson + meal in one day = 15 XP bonus) | Should |

## Acceptance Criteria

### GE-001: Fix API/Frontend Shape Mismatch
- GET /api/gamification returns `{xp, level, levelName, nextLevelXp, badges, streak: {current, longest}, lessonsCompleted, totalLessons}`
- /gamification page renders all data correctly
- Loading and error states work

### GE-002: Meal XP
- POST /api/meals awards 3 XP per meal logged
- XP is added to Gamification.xpTotal
- Level recalculated after XP update

### GE-003: Leaderboard
- GET /api/gamification/leaderboard returns top 50 users by XP
- Response: `{leaderboard: [{rank, displayName, xp, level, levelName}], userRank: number}`
- Anonymous display names (first 2 chars + "***")
- Leaderboard tab/section on /gamification page

### GE-004: Expanded Badges
- Badge types: streak_7, streak_14, streak_30, streak_60, lessons_all (14/14), meals_100
- Badges awarded automatically when conditions met
- Persisted in Gamification.badges JSON array
- Displayed on /gamification page with earned/unearned states

### GE-005: Level-Up Celebration
- When XP crosses a level threshold, API response includes `leveledUp: true, newLevel: {level, name}`
- Frontend shows a celebration overlay (confetti-like animation)
- Auto-dismisses after 3 seconds

### GE-006: Daily Goal Bonus
- If user completes at least 1 lesson AND logs at least 1 meal in the same UTC day, award 15 XP bonus
- Checked on each lesson completion and meal log
- Only awarded once per day

## Success Metrics
- Gamification page loads without errors (currently broken)
- Users earn XP from all 4 sources (lessons, meals, streaks, daily goals)
- Badge collection visible and growing
- Leaderboard drives engagement
