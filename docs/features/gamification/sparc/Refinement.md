# Gamification Enhancement — Refinement

## Unit Tests

### Badge Engine (8 tests)
| ID | Test | Input | Expected |
|----|------|-------|----------|
| BE-01 | No badges when conditions unmet | streak=3, lessons=5, meals=10 | [] |
| BE-02 | streak_7 awarded | longestStreak=7 | ["streak_7"] |
| BE-03 | Multiple streak badges at once | longestStreak=30 | ["streak_7","streak_14","streak_30"] |
| BE-04 | lessons_all when 14/14 | completedCount=14 | ["lessons_all"] |
| BE-05 | meals_100 when >=100 meals | mealCount=100 | ["meals_100"] |
| BE-06 | Skip already-earned badges | existing=["streak_7"], longestStreak=14 | ["streak_14"] |
| BE-07 | All badges at once | maxed-out user | 6 badges total |
| BE-08 | duel_champion preserved | existing=["duel_champion"] | not removed |

### Daily Goal Engine (6 tests)
| ID | Test | Input | Expected |
|----|------|-------|----------|
| DG-01 | Both lesson + meal today | lessonToday=true, mealToday=true | eligible=true, 15 XP |
| DG-02 | Only lesson today | lessonToday=true, mealToday=false | eligible=false |
| DG-03 | Only meal today | lessonToday=false, mealToday=true | eligible=false |
| DG-04 | Neither today | both false | eligible=false |
| DG-05 | Already awarded today | redis key exists | eligible=false |
| DG-06 | New day after previous award | redis key expired | eligible=true |

### Award XP (5 tests)
| ID | Test | Input | Expected |
|----|------|-------|----------|
| AX-01 | First XP ever (upsert creates) | no existing record | xpTotal=3 |
| AX-02 | XP increments correctly | existing=97, add=3 | xpTotal=100 |
| AX-03 | Level up detected | existing=97, add=10 | leveledUp=true, level=2 |
| AX-04 | No level up | existing=50, add=3 | leveledUp=false |
| AX-05 | Max level (5) stays | existing=2000, add=100 | level=5, leveledUp=false |

### Leaderboard (6 tests)
| ID | Test | Input | Expected |
|----|------|-------|----------|
| LB-01 | Returns top users sorted by XP | 5 users | descending order |
| LB-02 | Anonymizes names | "Алексей" | "Ал***" |
| LB-03 | Short name anonymization | "А" | "***" |
| LB-04 | User's own rank included | user at position 3 | userRank=3 |
| LB-05 | Empty leaderboard | no users | leaderboard=[], userRank=1 |
| LB-06 | Limit param respected | limit=5, 20 users | 5 results |

### Gamification Route Tests (10 tests)
| ID | Test | Input | Expected |
|----|------|-------|----------|
| GR-01 | 401 unauthenticated | no token | 401 |
| GR-02 | 200 with correct shape | valid user | {xp, level, levelName, ...} |
| GR-03 | Default values for new user | no records | xp=0, level=1 |
| GR-04 | Includes lessonsCompleted count | 5 lessons done | lessonsCompleted=5 |
| GR-05 | Includes streak data | streak=7 | streak.current=7 |
| GR-06 | 500 on DB error | prisma throws | GEN_001 |
| GR-07 | Leaderboard 401 | no token | 401 |
| GR-08 | Leaderboard 200 | valid user | {leaderboard, userRank} |
| GR-09 | Leaderboard default limit | no param | 50 results max |
| GR-10 | Leaderboard 500 on error | prisma throws | GEN_001 |

## Edge Cases
- Concurrent XP awards (two meals at same time) → Prisma `increment` is atomic
- Daily goal check race condition → Redis SET NX (only set if not exists)
- Leaderboard cache invalidation → TTL-based (60s), not event-based (simpler)
- User with no Gamification record → upsert creates one
- Badge JSON array deduplication → check before insert
