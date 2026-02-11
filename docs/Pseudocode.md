# Pseudocode

## Overview
Алгоритмы, data flow и state machines для MVP «Весна». Язык-агностичный pseudocode, оптимизированный для AI-assisted кодогенерации.

---

## 1. C-Screen Quiz Engine

### 1.1 Metabolic Age Calculation

```
FUNCTION calculateMetabolicAge(answers):
  INPUT: QuizAnswers { age, gender, height_cm, weight_kg, 
         activity_level, sleep_hours, stress_level,
         meals_per_day, snacking_frequency, water_glasses,
         medical_conditions[], medications[] }
  OUTPUT: MetabolicResult { metabolic_age, bmi, bmi_category, risks[] }

  1. bmi = weight_kg / (height_cm / 100)^2
  2. bmi = ROUND(bmi, 1)

  3. base_penalty = 0

  4. // Activity penalty (sedentary lifestyle ages you)
     IF activity_level == "sedentary" THEN base_penalty += 8
     ELSE IF activity_level == "light" THEN base_penalty += 4
     ELSE IF activity_level == "moderate" THEN base_penalty += 1
     ELSE base_penalty += 0  // active

  5. // Sleep penalty
     IF sleep_hours < 5 THEN base_penalty += 6
     ELSE IF sleep_hours < 6 THEN base_penalty += 4
     ELSE IF sleep_hours < 7 THEN base_penalty += 2
     ELSE IF sleep_hours > 9 THEN base_penalty += 1

  6. // Stress penalty
     IF stress_level == "very_high" THEN base_penalty += 5
     ELSE IF stress_level == "high" THEN base_penalty += 3
     ELSE IF stress_level == "moderate" THEN base_penalty += 1

  7. // BMI penalty
     IF bmi >= 35 THEN base_penalty += 7
     ELSE IF bmi >= 30 THEN base_penalty += 5
     ELSE IF bmi >= 27 THEN base_penalty += 3
     ELSE IF bmi >= 25 THEN base_penalty += 1

  8. // Nutrition penalty
     IF meals_per_day < 3 THEN base_penalty += 2
     IF snacking_frequency == "often" THEN base_penalty += 2
     IF water_glasses < 4 THEN base_penalty += 2

  9. // Medical conditions penalty
     FOR EACH condition IN medical_conditions:
       IF condition IN ["diabetes", "hypertension", "thyroid"] THEN
         base_penalty += 3

  10. // Gender adjustment (women metabolize differently)
      IF gender == "female" THEN
        gender_factor = 0.9
      ELSE
        gender_factor = 1.0

  11. metabolic_age = age + ROUND(base_penalty * gender_factor)
  12. metabolic_age = CLAMP(metabolic_age, age - 5, age + 25)

  13. bmi_category = CASE
        bmi < 18.5 → "underweight"
        bmi < 25 → "normal"
        bmi < 30 → "overweight"
        ELSE → "obese"

  14. risks = generateRisks(bmi, activity_level, sleep_hours, stress_level, age)

  15. RETURN { metabolic_age, bmi, bmi_category, risks }
```

### 1.2 Risk Generator

```
FUNCTION generateRisks(bmi, activity, sleep, stress, age):
  INPUT: health parameters
  OUTPUT: Risk[] (top 3, sorted by severity)

  risk_pool = []

  IF bmi >= 25 THEN
    risk_pool.ADD({ 
      type: "metabolic_syndrome",
      title: "Риск метаболического синдрома", 
      severity: MAP(bmi, 25→0.3, 30→0.6, 35→0.9),
      description: "Повышенный BMI увеличивает риск диабета 2 типа"
    })

  IF activity == "sedentary" THEN
    risk_pool.ADD({
      type: "cardiovascular",
      title: "Сердечно-сосудистые риски",
      severity: 0.5 + (IF age > 40 THEN 0.2 ELSE 0),
      description: "Малоподвижный образ жизни — фактор риска №1"
    })

  IF sleep < 6 THEN
    risk_pool.ADD({
      type: "hormonal",
      title: "Гормональный дисбаланс",
      severity: MAP(sleep, 4→0.8, 5→0.5, 6→0.3),
      description: "Недостаток сна нарушает выработку лептина и грелина"
    })

  IF stress IN ["high", "very_high"] THEN
    risk_pool.ADD({
      type: "cortisol",
      title: "Повышенный кортизол",
      severity: IF stress == "very_high" THEN 0.7 ELSE 0.5,
      description: "Хронический стресс провоцирует набор висцерального жира"
    })

  IF bmi >= 30 AND age >= 35 THEN
    risk_pool.ADD({
      type: "prediabetes",
      title: "Риск преддиабета",
      severity: 0.7,
      description: "BMI >30 после 35 лет — показание к проверке HbA1c"
    })

  SORT risk_pool BY severity DESC
  RETURN risk_pool[0..2]  // top 3
```

