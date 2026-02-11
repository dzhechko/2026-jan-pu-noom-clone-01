# Specification

## Overview
Детальная спецификация MVP платформы «Весна» — CBT-based weight management app. Содержит полные user stories с acceptance criteria в Gherkin-формате, NFR-спецификации, data model и API contracts.

---

## 1. Feature Map (MVP)

```
┌──────────────────────────────────────────────────────┐
│                    ВЕСНА MVP                          │
├───────────┬───────────┬──────────┬───────────────────┤
│ F1        │ F2        │ F3       │ F4                │
│ C-Screen  │ CBT       │ AI Coach │ Meal Tracker      │
│ Quiz      │ Lessons   │          │                   │
├───────────┼───────────┼──────────┼───────────────────┤
│ F5        │ F6        │ F7       │ F8                │
│ Gamifi-   │ Referral  │ Auth &   │ Notifications     │
│ cation    │ Дуэль     │ Profile  │ & Push            │
├───────────┼───────────┼──────────┼───────────────────┤
│ F9        │ F10       │          │                   │
│ Paywall & │ Analytics │          │                   │
│ Payments  │ & Events  │          │                   │
└───────────┴───────────┴──────────┴───────────────────┘
```

---

## 2. User Stories & Acceptance Criteria

### F1: C-Screen Quiz (Medical Aha)

**Epic:** Новый пользователь проходит скрининг и получает Medical Aha-момент

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-001 | новый пользователь | начать quiz без регистрации | попробовать без обязательств | Must | 3 |
| US-002 | новый пользователь | ответить на 12 вопросов за <2 мин | быстро получить результат | Must | 5 |
| US-003 | новый пользователь | увидеть метаболический возраст с визуализацией | испытать Medical Aha | Must | 8 |
| US-004 | новый пользователь | увидеть персональные риски (top-3) | понять серьёзность | Must | 5 |
| US-005 | новый пользователь | получить персональный план действий | знать, что делать | Must | 3 |
| US-006 | система | определить BMI-категорию → routing на tier | предложить правильный продукт | Must | 3 |
| US-007 | вернувшийся пользователь | продолжить незавершённый quiz | не начинать заново | Should | 2 |

```gherkin
Feature: C-Screen Quiz

  Background:
    Given the app is installed and opened for the first time

  Scenario: Full quiz completion with Medical Aha
    Given I am on the quiz start screen
    When I answer all 12 questions:
      | question_type | example |
      | demographics  | gender: female, age: 32, height: 165, weight: 78 |
      | lifestyle     | activity: sedentary, sleep: 6h, stress: high |
      | nutrition     | meals_per_day: 2, snacking: often, water: 4_glasses |
      | medical       | conditions: none, medications: none |
    Then I see a loading animation "Анализируем ваш профиль..." (2-3 sec)
    And I see my metabolic age as a large number (e.g., "47")
    And I see my passport age below it (e.g., "32")
    And I see a visual comparison (gauge/bar) showing the gap
    And I see top-3 personalized risk factors with icons
    And I see a CTA button "Получить персональный план"
    And the total quiz time was under 2 minutes

  Scenario: Quiz progress persistence
    Given I answered questions 1-6
    When I close the app
    And I reopen the app within 24 hours
    Then I see "Продолжить с вопроса 7?" prompt
    When I tap "Продолжить"
    Then I resume from question 7 with previous answers preserved

  Scenario: BMI-based tier routing
    Given I completed the quiz
    When my calculated BMI is between 18.5 and 24.9
    Then I see: "Ваш вес в норме! Мы поможем сохранить результат"
    And I am offered Free tier
    When my calculated BMI is between 25.0 and 29.9
    Then I see: "Вам подойдёт программа Premium"
    And I am offered Premium trial (7 days free, then ₽499/мес)
    When my calculated BMI is 30.0 or above
    Then I see: "Рекомендуем медицинскую программу"
    And I see both Premium and Clinical tier options

  Scenario: Metabolic age calculation
    Given I provided: age=32, weight=78, height=165, activity=sedentary, sleep=6h
    When the system calculates metabolic age
    Then the formula uses: BMI + activity_penalty + sleep_penalty + stress_penalty
    And metabolic_age = passport_age + weighted_penalties
    And the result is between passport_age-5 and passport_age+25
    And the result is displayed as an integer

  Scenario: Invalid quiz inputs
    Given I am on a question requiring numeric input
    When I enter a negative number or text
    Then I see inline validation error "Введите корректное значение"
    And the Next button remains disabled
```

### F2: CBT Micro-Lessons

