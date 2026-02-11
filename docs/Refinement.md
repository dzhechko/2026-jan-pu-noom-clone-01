# Refinement

## Overview
Edge cases, тестовая стратегия, error handling matrix, performance optimization и security hardening для MVP «Весна».

---

## 1. Test Strategy

### 1.1 Test Pyramid

```
         ╱╲
        ╱ E2E ╲           5-10 critical flows
       ╱────────╲          Playwright (web) + Patrol (Flutter)
      ╱Integration╲       30-50 tests
     ╱──────────────╲      API endpoint tests (supertest)
    ╱   Unit Tests    ╲    100-200 tests
   ╱────────────────────╲  Business logic (Jest/Vitest)
```

### 1.2 Unit Tests

#### Quiz Module

| Test ID | Description | Input | Expected Output |
|---------|-------------|-------|-----------------|
| UT-Q001 | Normal BMI calculation | h=170, w=70 | bmi=24.2, category="normal" |
| UT-Q002 | Obese BMI calculation | h=165, w=95 | bmi=34.9, category="obese" |
| UT-Q003 | Metabolic age — sedentary + poor sleep | age=32, sedentary, sleep=5h, stress=high | metabolic_age ∈ [42, 52] |
| UT-Q004 | Metabolic age — active + good sleep | age=32, active, sleep=8h, stress=low | metabolic_age ∈ [28, 35] |
| UT-Q005 | Metabolic age clamping | age=25, all worst params | metabolic_age ≤ 50 (age+25) |
| UT-Q006 | Risk generation — BMI 31 | bmi=31, sedentary | risks includes "metabolic_syndrome" |
| UT-Q007 | Risk generation — good health | bmi=22, active, sleep=8h | risks = [] or low-severity only |
| UT-Q008 | Top-3 risk limit | all risks triggered | risks.length ≤ 3 |

#### Streak Module

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| UT-S001 | First activity ever | no existing streak | current=1, longest=1 |
| UT-S002 | Consecutive day | streak=5, last=yesterday | current=6 |
| UT-S003 | Same day duplicate | streak=5, last=today | current=5 (no change) |
| UT-S004 | Streak broken (2 days gap) | streak=10, last=2 days ago | current=1 |
| UT-S005 | 7-day milestone | streak=6, last=yesterday | bonus_xp=50 |
| UT-S006 | 30-day milestone | streak=29, last=yesterday | bonus_xp=200 |
| UT-S007 | Longest streak updates | current=15, longest=12 | longest=15 |
| UT-S008 | Longest streak preserved on break | current=1, longest=20 | longest=20 |

#### AI Coach Module

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| UT-C001 | Medical keyword detection | "какая дозировка оземпика?" | containsMedicalRequest = true |
| UT-C002 | Non-medical question | "как справиться с перееданием?" | containsMedicalRequest = false |
| UT-C003 | Edge: medical in CBT context | "урок о гормонах стресса" | containsMedicalRequest = false |
| UT-C004 | Context building | user with 5 lessons, 3 meals | context includes lesson_concepts, meals_summary |
| UT-C005 | Empty history | new user, no messages | recent_messages = [] |

#### Gamification Module

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| UT-G001 | XP → Level 2 | xp=100 | level=2, name="Ученик" |
| UT-G002 | XP → Level 5 | xp=1500 | level=5, name="Сенсей" |
| UT-G003 | XP below threshold | xp=99 | level=1, name="Новичок" |
| UT-G004 | Lesson XP: perfect score | quiz_score=3 | xp=15 (10+5 bonus) |
| UT-G005 | Lesson XP: partial score | quiz_score=2 | xp=10 |
| UT-G006 | Lesson XP: review needed | quiz_score=1 | xp=5 |

### 1.3 Integration Tests