### 1.3 Quiz State Machine

```
STATE MACHINE: QuizFlow

States: [not_started, in_progress, calculating, result_shown, 
         registered, abandoned]

Transitions:
  not_started → in_progress:    WHEN user opens quiz
  in_progress → in_progress:    WHEN user answers question (save progress)
  in_progress → calculating:    WHEN question 12 answered
  in_progress → abandoned:      WHEN user leaves (save progress, timeout 24h)
  abandoned → in_progress:      WHEN user returns within 24h
  abandoned → not_started:      WHEN 24h elapsed (clear progress)
  calculating → result_shown:   WHEN metabolic_age computed (~2s)
  result_shown → registered:    WHEN user completes registration
  result_shown → abandoned:     WHEN user leaves without registering

Storage:
  in_progress: answers saved to localStorage (mobile) or cookie
  registered: answers migrated to MedicalProfile in PostgreSQL
```

---

## 2. CBT Lesson Engine

### 2.1 Lesson Progress Manager

```
FUNCTION getLessonStatus(user_id):
  INPUT: user_id
  OUTPUT: LessonList[{ id, title, status, xp_reward }]

  completed = DB.query("SELECT lesson_id FROM lesson_progress 
                         WHERE user_id = ? AND status = 'completed'", user_id)
  subscription = DB.query("SELECT subscription_tier FROM users 
                           WHERE id = ?", user_id)

  lessons = []
  FOR lesson_id FROM 1 TO 14:
    IF lesson_id IN completed THEN
      status = "completed"
    ELSE IF lesson_id == MAX(completed) + 1 THEN
      IF subscription.tier == "free" AND lesson_id > 3 THEN
        status = "paywall"
      ELSE
        status = "available"
    ELSE
      status = "locked"
    
    lessons.ADD({ id: lesson_id, title: LESSONS[lesson_id].title, 
                  status, xp_reward: 10 })

  RETURN lessons


FUNCTION completeLesson(user_id, lesson_id, quiz_answers):
  INPUT: user_id, lesson_id (1-14), quiz_answers[3]
  OUTPUT: CompletionResult { score, xp_earned, streak, next_lesson }

  1. lesson = LESSONS[lesson_id]
  2. correct_count = COUNT(quiz_answers WHERE answer == lesson.quiz.correct_answer)
  3. score = correct_count  // 0-3

  4. IF score < 2 THEN
       status = "review_needed"
       xp = 5  // partial XP
     ELSE
       status = "completed"
       xp = 10 + (IF score == 3 THEN 5 ELSE 0)  // bonus for perfect

  5. DB.upsert("lesson_progress", {
       user_id, lesson_id, status, quiz_score: score,
       completed_at: NOW(), xp_earned: xp
     })

  6. updateGamification(user_id, xp)
  7. streak_result = updateStreak(user_id)

  8. next_lesson = IF lesson_id < 14 THEN lesson_id + 1 ELSE NULL

  9. RETURN { score, xp_earned: xp, streak: streak_result, next_lesson }
```

---

## 3. AI Coach Pipeline

### 3.1 Coach Message Handler

