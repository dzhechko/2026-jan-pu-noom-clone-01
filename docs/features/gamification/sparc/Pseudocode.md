# Gamification Enhancement — Pseudocode

## 1. Badge Engine

```
FUNCTION checkAndAwardBadges(userId, prisma):
  INPUT: userId, prisma client
  OUTPUT: string[] (newly awarded badge IDs)

  gamification = prisma.gamification.findUnique(userId)
  existingBadges = gamification?.badges ?? []
  newBadges = []

  // Streak badges — check Streak record
  streak = prisma.streak.findUnique(userId)
  IF streak THEN
    FOR badge IN ["streak_7", "streak_14", "streak_30", "streak_60"]:
      days = EXTRACT_DAYS(badge)  // 7, 14, 30, 60
      IF streak.longestStreak >= days AND badge NOT IN existingBadges:
        newBadges.push(badge)

  // Lessons badge — check lesson progress count
  lessonsCompleted = prisma.lessonProgress.count(userId, status IN ["completed", "review_needed"])
  IF lessonsCompleted >= 14 AND "lessons_all" NOT IN existingBadges:
    newBadges.push("lessons_all")

  // Meals badge — check meal log count
  mealCount = prisma.mealLog.count(userId)
  IF mealCount >= 100 AND "meals_100" NOT IN existingBadges:
    newBadges.push("meals_100")

  // Persist if any new
  IF newBadges.length > 0:
    allBadges = [...existingBadges, ...newBadges]
    prisma.gamification.upsert(userId, badges: allBadges)

  RETURN newBadges
```

## 2. Daily Goal Engine

```
FUNCTION checkDailyGoal(userId, prisma):
  INPUT: userId, prisma client
  OUTPUT: { eligible: boolean, bonusXp: number }

  today = UTC_DATE(NOW())
  dayStart = today + "T00:00:00.000Z"
  dayEnd = today + "T23:59:59.999Z"

  // Check if already awarded today (prevent double-award)
  // Use a simple check: gamification.updatedAt is today AND xp includes daily bonus
  // Better: track in a separate flag or use streak.lastActiveDate

  // Check lesson completion today
  lessonToday = prisma.lessonProgress.findFirst(
    userId, completedAt BETWEEN dayStart AND dayEnd, status = "completed"
  )

  // Check meal logged today
  mealToday = prisma.mealLog.findFirst(
    userId, loggedAt BETWEEN dayStart AND dayEnd
  )

  IF lessonToday AND mealToday:
    // Check if bonus already awarded (use Redis key: daily_goal:{userId}:{date})
    cacheKey = "daily_goal:" + userId + ":" + today
    IF NOT redis.get(cacheKey):
      redis.set(cacheKey, "1", EX: 86400)  // expires in 24h
      RETURN { eligible: true, bonusXp: 15 }

  RETURN { eligible: false, bonusXp: 0 }
```

## 3. Award XP Helper

```
FUNCTION awardXp(userId, amount, prisma):
  INPUT: userId, xp amount, prisma
  OUTPUT: { xpTotal, level, levelName, leveledUp, newLevel? }

  gamification = prisma.gamification.upsert(
    where: userId,
    update: { xpTotal: increment(amount) },
    create: { userId, xpTotal: amount, level: 1 }
  )

  newLevelInfo = calculateLevel(gamification.xpTotal)
  oldLevel = gamification.level  // before recalc

  IF newLevelInfo.level != oldLevel:
    prisma.gamification.update(userId, level: newLevelInfo.level)
    RETURN { ...gamification, level: newLevelInfo.level, levelName: newLevelInfo.name, leveledUp: true }

  RETURN { ...gamification, levelName: newLevelInfo.name, leveledUp: false }
```

## 4. Meal XP Integration (modify POST /api/meals)

```
// After prisma.mealLog.create():
awardResult = awardXp(userId, MEAL_XP, prisma)  // MEAL_XP = 3
dailyGoal = checkDailyGoal(userId, prisma)
IF dailyGoal.eligible:
  awardXp(userId, dailyGoal.bonusXp, prisma)  // 15 XP
newBadges = checkAndAwardBadges(userId, prisma)

// Include in response:
{ meal, xpEarned: MEAL_XP + dailyGoal.bonusXp, leveledUp: awardResult.leveledUp, newBadges }
```

## 5. Leaderboard Query

```
FUNCTION getLeaderboard(userId, limit):
  INPUT: userId, limit (default 50)
  OUTPUT: { leaderboard, userRank, userXp }

  // Try Redis cache first
  cached = redis.get("leaderboard:" + limit)
  IF cached: RETURN JSON.parse(cached)

  // Query top users
  topUsers = prisma.gamification.findMany(
    orderBy: xpTotal DESC,
    take: limit,
    include: { user: { select: { name: true } } }
  )

  leaderboard = topUsers.map((g, i) => ({
    rank: i + 1,
    displayName: anonymize(g.user.name),
    xp: g.xpTotal,
    level: g.level,
    levelName: calculateLevel(g.xpTotal).name
  }))

  // Get user's rank
  userRank = prisma.gamification.count(xpTotal > currentUser.xpTotal) + 1

  result = { leaderboard, userRank, userXp: currentUser.xpTotal }

  // Cache for 60s
  redis.set("leaderboard:" + limit, JSON.stringify(result), EX: 60)

  RETURN result
```

## 6. Anonymize Display Name

```
FUNCTION anonymize(name):
  IF name IS NULL OR name.length < 2: RETURN "***"
  RETURN name.slice(0, 2) + "***"
```