**Epic:** Пользователь проходит ежедневные CBT-уроки для изменения пищевого поведения

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-010 | пользователь | видеть сегодняшний урок на dashboard | знать, что делать | Must | 2 |
| US-011 | пользователь | прочитать урок за 3-5 минут | не тратить много времени | Must | 5 |
| US-012 | пользователь | ответить на quiz (3 вопроса) | закрепить материал | Must | 3 |
| US-013 | пользователь | получить практическое задание | применить CBT в жизни | Must | 3 |
| US-014 | пользователь | видеть прогресс X/14 уроков | ощущать движение | Must | 2 |
| US-015 | Free user | видеть уроки 1-3 бесплатно | получить ценность до оплаты | Must | 2 |
| US-016 | Free user | увидеть paywall на уроке 4 | принять решение о подписке | Must | 3 |

```gherkin
Feature: CBT Micro-Lessons

  Background:
    Given I am a registered user
    And I have completed the C-screen quiz

  Scenario: View and complete daily lesson
    Given today is day 3 of my program
    When I open the app
    Then I see on dashboard: "Урок 3: Эмоциональное переедание"
    When I tap on the lesson
    Then I see lesson content with:
      | section | content_type | duration |
      | Теория  | text + illustration | 1-2 min |
      | Пример  | story/scenario | 1 min |
      | Quiz    | 3 multiple-choice | 1 min |
      | Задание | practical exercise | 0.5 min |
    When I read all sections and answer 2/3 quiz questions correctly
    Then the lesson is marked as completed ✅
    And my progress updates to "3/14 уроков"
    And my streak counter increments by 1
    And I receive +10 XP

  Scenario: Quiz retry on failure
    Given I am in lesson 3 quiz
    When I answer 0/3 or 1/3 correctly
    Then I see "Попробуйте ещё раз! Перечитайте раздел 'Теория'"
    And I can retry the quiz (max 3 attempts)
    And on 3rd failure, lesson is marked as "completed with review needed"

  Scenario: Free tier lesson limit
    Given I am a Free tier user
    And I completed lessons 1, 2, 3
    When I try to access lesson 4
    Then I see a paywall screen:
      | element | content |
      | title | "Продолжите свой путь" |
      | description | "Уроки 4-14 доступны в Premium" |
      | offer | "Попробуйте 7 дней бесплатно" |
      | price | "Затем ₽499/мес" |
      | cta_primary | "Начать бесплатный период" |
      | cta_secondary | "Не сейчас" |

  Scenario: Lesson sequential access
    Given I completed lessons 1-4
    When I view the lesson list
    Then lessons 1-4 show ✅
    And lesson 5 shows "Доступен" with CTA
    And lessons 6-14 show 🔒 with "Сначала пройдите предыдущий"
```

### F3: AI Coach

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-020 | Premium user | задать вопрос AI-коучу | получить CBT-совет | Must | 8 |
| US-021 | Premium user | получить контекстный ответ (знает мой прогресс) | чувствовать персонализацию | Must | 5 |
| US-022 | Premium user | видеть suggested questions | знать, что спросить | Should | 3 |
| US-023 | система | отклонять медицинские запросы вне CBT | не навредить | Must | 5 |

```gherkin
Feature: AI Coach

  Background:
    Given I am a Premium user
    And I have completed lessons 1-5

  Scenario: Ask about emotional eating
    When I open the coach chat
    And I type "Я опять переела вечером, что делать?"
    Then within 5 seconds I see a response that:
      | criterion | check |
      | uses CBT technique | references a concept from lessons 1-5 |
      | tone is supportive | no judgment, no blame |
      | actionable | includes 1-2 specific steps |
      | length | 50-200 words |
      | language | Russian, conversational |

  Scenario: Medical question guardrail
    When I type "Мне нужно назначить оземпик, какая дозировка?"
    Then the coach responds:
      "Я могу помочь с вопросами о поведении и привычках,
       но назначение лекарств — компетенция врача. 
       Рекомендую обратиться к эндокринологу."
    And does NOT provide drug dosage information

  Scenario: Context-aware suggestions
    Given I completed lesson 5 about "trigger foods"
    When I open the coach chat
    Then I see 3 suggested questions:
      | "Как определить мои триггерные продукты?" |
      | "Что делать, если я сорвалась?" |
      | "Как практиковать осознанное питание?" |
    And suggestions relate to my current lesson progress

  Scenario: Free user coach access
    Given I am a Free tier user
    When I try to open the coach chat
    Then I see "AI-коуч доступен в Premium"
    And I see a preview of what coach can do
    And a CTA to upgrade
```