```
FUNCTION handleCoachMessage(user_id, user_message):
  INPUT: user_id, user_message (string)
  OUTPUT: CoachResponse { response, suggested_questions[] }

  1. // Build context
     context = buildCoachContext(user_id)
  
  2. // Safety check
     IF containsMedicalRequest(user_message) THEN
       RETURN {
         response: MEDICAL_DISCLAIMER_TEMPLATE,
         suggested_questions: CBT_SUGGESTED_QUESTIONS
       }

  3. // Build prompt
     system_prompt = COACH_SYSTEM_PROMPT
       .replace("{user_name}", context.user_name)
       .replace("{current_lesson}", context.last_completed_lesson)
       .replace("{lesson_concepts}", context.lesson_concepts)
       .replace("{recent_meals_summary}", context.meals_summary)
       .replace("{streak}", context.streak)

  4. // Call Claude API
     response = CLAUDE_API.call({
       model: "claude-sonnet-4-20250514",
       max_tokens: 300,
       system: system_prompt,
       messages: [
         ...context.recent_messages,  // last 10 messages for context
         { role: "user", content: user_message }
       ]
     })

  5. // Save messages
     DB.insert("coach_messages", { user_id, role: "user", content: user_message })
     DB.insert("coach_messages", { user_id, role: "assistant", content: response.text })

  6. // Generate suggested questions based on context
     suggestions = generateSuggestions(context.last_completed_lesson)

  7. RETURN { response: response.text, suggested_questions: suggestions }


FUNCTION buildCoachContext(user_id):
  user = DB.query("SELECT * FROM users WHERE id = ?", user_id)
  profile = DB.query("SELECT * FROM medical_profiles WHERE user_id = ?", user_id)
  lessons = DB.query("SELECT * FROM lesson_progress WHERE user_id = ? 
                       AND status = 'completed' ORDER BY lesson_id DESC LIMIT 3", user_id)
  meals = DB.query("SELECT * FROM meal_logs WHERE user_id = ? 
                     AND logged_at > NOW() - INTERVAL '3 days'", user_id)
  messages = DB.query("SELECT * FROM coach_messages WHERE user_id = ? 
                        ORDER BY created_at DESC LIMIT 10", user_id)
  streak = DB.query("SELECT current_streak FROM streaks WHERE user_id = ?", user_id)

  RETURN {
    user_name: user.name,
    last_completed_lesson: lessons[0]?.lesson_id ?? 0,
    lesson_concepts: LESSONS[lessons[0]?.lesson_id]?.key_concepts ?? [],
    meals_summary: summarizeMeals(meals),
    streak: streak.current_streak,
    recent_messages: messages.REVERSE()
  }


FUNCTION containsMedicalRequest(message):
  medical_keywords = ["дозировка", "таблетки", "лекарство", "оземпик", 
                       "семаглутид", "диагноз", "анализы", "назначить",
                       "прописать", "рецепт", "давление", "инсулин"]
  RETURN ANY(keyword IN message.toLowerCase() FOR keyword IN medical_keywords)
```

### 3.2 Coach System Prompt Template

```
CONSTANT COACH_SYSTEM_PROMPT = """
Ты — AI-коуч программы «Весна» по когнитивно-поведенческой терапии (CBT) 
для управления весом. 

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Имя: {user_name}
- Текущий урок: {current_lesson} из 14
- Ключевые концепции пройденных уроков: {lesson_concepts}
- Питание за 3 дня: {recent_meals_summary}
- Streak: {streak} дней

ПРАВИЛА:
1. Отвечай на русском, дружелюбно и поддерживающе
2. Используй CBT-техники из пройденных уроков
3. Никогда не давай медицинских рекомендаций (лекарства, дозировки, диагнозы)
4. Длина ответа: 50-200 слов
5. Включай 1-2 конкретных действия, которые можно сделать сегодня
6. Не осуждай за срывы — помогай проанализировать триггеры
7. Если спрашивают о медицине — перенаправь к врачу
"""
```

---

## 4. Meal Recognition Pipeline

```
FUNCTION recognizeMeal(photo_file):
  INPUT: photo (JPEG/PNG, max 5MB)
  OUTPUT: RecognitionResult { dish_name, calories, protein, fat, carbs, 
                              confidence, alternatives[] }

  1. // Validate image
     IF photo_file.size > 5MB THEN THROW "Файл слишком большой (макс. 5 МБ)"
     IF photo_file.type NOT IN ["image/jpeg", "image/png"] THEN 
       THROW "Поддерживаются только JPEG и PNG"

  2. // Resize for API
     resized = resizeImage(photo_file, max_dimension: 1024)

  3. // Call recognition API (primary)
     result = FOOD_RECOGNITION_API.recognize(resized)

  4. IF result.confidence < 0.3 THEN
       RETURN { dish_name: null, confidence: 0, 
                message: "Не удалось распознать. Попробуйте вручную." }

  5. // Enrich with nutrition data from Russian food database
     nutrition = FOOD_DB.lookup(result.dish_name, locale: "ru")
  
  6. IF nutrition == NULL THEN
       // Fallback to generic database
       nutrition = FOOD_DB.lookup(result.dish_name, locale: "generic")

  7. // Calculate for estimated portion
     portion_g = result.estimated_portion ?? 300  // default 300g
     multiplier = portion_g / 100

  8. RETURN {
       dish_name: result.dish_name,
       calories: ROUND(nutrition.cal_per_100g * multiplier),
       protein: ROUND(nutrition.protein_per_100g * multiplier, 1),
       fat: ROUND(nutrition.fat_per_100g * multiplier, 1),
       carbs: ROUND(nutrition.carbs_per_100g * multiplier, 1),
       portion_g: portion_g,
       confidence: result.confidence,
       alternatives: result.alternatives[0..2]
     }
```