| Test ID | Scenario | Steps | Expected |
|---------|----------|-------|----------|
| IT-001 | Full quiz → registration | POST /quiz/start → answer 12 → POST /quiz/submit → POST /auth/register | User created, MedicalProfile linked, metabolic_age computed |
| IT-002 | Lesson completion flow | GET /lessons → GET /lessons/1 → POST /lessons/1/complete | Progress updated, streak incremented, XP awarded |
| IT-003 | Meal photo → daily summary | POST /meals/recognize → POST /meals/log → GET /meals/daily | Meal in log, daily totals correct |
| IT-004 | Coach conversation | POST /coach/message (3 turns) | Responses contextual, history maintained |
| IT-005 | Subscription upgrade | POST /auth/register (free) → POST /subscriptions/trial → GET /lessons/4 | Lesson 4 accessible after trial start |
| IT-006 | Duel creation + acceptance | POST /duels/create → POST /duels/:id/accept (as other user) | Duel active, scoreboard initialized |
| IT-007 | Rate limiting | POST /auth/login × 11 within 1 min | 429 on 11th request |
| IT-008 | JWT refresh | Wait for access token expiry → POST /auth/refresh | New access token, old one rejected |

### 1.4 E2E Tests (Critical Flows)

| Test ID | Flow | Steps | Assertion |
|---------|------|-------|-----------|
| E2E-001 | New user onboarding | Open app → quiz → register → lesson 1 | Dashboard shows lesson 2 available |
| E2E-002 | Paywall conversion | Free user → open lesson 4 → start trial | Premium features unlock |
| E2E-003 | Daily engagement | Open app → complete lesson → log meal → see streak | Streak incremented, XP updated |
| E2E-004 | Coach interaction | Open coach → send message → receive response | Response appears within 5s |
| E2E-005 | Duel flow | Create duel → share link → friend accepts | Both see scoreboard |

---

## 2. Edge Cases & Error Handling

### 2.1 Error Handling Matrix

| Code | HTTP | Trigger | User Message (RU) | System Action |
|------|:----:|---------|-------------------|---------------|
| AUTH_001 | 401 | Invalid email/password | "Неверный email или пароль" | Log attempt, increment fail counter |
| AUTH_002 | 423 | 5 failed login attempts | "Аккаунт временно заблокирован. Попробуйте через 15 минут" | Block for 15min, alert if repeated |
| AUTH_003 | 429 | Rate limit exceeded | "Слишком много попыток. Подождите немного" | 429 response, log |
| AUTH_004 | 409 | Email already registered | "Этот email уже зарегистрирован. Войти?" | Suggest login |
| QUIZ_001 | 400 | Invalid quiz answers | "Проверьте правильность данных" | Return validation errors |
| QUIZ_002 | 404 | Quiz session not found | "Сессия истекла. Начните quiz заново" | Clear local storage |
| LESSON_001 | 403 | Free user accessing lesson 4+ | "Доступно в Premium" | Show paywall |
| LESSON_002 | 409 | Lesson already completed | "Урок уже пройден ✅" | Return existing progress |
| LESSON_003 | 400 | Lesson not unlocked yet | "Сначала пройдите предыдущий урок" | Return current available |
| MEAL_001 | 400 | Photo too large (>5MB) | "Файл слишком большой. Максимум 5 МБ" | Reject upload |
| MEAL_002 | 422 | Unrecognizable food photo | "Не удалось распознать. Попробуйте другое фото или найдите вручную" | Offer manual search |
| MEAL_003 | 503 | Food recognition API down | "Сервис распознавания временно недоступен. Введите вручную" | Fallback to manual, log incident |
| COACH_001 | 503 | Claude API timeout/error | "AI-коуч сейчас недоступен. Попробуйте через минуту" | Return cached response if possible, log |
| COACH_002 | 429 | Coach rate limit (20 msg/hr) | "Вы задали много вопросов. Передохните и вернитесь через час 😊" | Soft limit, rate limit |
| DUEL_001 | 403 | Free user creating duel | "Дуэли доступны в Premium" | Show upgrade CTA |
| DUEL_002 | 410 | Invite link expired | "Ссылка истекла. Попросите друга отправить новую" | — |
| DUEL_003 | 409 | Already has active duel | "У вас уже есть активная дуэль" | Show active duel |
| PAY_001 | 402 | Payment failed | "Оплата не прошла. Проверьте данные карты" | Log, suggest retry |
| PAY_002 | 502 | RevenueCat unavailable | "Сервис оплаты временно недоступен" | Queue for retry, log |
| GEN_001 | 500 | Unexpected server error | "Что-то пошло не так. Мы уже разбираемся" | Log full stack trace, alert team |
| GEN_002 | 503 | Service maintenance | "Проводим технические работы. Скоро вернёмся" | Maintenance page |