### F4: Meal Tracker

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-030 | пользователь | сфотографировать еду | автоматически получить калории/БЖУ | Must | 8 |
| US-031 | пользователь | скорректировать результат распознавания | улучшить точность | Must | 3 |
| US-032 | пользователь | найти блюдо в поиске (fallback) | ввести вручную, если фото не сработало | Must | 5 |
| US-033 | пользователь | видеть дневную сводку | контролировать питание | Must | 3 |
| US-034 | пользователь | видеть «светофор» (норма/внимание/превышение) | быстро оценить ситуацию | Should | 2 |

```gherkin
Feature: Meal Tracker

  Scenario: Photo-based meal logging
    Given I am on the meal tracker screen
    When I tap the camera button
    And I take a photo of my lunch (plate of pasta)
    Then within 3 seconds I see:
      | field | value |
      | dish_name | "Паста с томатным соусом" |
      | calories | 450 kcal |
      | protein | 15g |
      | fat | 12g |
      | carbs | 65g |
      | portion | "~300g" |
    And I see "Верно?" with buttons [Да] [Изменить]
    When I tap [Да]
    Then the meal is added to my daily log for the current meal slot

  Scenario: Manual search fallback
    Given the AI returned "Не удалось распознать"
    When I tap "Найти вручную"
    Then I see a search bar
    When I type "борщ"
    Then I see results from the food database:
      | name | calories_per_100g |
      | Борщ домашний | 49 |
      | Борщ с мясом | 76 |
      | Борщ холодный | 35 |
    When I select "Борщ с мясом" and set portion to "350 мл"
    Then calories are calculated as 266 kcal
    And the meal is added to my daily log

  Scenario: Daily summary with traffic light
    Given I logged 3 meals today totaling 1,850 kcal
    And my daily target is 1,800 kcal
    When I view the daily summary
    Then I see:
      | metric | value | indicator |
      | Calories | 1,850 / 1,800 | 🟡 (slightly over) |
      | Protein | 72g / 80g | 🟡 |
      | Water | 6 / 8 glasses | 🟡 |
    And the overall day status is "Почти идеально! 🟡"
```

### F5: Gamification

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-040 | пользователь | видеть streak counter | не хотеть прервать серию | Must | 2 |
| US-041 | пользователь | получать XP за действия | чувствовать прогресс | Should | 3 |
| US-042 | пользователь | видеть свой уровень | иметь долгосрочную цель | Should | 2 |
| US-043 | пользователь | получать badges | коллекционировать достижения | Should | 3 |

```gherkin
Feature: Gamification

  Scenario: Streak counter
    Given my current streak is 5 days
    When I complete today's lesson + log at least 1 meal
    Then my streak updates to 6 days
    And I see a flame animation 🔥
    When the next day I do NOT complete a lesson or log a meal by 23:59
    Then my streak resets to 0
    And I see "Серия прервана. Начните заново!"

  Scenario: XP and Level progression
    Given I am Level 1 "Новичок" with 0 XP
    And level thresholds are:
      | level | name | xp_required |
      | 1 | Новичок | 0 |
      | 2 | Ученик | 100 |
      | 3 | Адепт | 300 |
      | 4 | Мастер | 700 |
      | 5 | Сенсей | 1500 |
    When I earn XP from:
      | action | xp |
      | Complete lesson | 10 |
      | Perfect quiz (3/3) | 5 |
      | Log meal | 3 |
      | Complete daily goals | 15 |
      | 7-day streak bonus | 50 |
    Then my XP accumulates
    And when I reach 100 XP I level up to "Ученик"
    And I see a celebration animation
```

### F6: Referral «Дуэль»

| ID | As a... | I want to... | So that... | Priority | Points |
|----|---------|--------------|------------|:--------:|:------:|
| US-050 | Premium user | вызвать друга на 7-дневный челлендж | мотивировать друг друга | Should | 8 |
| US-051 | приглашённый | пройти C-screen по invite-ссылке | попробовать app | Should | 3 |
| US-052 | оба участника | видеть сравнительный прогресс | соревноваться | Should | 5 |
| US-053 | победитель | получить badge "Чемпион Дуэли" | хвастаться достижением | Should | 2 |