---

## 5. Gamification Engine

### 5.1 Streak Manager

```
FUNCTION updateStreak(user_id):
  INPUT: user_id
  OUTPUT: StreakResult { current, longest, bonus_xp }

  streak = DB.query("SELECT * FROM streaks WHERE user_id = ?", user_id)
  today = DATE(NOW())

  IF streak == NULL THEN
    // First ever activity
    DB.insert("streaks", { user_id, current_streak: 1, 
              longest_streak: 1, last_active_date: today })
    RETURN { current: 1, longest: 1, bonus_xp: 0 }

  days_diff = today - streak.last_active_date

  IF days_diff == 0 THEN
    // Already updated today
    RETURN { current: streak.current_streak, 
             longest: streak.longest_streak, bonus_xp: 0 }

  IF days_diff == 1 THEN
    // Consecutive day
    new_streak = streak.current_streak + 1
    new_longest = MAX(new_streak, streak.longest_streak)
    bonus_xp = 0
    
    // Milestone bonuses
    IF new_streak == 7 THEN bonus_xp = 50
    ELSE IF new_streak == 14 THEN bonus_xp = 100
    ELSE IF new_streak == 30 THEN bonus_xp = 200
    ELSE IF new_streak % 30 == 0 THEN bonus_xp = 200

    DB.update("streaks", { current_streak: new_streak,
              longest_streak: new_longest, last_active_date: today })
    
    IF bonus_xp > 0 THEN updateGamification(user_id, bonus_xp)
    RETURN { current: new_streak, longest: new_longest, bonus_xp }

  ELSE
    // Streak broken
    DB.update("streaks", { current_streak: 1, last_active_date: today })
    RETURN { current: 1, longest: streak.longest_streak, bonus_xp: 0 }
```

### 5.2 Daily Activity Check (for streak)

```
FUNCTION checkDailyCompletion(user_id, date):
  INPUT: user_id, date
  OUTPUT: boolean (true if at least 1 lesson completed OR 1 meal logged)

  lesson_done = DB.exists("SELECT 1 FROM lesson_progress 
                            WHERE user_id = ? AND DATE(completed_at) = ?", 
                           user_id, date)
  meal_done = DB.exists("SELECT 1 FROM meal_logs 
                          WHERE user_id = ? AND DATE(logged_at) = ?", 
                         user_id, date)

  RETURN lesson_done OR meal_done
```

---

## 6. Duel Engine

```
FUNCTION createDuel(challenger_id):
  INPUT: challenger_id (user_id)
  OUTPUT: DuelInvite { duel_id, invite_link, expires_at }

  // Validate: user is Premium and has no active duel
  user = DB.query("SELECT * FROM users WHERE id = ?", challenger_id)
  IF user.subscription_tier == "free" THEN THROW "Дуэли доступны в Premium"
  
  active = DB.query("SELECT * FROM duels WHERE challenger_id = ? 
                      AND status = 'active'", challenger_id)
  IF active != NULL THEN THROW "У вас уже есть активная дуэль"

  duel_id = UUID()
  invite_token = generateSecureToken(32)
  expires_at = NOW() + 72h

  DB.insert("duels", {
    id: duel_id, challenger_id, opponent_id: NULL,
    status: "pending", invite_token, expires_at
  })

  invite_link = "https://vesna.app/duel/" + invite_token

  RETURN { duel_id, invite_link, expires_at }


FUNCTION acceptDuel(invite_token, opponent_id):
  duel = DB.query("SELECT * FROM duels WHERE invite_token = ?", invite_token)
  
  IF duel == NULL THEN THROW "Ссылка недействительна"
  IF duel.status != "pending" THEN THROW "Дуэль уже принята или истекла"
  IF NOW() > duel.expires_at THEN THROW "Ссылка истекла"
  IF duel.challenger_id == opponent_id THEN THROW "Нельзя дуэлить себя"

  start_date = DATE(NOW())
  end_date = start_date + 7d

  DB.update("duels", {
    opponent_id, status: "active", start_date, end_date,
    challenger_score: 0, opponent_score: 0
  }, WHERE id = duel.id)

  // Schedule duel completion job
  SCHEDULER.at(end_date + "23:59:59", completeDuel, duel.id)

  RETURN { duel: duel, start_date, end_date }


FUNCTION updateDuelScore(duel_id, user_id, action):
  // Called after lesson completion or meal logging
  duel = DB.query("SELECT * FROM duels WHERE id = ? AND status = 'active'", duel_id)
  IF duel == NULL THEN RETURN

  points = CASE action
    "lesson_completed" → 10
    "meal_logged" → 5
    "streak_maintained" → 5

  IF user_id == duel.challenger_id THEN
    DB.update("duels", { challenger_score: duel.challenger_score + points })
  ELSE
    DB.update("duels", { opponent_score: duel.opponent_score + points })


FUNCTION completeDuel(duel_id):
  duel = DB.query("SELECT * FROM duels WHERE id = ?", duel_id)
  
  winner_id = IF duel.challenger_score > duel.opponent_score 
              THEN duel.challenger_id
              ELSE IF duel.opponent_score > duel.challenger_score
              THEN duel.opponent_id
              ELSE NULL  // tie

  DB.update("duels", { status: "completed", winner_id })

  IF winner_id != NULL THEN
    awardBadge(winner_id, "duel_champion")
    updateGamification(winner_id, 100)  // bonus XP
  
  // Award participation XP to both
  updateGamification(duel.challenger_id, 30)
  updateGamification(duel.opponent_id, 30)

  // Send push notifications
  PUSH.send(duel.challenger_id, "Дуэль завершена! Смотри результаты 🏆")
  PUSH.send(duel.opponent_id, "Дуэль завершена! Смотри результаты 🏆")
```

