# Gamification Enhancement — Architecture

## Consistency with Root Architecture
- Same stack: Next.js 14, Prisma, PostgreSQL, Redis
- Same patterns: API routes + engines + validators
- No new infrastructure needed
- No schema migrations needed (badges already JSON)

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `lib/engines/badge-engine.ts` | Badge condition checking + awarding |
| `lib/engines/badge-engine.test.ts` | Badge engine unit tests |
| `lib/engines/daily-goal-engine.ts` | Daily goal completion check + bonus XP |
| `lib/engines/daily-goal-engine.test.ts` | Daily goal engine tests |
| `app/api/gamification/leaderboard/route.ts` | GET leaderboard endpoint |
| `app/api/gamification/route.test.ts` | Route-level tests for gamification API |
| `components/gamification/level-up-modal.tsx` | Level-up celebration overlay |
| `components/gamification/leaderboard-card.tsx` | Leaderboard section component |
| `components/gamification/badge-grid.tsx` | Badge grid with earned/unearned states |

### Modified Files
| File | Change |
|------|--------|
| `app/api/gamification/route.ts` | Reshape response, add lessonsCompleted |
| `app/api/meals/route.ts` | Add XP award + badge check on POST |
| `app/gamification/page.tsx` | Fix data binding, add leaderboard/badges/celebration |
| `packages/shared/src/constants/index.ts` | Add BADGE_DEFINITIONS, DAILY_GOAL_XP, MEAL_XP |

## Caching Strategy
- Leaderboard: Redis cache, 60s TTL, invalidated on XP change
- Gamification status: no cache (real-time needed for XP feedback)

## ADR: Leaderboard Privacy
- Display names anonymized: first 2 chars + "***"
- Current user sees their own full name
- No user IDs exposed in response