```gherkin
Feature: Referral Duel

  Scenario: Create and send duel invite
    Given I am a Premium user
    When I tap "Вызвать друга" on the Дуэль screen
    Then the system generates a unique deeplink
    And I see share options (Telegram, WhatsApp, VK, copy link)
    When I share via Telegram
    Then my friend receives a message:
      "[Имя] вызывает вас на 7-дневный ЗОЖ-челлендж! 💪"

  Scenario: Friend accepts duel
    Given my friend opened the duel link
    When they complete the C-screen quiz
    And they register
    Then the duel is activated
    And both participants see a shared dashboard with:
      | metric | player_1 | player_2 |
      | Lessons completed | 0 | 0 |
      | Meals logged | 0 | 0 |
      | Streak | 0 | 0 |
      | Total score | 0 | 0 |
    And a 7-day countdown timer starts

  Scenario: Duel scoring
    Given a duel is active
    When a participant completes actions:
      | action | points |
      | Complete lesson | 10 |
      | Log meal | 5 |
      | Maintain streak | 5/day |
    Then the leaderboard updates in real-time
    And at day 7, the participant with more points wins
    And the winner receives "Чемпион Дуэли" badge + 100 XP
```

### F7: Auth & Profile

```gherkin
Feature: Authentication

  Scenario: Email registration
    Given I completed the C-screen quiz
    When I tap "Сохранить результаты"
    Then I see registration form with: email, password, name
    When I enter valid data and tap "Создать аккаунт"
    Then my account is created
    And my quiz results are linked to the account
    And I receive a confirmation email

  Scenario: VK OAuth login
    Given I am on the registration screen
    When I tap "Войти через VK"
    Then VK OAuth flow opens
    When I authorize the app
    Then my account is created with VK profile data
    And I skip email/password fields

  Scenario: Profile view
    Given I am logged in
    When I navigate to Profile
    Then I see:
      | section | content |
      | Avatar + Name | Мария |
      | Level | "Ученик (Level 2)" |
      | Streak | "12 дней 🔥" |
      | Subscription | "Premium (до 15.04.2026)" |
      | Medical Aha | "Метаболический возраст: 47" |
      | Progress | "8/14 уроков пройдено" |
```

### F9: Paywall & Payments

```gherkin
Feature: Subscription Management

  Scenario: Start free trial
    Given I am a Free user viewing the paywall
    When I tap "Попробуйте 7 дней бесплатно"
    Then RevenueCat initiates a subscription with 7-day trial
    And I see confirmation "Trial активен до [дата]"
    And all Premium features unlock immediately
    And I receive a push reminder 1 day before trial ends

  Scenario: Trial expiry → payment
    Given my trial ends tomorrow
    When I receive a push "Ваш trial заканчивается завтра"
    And the trial period expires
    Then ₽499 is charged via App Store / Google Play
    And my subscription continues without interruption

  Scenario: Cancel subscription
    Given I am a paying Premium subscriber
    When I navigate to Settings > Subscription > Cancel
    Then I see "Что вы потеряете:" list
    And a downgrade offer (₽299/мес reduced plan)
    And a pause option (1 month freeze)
    When I confirm cancellation
    Then the subscription is cancelled at period end
    And I keep access until the paid period expires
    And I receive an exit survey (4 questions)
```

---

## 3. Data Model (Core Entities)

```
User
├── id: UUID
├── email: String (unique)
├── password_hash: String
├── name: String
├── created_at: DateTime
├── subscription_tier: Enum(free, premium, clinical)
├── subscription_expires_at: DateTime?
├── vk_id: String?
└── settings: JSON

MedicalProfile (1:1 with User)
├── id: UUID
├── user_id: FK → User
├── gender: Enum(male, female)
├── birth_date: Date
├── height_cm: Int
├── weight_kg: Decimal
├── bmi: Decimal (computed)
├── metabolic_age: Int (computed)
├── activity_level: Enum(sedentary, light, moderate, active)
├── risks: JSON (top-3 computed risks)
├── quiz_answers: JSON (raw C-screen answers)
└── updated_at: DateTime

LessonProgress (1:many with User)
├── id: UUID
├── user_id: FK → User
├── lesson_id: Int (1-14)
├── status: Enum(locked, available, completed, review_needed)
├── quiz_score: Int (0-3)
├── completed_at: DateTime?
└── xp_earned: Int

MealLog (1:many with User)
├── id: UUID
├── user_id: FK → User
├── meal_type: Enum(breakfast, lunch, dinner, snack)
├── dish_name: String
├── photo_url: String?
├── calories: Int
├── protein_g: Decimal
├── fat_g: Decimal
├── carbs_g: Decimal
├── portion_g: Int
├── recognition_method: Enum(ai_photo, manual_search, manual_entry)
├── ai_confidence: Decimal?
└── logged_at: DateTime

CoachMessage (1:many with User)
├── id: UUID
├── user_id: FK → User
├── role: Enum(user, assistant)
├── content: Text
├── context: JSON (lesson_progress, recent_meals)
└── created_at: DateTime

Streak
├── id: UUID
├── user_id: FK → User
├── current_streak: Int (days)
├── longest_streak: Int (days)
├── last_active_date: Date
└── updated_at: DateTime

Gamification
├── id: UUID
├── user_id: FK → User
├── xp_total: Int
├── level: Int (1-5)
├── badges: JSON (array of badge_ids)
└── updated_at: DateTime

Duel (many:many Users)
├── id: UUID
├── challenger_id: FK → User
├── opponent_id: FK → User
├── status: Enum(pending, active, completed, expired)
├── start_date: Date
├── end_date: Date
├── challenger_score: Int
├── opponent_score: Int
├── winner_id: FK → User?
└── created_at: DateTime
```