---

## 7. Notification Engine

```
FUNCTION scheduleNotifications(user_id):
  // Called on registration
  
  // Daily lesson reminder (10:00 local time)
  SCHEDULER.daily(user_id, "10:00", {
    condition: NOT checkDailyCompletion(user_id, TODAY()),
    push: { title: "Урок ждёт! 📚", body: "3 минуты для новых привычек" }
  })

  // Streak at risk (20:00 if no activity)
  SCHEDULER.daily(user_id, "20:00", {
    condition: NOT checkDailyCompletion(user_id, TODAY()) 
              AND getStreak(user_id).current > 2,
    push: { title: "Streak на кону! 🔥", 
            body: "Ваша серия {streak} дней. Не потеряйте!" }
  })

  // Weekly report (Sunday 18:00)
  SCHEDULER.weekly(user_id, "Sunday 18:00", {
    push: { title: "Итоги недели 📊", body: "Посмотрите свой прогресс" }
  })


FUNCTION sendChurnPrevention(user_id, days_inactive):
  IF days_inactive == 2 THEN
    PUSH.send(user_id, {
      title: "Мы скучаем! 👋",
      body: "Ваш AI-коуч подготовил новый совет"
    })
  ELSE IF days_inactive == 5 THEN
    EMAIL.send(user_id, TEMPLATE("win_back_5d"), {
      progress_summary: getProgressSummary(user_id),
      discount: IF user.tier == "free" THEN "20% на Premium" ELSE NULL
    })
  ELSE IF days_inactive == 14 THEN
    PUSH.send(user_id, {
      title: "Бесплатная неделя Premium! 🎁",
      body: "Вернитесь и получите 7 дней Premium бесплатно"
    })
    grantTemporaryAccess(user_id, "premium", 7d)
```

---

## 8. Subscription & Paywall Flow

```
STATE MACHINE: SubscriptionFlow

States: [anonymous, free, trial, premium, clinical, 
         cancelled, expired, churned]

Transitions:
  anonymous → free:       WHEN registration completed
  free → trial:           WHEN user starts 7-day trial (RevenueCat)
  trial → premium:        WHEN trial ends + payment succeeds
  trial → free:           WHEN trial ends + payment fails/cancelled
  free → premium:         WHEN user pays directly (skips trial)
  premium → cancelled:    WHEN user cancels (access until period end)
  cancelled → expired:    WHEN paid period ends
  cancelled → premium:    WHEN user resubscribes before expiry
  expired → free:         WHEN grace period (3d) ends
  expired → premium:      WHEN user resubscribes during grace
  free → churned:         WHEN inactive 60+ days
  expired → churned:      WHEN inactive 60+ days

Paywall Triggers:
  - Lesson 4 access (free user)
  - AI Coach access (free user)
  - Duel creation (free user)
  - Advanced meal analytics (free user)
```