### 2.2 Edge Cases

#### Quiz Edge Cases
| Case | Handling |
|------|---------|
| User enters age <14 | Block: "Приложение для пользователей 14+" |
| User enters height >250cm or <100cm | Validation error: "Проверьте рост" |
| User enters weight >300kg or <30kg | Validation error: "Проверьте вес" |
| BMI calculates to <14 or >60 | Flag as likely error, allow but add warning |
| User changes timezone mid-quiz | Use quiz start timezone |
| Identical metabolic and passport age | Show: "Отличный результат! Поддержим форму" |
| Metabolic age younger than passport | Show: "Ваш организм моложе! Сохраним результат" |

#### Streak Edge Cases
| Case | Handling |
|------|---------|
| User changes timezone → "loses" a day | Use UTC dates, not local. Streak based on UTC day boundary |
| User completes lesson at 23:59 and meal at 00:01 | Both count for their respective UTC days |
| App offline for 2 days → comes back | Streak broken. Show: "Серия прервана, но это не конец! Начните заново" |
| User manipulates device clock | Server-side timestamp validation (reject if >5min diff from server time) |

#### Coach Edge Cases
| Case | Handling |
|------|---------|
| User sends empty message | Validate: "Напишите ваш вопрос" |
| User sends very long message (>2000 chars) | Truncate to 2000, process |
| User sends message in English | Coach responds in Russian (system prompt enforces) |
| User expresses suicidal ideation | Immediately respond with crisis helpline + suggest seeking professional help. Do NOT engage in CBT for this |
| User sends inappropriate content | Content filter → "Давайте сфокусируемся на здоровье" |
| Claude API returns error | Return last cached suggestion OR generic CBT tip from lesson pool |
| User asks same question repeatedly | Detect pattern, vary response, suggest re-reading lesson |

#### Payment Edge Cases
| Case | Handling |
|------|---------|
| Trial starts on Jan 30 (7-day = Feb 6) | Handle correctly across month boundaries |
| User uninstalls during trial | Subscription remains active in RevenueCat. On reinstall, restore purchases |
| Double subscription attempt | RevenueCat deduplicates. Return existing subscription |
| Currency change (RU sanctions) | RevenueCat handles App Store pricing. Our backend stores tier, not price |
| Refund granted by App Store | RevenueCat webhook → downgrade to free, preserve progress |

---

## 3. Performance Optimization

### 3.1 Caching Strategy

| Data | Cache Layer | TTL | Invalidation |
|------|-------------|:---:|--------------|
| Lesson content | Redis + Client | 24h | On content update (manual) |
| User session | Redis | 15min | On logout / token refresh |
| Coach context | Redis | 10min | On new lesson/meal |
| Daily meal summary | Redis | 5min | On new meal logged |
| Duel scoreboard | Redis | 30s | On score update |
| Food database search | Redis | 1h | Never (static data) |
| Metabolic age result | PostgreSQL only | — | On profile update |

### 3.2 API Optimization

| Optimization | Where | Impact |
|-------------|-------|--------|
| Response compression (gzip) | Nginx | -60% bandwidth |
| Database connection pooling | Prisma (pool_size=10) | -80% connection overhead |
| Image resize before upload | Client-side | -70% upload time |
| Lazy loading lesson content | Mobile app | -50% initial load |
| Pagination (cursor-based) | Meal history, coach messages | Constant query time |
| Batch insert for meals | Daily sync if offline | -80% write operations |

### 3.3 Database Indexes