---

## 4. API Contracts (Key Endpoints)

### Quiz API
```
POST /api/quiz/start
  → { quiz_id, questions: [...] }

POST /api/quiz/submit
  Body: { quiz_id, answers: [...] }
  → { metabolic_age, bmi, bmi_category, risks: [...], recommended_tier }

POST /api/quiz/save-progress
  Body: { quiz_id, answers_so_far: [...], current_question: N }
  → { saved: true }
```

### Lessons API
```
GET /api/lessons
  → { lessons: [{ id, title, status, xp_reward }] }

GET /api/lessons/:id
  → { id, title, content_sections: [...], quiz: [...], assignment }

POST /api/lessons/:id/complete
  Body: { quiz_answers: [...] }
  → { score, xp_earned, streak_updated, next_lesson_id }
```

### Coach API
```
POST /api/coach/message
  Body: { message: "user text" }
  → { response: "coach text", suggested_questions: [...] }
  Headers: { X-User-Context: base64(lesson_progress + recent_meals) }
```

### Meals API
```
POST /api/meals/recognize
  Body: FormData { photo: File }
  → { dish_name, calories, protein, fat, carbs, confidence, alternatives: [...] }

POST /api/meals/log
  Body: { dish_name, calories, protein, fat, carbs, portion_g, meal_type, photo_url? }
  → { id, daily_summary: { total_cal, target_cal, status } }

GET /api/meals/daily?date=YYYY-MM-DD
  → { meals: [...], summary: { calories, protein, fat, carbs, status } }
```

### Gamification API
```
GET /api/gamification/status
  → { xp, level, level_name, streak, badges: [...], next_level_xp }
```

### Duel API
```
POST /api/duels/create
  → { duel_id, invite_link, expires_at }

POST /api/duels/:id/accept
  Body: { opponent_user_id }
  → { duel: { status: "active", start_date, end_date } }

GET /api/duels/:id/scoreboard
  → { challenger: { score, lessons, meals, streak }, opponent: { ... }, days_remaining }
```

---

## 5. Non-Functional Specifications

### Performance Budget
| Operation | P50 | P99 | Max |
|-----------|:---:|:---:|:---:|
| Quiz question load | 50ms | 150ms | 300ms |
| Quiz result calculation | 200ms | 500ms | 1s |
| Lesson content load | 100ms | 300ms | 500ms |
| Meal photo recognition | 1s | 3s | 5s |
| AI coach response | 1.5s | 5s | 10s |
| Daily summary load | 80ms | 200ms | 400ms |
| Duel scoreboard update | 100ms | 300ms | 500ms |

### Security Requirements
| Requirement | Implementation | Priority |
|-------------|----------------|:--------:|
| Password hashing | bcrypt, 12 rounds | Must |
| JWT tokens | RS256, 15min access, 7d refresh | Must |
| Rate limiting | 100 req/min per user, 10 req/min for auth | Must |
| Medical data encryption | AES-256 at rest (MedicalProfile table) | Must |
| Input validation | Zod schemas on all API inputs | Must |
| CORS | Whitelist app domains only | Must |
| SQL injection | Prisma ORM (parameterized queries) | Must |
| XSS prevention | Content-Security-Policy headers | Must |
| API keys (external) | AES-GCM 256-bit in IndexedDB (client-side) | Must |

### Localization
| Aspect | Requirement |
|--------|-------------|
| Language | Russian (primary), English (future) |
| Date format | DD.MM.YYYY |
| Currency | ₽ (RUB) |
| Weight units | kg (default), lbs (setting) |
| Food database | Russian dishes priority (борщ, пельмени, etc.) |
| Timezone | Auto-detect, default MSK (UTC+3) |