```sql
-- Critical query indexes
CREATE INDEX idx_meal_logs_user_date ON meal_logs (user_id, logged_at);
CREATE INDEX idx_lesson_progress_user ON lesson_progress (user_id, lesson_id);
CREATE INDEX idx_coach_messages_user ON coach_messages (user_id, created_at);
CREATE INDEX idx_duels_status ON duels (status, end_date);
CREATE INDEX idx_users_email ON users (email);  -- already unique
CREATE INDEX idx_users_vk_id ON users (vk_id);  -- already unique
```

---

## 4. Security Hardening

### 4.1 Input Validation (Zod Schemas)

```typescript
// Example: Quiz submission validation
const QuizSubmitSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z.array(z.object({
    question_id: z.number().int().min(1).max(12),
    value: z.union([
      z.string().max(100),
      z.number().min(0).max(500),
      z.enum(["male", "female"]),
      z.enum(["sedentary", "light", "moderate", "active"]),
      z.enum(["low", "moderate", "high", "very_high"]),
    ])
  })).length(12)
});

// Meal log validation
const MealLogSchema = z.object({
  dish_name: z.string().min(1).max(200),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(500),
  portion_g: z.number().int().min(1).max(5000),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  photo_url: z.string().url().optional(),
});
```

### 4.2 Rate Limiting Rules

| Endpoint Group | Limit | Window | Action on Exceed |
|---------------|:-----:|:------:|-----------------|
| /auth/login | 10 | 1 min | 429 + 15min block after 5 consecutive |
| /auth/register | 5 | 1 min | 429 |
| /coach/message | 20 | 1 hour | 429 + friendly message |
| /meals/recognize | 30 | 1 hour | 429 |
| All other APIs | 100 | 1 min | 429 |
| Global per IP | 300 | 1 min | 429 |

### 4.3 Security Headers (Nginx)

```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; script-src 'self'";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

### 4.4 Medical Data Protection

| Measure | Implementation |
|---------|---------------|
| Encryption at rest | PostgreSQL pgcrypto for MedicalProfile fields |
| Access logging | Every read of MedicalProfile logged with user_id, timestamp, purpose |
| Data minimization | Only collect what's needed for metabolic age calculation |
| Right to deletion | DELETE /api/user/data → cascading delete all personal data |
| Consent | Registration includes ФЗ-152 consent checkbox (required) |
| Export | GET /api/user/export → JSON download of all personal data |
| Retention | Medical data retained while account active. Deleted 30d after account deletion |

---

## 5. Offline Support (Mobile)

| Feature | Offline Behavior | Sync Strategy |
|---------|-----------------|---------------|
| CBT Lessons | Cached locally after first view | Pre-fetch next 2 lessons |
| Meal Logging | Queue locally, sync on reconnect | FIFO queue, batch upload |
| Coach Chat | Unavailable offline (show message) | — |
| Quiz | In-progress saved locally | Submit on reconnect |
| Streak | Local counter (optimistic) | Server reconciliation on sync |
| Gamification | Local XP display (optimistic) | Server is source of truth |

---

## 6. Monitoring & Alerting (MVP-level)

| Metric | Tool | Alert Threshold | Channel |
|--------|------|:---------------:|---------|
| API response time (p99) | Custom middleware logging | >800ms for 5min | Telegram bot |
| Error rate (5xx) | Nginx access log parsing | >2% for 5min | Telegram bot |
| DB connection pool | Prisma metrics | >80% utilization | Telegram bot |
| Disk usage | cron + df | >85% | Telegram bot |
| Claude API errors | Application logs | >5 errors/hour | Telegram bot |
| SSL cert expiry | cron check | <14 days | Email |
| Docker health | docker healthcheck | Any container unhealthy | Telegram bot |
| Daily backup completion | Backup script exit code | Failed | Telegram bot |

### Logging Strategy

| Log Level | What | Retention |
|-----------|------|:---------:|
| ERROR | Unhandled exceptions, API failures, payment errors | 90 days |
| WARN | Rate limits hit, slow queries (>500ms), degraded services | 30 days |
| INFO | Auth events, subscription changes, duel events | 14 days |
| DEBUG | API requests (sanitized), cache hits/misses | 3 days (dev only) |

Format: JSON structured logs → stdout → Docker logs → rotate weekly.
