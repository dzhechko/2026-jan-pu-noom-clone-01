# Product Requirements Document

**Product:** Весна — CBT-based Weight Management Platform  
**Version:** 0.1 (MVP)  
**Author:** Product Discovery (Modules 1-6)  
**Last Updated:** 2026-02-10  
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Purpose
«Весна» — первая в России платформа для управления весом, объединяющая когнитивно-поведенческую терапию (CBT), AI-коучинг и медицинский надзор. Продукт адаптирует модель Noom ($1B ARR) для российского рынка с 30M+ потенциальных пользователей, используя Medical Aha-момент как центральный конверсионный механизм.

### 1.2 Scope

**In Scope (MVP):**
- C-screen quiz (Medical Aha: метаболический возраст + персональные риски)
- 14 CBT micro-lessons (2-недельная программа)
- AI-коуч на базе Claude API (персональные рекомендации)
- Meal tracker с AI-распознаванием фото
- Gamification: streaks, levels, weekly reports
- Referral «Дуэль» v1 (социальный челлендж)
- Freemium модель: Free / Premium ₽499/мес

**Out of Scope (MVP):**
- Clinical tier (врачи-эндокринологи) — Phase 2 (M4+)
- GLP-1 координация — Phase 2 (M6+)
- B2B корпоративный wellness — Phase 3 (M12+)
- Полная CBT-программа 200+ уроков — post-MVP
- Wearable интеграции (Apple Watch, Mi Band) — Phase 2
- Веб-версия (PWA) — Phase 2

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| CBT | Cognitive Behavioral Therapy — когнитивно-поведенческая терапия |
| C-screen | Screening quiz с медицинскими маркерами (BMI, метаболический возраст, риски) |
| Medical Aha | Момент осознания через C-screen: «мой метаболический возраст 47 при паспортных 32» |
| Дуэль | Социальный механизм: два пользователя соревнуются по CBT-прогрессу за 7 дней |
| GLP-1 | Glucagon-like peptide-1 — класс препаратов для снижения веса (Ozempic, Wegovy) |
| ARPU | Average Revenue Per User — средний доход на пользователя |

---

## 2. Product Vision

### 2.1 Vision Statement
> Стать №1 платформой в России для научно обоснованного управления весом, где люди меняют отношение к еде через понимание психологии поведения, а не через подсчёт калорий.

### 2.2 Problem Statement

**Problem:** 30M+ россиян с избыточным весом используют калорийные трекеры (FatSecret, MyFitnessPal), которые борются с симптомами (калории), а не причиной (поведение). 95% диет заканчиваются возвратом веса в течение года.

**Impact:** Ожирение — причина №2 предотвратимых смертей. Рынок $500M+, но ни один продукт в РФ не объединяет CBT + медицину + AI.

**Current Solutions:**
- FatSecret — лидер по DAU, но чистый calorie tracker без CBT/медицины
- Yazio — premium трекер, нет психологии
- MyFitnessPal — не адаптирован для РФ
- Офлайн диетологи — дорого (₽3,000-5,000/визит), не масштабируется

### 2.3 Strategic Alignment
Продукт занимает Blue Ocean позицию: CBT + Medical + AI — незанятая ниша в РФ. Модель Noom доказана на $1B ARR, но не локализована для Russia/CIS.

### 2.4 Success Metrics

| Metric | Current (0) | Target M3 | Target M6 | Target M12 |
|--------|:-----------:|:---------:|:---------:|:----------:|
| Total users | 0 | 2,000 | 15,000 | 80,000 |
| Paying users | 0 | 80 | 750 | 4,000 |
| MRR (₽K) | 0 | 45 | 488 | 2,600 |
| Free→Paid (30d) | — | 4% | 5% | 6% |
| D30 retention (all) | — | 10% | 12% | 14% |
| NPS | — | >35 | >40 | >45 |
| Sean Ellis «Very disappointed» | — | >40% | — | — |

---

## 3. Target Users

### 3.1 Primary Persona: «Мария»

| Attribute | Description |
|-----------|-------------|
| **Role** | Работающая женщина 28-42, мотивированная на изменения |
| **Demographics** | Городская Россия (Москва, СПб, города 500K+), доход средний+, BMI 25-30 |
| **Goals** | Похудеть навсегда, понять причины переедания, сформировать здоровые привычки |
| **Pain Points** | Пробовала 3+ диеты, срывается, чувствует вину, не понимает «почему опять набрала» |
| **Technical Proficiency** | Medium — использует Instagram, VK, мессенджеры, health-apps |
| **Usage Frequency** | Daily (CBT-урок + meal tracking) |

### 3.2 Secondary Persona: «Андрей»

| Attribute | Description |
|-----------|-------------|
| **Role** | Мужчина 35-50, BMI 30+, первое обращение за помощью |
| **Demographics** | Городская Россия, IT/офисная работа, доход средний-высокий |
| **Goals** | Снизить вес по рекомендации врача, контроль метаболических рисков |
| **Pain Points** | Не готов к «диетам», хочет научный подход, боится осуждения |
| **Technical Proficiency** | High — tech-savvy, ценит data-driven подход |
| **Usage Frequency** | Daily (tracking) + Weekly (reports) |

### 3.3 Anti-Personas
- Профессиональные спортсмены (нужна спортивная нутрициология, не CBT)
- Люди с расстройствами пищевого поведения (нужна клиническая помощь, не app)
- Те, кто ищет «волшебную таблетку» без усилий (CBT требует вовлечённости)

---

## 4. Requirements

### 4.1 Functional Requirements

#### 4.1.1 Feature: C-Screen Quiz (Medical Aha)

**Description:** Интерактивный quiz из 12-15 вопросов, вычисляющий метаболический возраст, BMI, персональные риски и генерирующий Medical Aha-момент.

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-001 | новый пользователь | пройти 2-мин quiz о здоровье | узнать свой метаболический возраст и риски | Must | M |
| US-002 | новый пользователь | увидеть персональный отчёт с визуализацией | осознать разницу между паспортным и метаболическим возрастом | Must | M |
| US-003 | новый пользователь | получить персональный план после quiz | понять, что делать дальше | Must | S |
| US-004 | система | определить BMI-категорию пользователя | предложить правильный tier (Free/Premium/Clinical) | Must | S |

```gherkin
Feature: C-Screen Quiz

  Scenario: Complete quiz and see Medical Aha
    Given I am a new unregistered user
    When I answer all 12 quiz questions honestly
    Then I see my metabolic age visualization
    And I see comparison with my passport age
    And I see top-3 personalized health risks
    And I see a recommended action plan
    And I am prompted to register to save results

  Scenario: Partial quiz completion
    Given I started the quiz
    When I close the app after question 6
    Then my progress is saved locally
    And when I return, I can resume from question 7

  Scenario: BMI-based tier routing
    Given I completed the quiz
    When my BMI is 25-30
    Then I am recommended Premium tier (₽499/мес)
    When my BMI is 30+
    Then I am shown Clinical tier option (₽4,990/мес)
    When my BMI is <25
    Then I am offered Free tier with CBT-lessons
```

#### 4.1.2 Feature: CBT Micro-Lessons

**Description:** 14 интерактивных уроков (3-5 мин каждый) по когнитивно-поведенческой терапии для изменения пищевых привычек. Каждый урок: теория → пример → quiz → практическое задание.

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-005 | пользователь | проходить 1 CBT-урок в день за 3-5 мин | постепенно менять отношение к еде | Must | L |
| US-006 | пользователь | отвечать на quiz после урока | закрепить знания и получить feedback | Must | M |
| US-007 | пользователь | получить практическое задание | применить CBT-технику в реальной жизни | Must | M |
| US-008 | пользователь | видеть прогресс по урокам (X/14) | чувствовать достижения и мотивацию | Must | S |

```gherkin
Feature: CBT Micro-Lessons

  Scenario: Complete a daily lesson
    Given I am a registered user on day 3
    When I open the app
    Then I see today's lesson "Урок 3: Эмоциональное переедание"
    When I read the lesson content (est. 3 min)
    And I answer 3 quiz questions correctly
    Then I receive a practical assignment
    And my progress updates to 3/14
    And my streak counter increments

  Scenario: Lesson locked until previous complete
    Given I completed lessons 1-5
    When I try to access lesson 7
    Then I see "Сначала пройдите урок 6"
    And lesson 7 is locked

  Scenario: Free user lesson limit
    Given I am a Free tier user
    When I complete lesson 3
    Then I see paywall: "Уроки 4-14 доступны в Premium"
    And I see trial offer (7 дней бесплатно)
```

#### 4.1.3 Feature: AI-Coach (Claude API)

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-009 | пользователь | задать вопрос AI-коучу в чате | получить CBT-рекомендацию в реальном времени | Must | L |
| US-010 | пользователь | получить персональный совет на основе моего прогресса | видеть, что коуч «знает» мою историю | Should | M |
| US-011 | пользователь | получить push от коуча при пропуске 2 дней | вернуться к программе | Should | S |

```gherkin
Feature: AI Coach

  Scenario: Ask coach about emotional eating
    Given I am a Premium user
    When I type "Я опять переела вечером, что делать?"
    Then the AI coach responds within 3 seconds
    And the response uses CBT-technique from my current lesson
    And the tone is supportive, not judgmental
    And the response length is 50-150 words

  Scenario: Coach context awareness
    Given I completed lesson 5 about "trigger foods"
    When I ask the coach about my eating habits
    Then the response references lesson 5 concepts
    And suggests applying the technique from my last assignment
```

#### 4.1.4 Feature: Meal Tracker

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-012 | пользователь | сфотографировать еду → получить калории и БЖУ | трекать питание без ручного ввода | Must | L |
| US-013 | пользователь | скорректировать распознанное блюдо | улучшить точность | Must | M |
| US-014 | пользователь | видеть дневную сводку калорий и БЖУ | контролировать питание | Must | M |
| US-015 | пользователь | видеть «светофор» (зелёный/жёлтый/красный) | быстро понять, всё ли ок | Should | S |

```gherkin
Feature: Meal Tracker

  Scenario: Photo-based meal logging
    Given I am a logged-in user
    When I tap "+" and take a photo of my lunch
    Then the AI identifies the dish within 3 seconds
    And shows estimated calories, protein, fat, carbs
    And I can confirm or edit the recognition
    And the meal is added to my daily log

  Scenario: Manual entry fallback
    Given the AI cannot identify my meal
    When I see "Не удалось распознать"
    Then I can search from a food database (>50K items)
    And manually enter portions
```

#### 4.1.5 Feature: Gamification System

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-016 | пользователь | видеть streak counter (дни подряд) | не хотеть потерять прогресс | Must | S |
| US-017 | пользователь | получать badges за достижения | чувствовать прогресс | Should | M |
| US-018 | пользователь | видеть свой level (Новичок → Сенсей) | иметь долгосрочную мотивацию | Should | S |
| US-019 | пользователь | видеть weekly progress report | оценить результаты за неделю | Must | M |

#### 4.1.6 Feature: Referral «Дуэль»

| ID | As a... | I want to... | So that... | Priority | Effort |
|----|---------|--------------|------------|----------|--------|
| US-020 | пользователь | вызвать друга на 7-дневный ЗОЖ-челлендж | иметь социальную мотивацию | Should | L |
| US-021 | приглашённый друг | получить ссылку и пройти C-screen бесплатно | попробовать продукт через рекомендацию | Should | M |
| US-022 | оба участника | видеть сравнительный прогресс | соревноваться и поддерживать друг друга | Should | M |

### 4.2 Non-Functional Requirements

#### 4.2.1 Performance

| Metric | Requirement | Rationale |
|--------|-------------|-----------|
| API response (p50) | < 150ms | Smooth UX for meal tracking |
| API response (p99) | < 800ms | AI-coach responses acceptable delay |
| AI photo recognition | < 3s | User patience for photo→calories |
| AI coach response | < 5s | Conversational feel |
| App cold start | < 2s | Mobile standard |
| Concurrent users | 1,000 (M6) | 15K total ÷ 7% concurrent |

#### 4.2.2 Availability & Reliability

| Metric | Requirement |
|--------|-------------|
| Uptime SLA | 99.5% (MVP) → 99.9% (M12) |
| RTO | 4 hours (MVP) → 1 hour (M12) |
| RPO | 1 hour |
| Backup frequency | Daily (DB) + Real-time (critical data) |

#### 4.2.3 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | Email/password + OAuth (VK, Google) |
| Authorization | Role-based (free/premium/clinical/admin) |
| Data Encryption (at rest) | AES-256 for medical data, standard for rest |
| Data Encryption (in transit) | TLS 1.3 |
| API keys (external) | Client-side encrypted storage (AES-GCM 256-bit, IndexedDB) |
| Medical data | ГОСТ Р 52636-2006 compliance (patient data protection) |
| GDPR/ФЗ-152 | Personal data processing consent, right to deletion |

#### 4.2.4 Scalability

| Dimension | MVP (M3) | M6 | M12 | M24 |
|-----------|:--------:|:--:|:---:|:---:|
| Total users | 2,000 | 15,000 | 80,000 | 630,000 |
| Paying users | 80 | 750 | 4,000 | 31,500 |
| DB size (est.) | 1 GB | 10 GB | 50 GB | 500 GB |
| Requests/sec (peak) | 50 | 300 | 1,500 | 10,000 |

### 4.3 Technical Requirements

#### 4.3.1 Platform Support

| Platform | Minimum Version | Notes |
|----------|----------------|-------|
| Android | 8.0 (API 26) | 86% Russian mobile market |
| iOS | 14.0 | 14% market, higher ARPU |
| Web (M2+) | Chrome 90+, Safari 15+ | PWA for web2app strategy |

#### 4.3.2 Integration Requirements

| System | Type | Data Flow | Priority |
|--------|------|-----------|----------|
| Claude API (Anthropic) | REST API | Out (prompts) → In (responses) | Must |
| Food recognition AI | REST API | Out (images) → In (nutrition data) | Must |
| RevenueCat | SDK | Bidirectional (subscriptions) | Must |
| AppMetrica (Яндекс) | SDK | Out (events) | Must |
| OneSignal | SDK/API | Out (push triggers) → In (delivery stats) | Must |
| VK OAuth | OAuth 2.0 | Bidirectional (auth) | Should |

#### 4.3.3 Constraints

| Type | Description | Impact |
|------|-------------|--------|
| Technical | Distributed Monolith in Monorepo, Docker + Docker Compose | Architecture fixed |
| Technical | VPS deploy (AdminVPS/HOSTKEY), no cloud-native services | Manual scaling |
| Business | Bootstrap ₽6M budget for 6 months | Lean team, AI-first |
| Regulatory | Medical data requires ФЗ-152 compliance from day 1 | Extra security layer |
| Timeline | MVP ready for beta by Week 6 | Aggressive but feasible with Claude Code |

---

## 5. User Journeys

### 5.1 Journey: New User → Medical Aha → Premium Subscriber

**Persona:** Мария  
**Goal:** Понять причину лишнего веса и начать CBT-программу  
**Trigger:** Увидела рекламу в VK «Узнай свой метаболический возраст»

```
Step 1: C-Screen Landing
  User: Нажимает на рекламу → попадает на quiz
  System: Показывает первый вопрос (пол, возраст, рост, вес)
  → Step 2

Step 2: Quiz Completion (12 вопросов, 2 мин)
  User: Отвечает на вопросы (привычки, сон, стресс, физ.активность)
  System: Прогресс-бар, каждый вопрос = микро-инсайт
  → Step 3

Step 3: Medical Aha Moment ⭐
  User: Видит результат: «Ваш метаболический возраст: 47 лет (паспортный: 32)»
  System: Визуализация разрыва + top-3 риска + «У нас есть план»
  User: WOW-реакция → нажимает «Получить план»
  → Step 4

Step 4: Registration
  User: Email + password (или VK OAuth)
  System: Создаёт аккаунт, сохраняет quiz-данные → медпрофиль
  → Step 5

Step 5: Первый CBT-урок
  User: Проходит урок 1 «Почему диеты не работают» (3 мин)
  System: Quiz → практическое задание → streak = 1
  → Step 6

Step 6: Free → Premium Conversion (Day 3-7)
  User: Пытается открыть урок 4
  System: Paywall → «7 дней бесплатно, потом ₽499/мес»
  User: Начинает trial → становится Premium
  Outcome: Платящий подписчик ✅
```

### 5.2 Journey: Existing User → Дуэль → Friend Acquisition

**Persona:** Мария (Premium, Day 14+)  
**Goal:** Мотивация через соревнование  
**Trigger:** Pop-up «Пригласи друга на Дуэль!»

```
Step 1: Дуэль Invitation
  User: Нажимает «Вызвать друга» → генерируется invite link
  System: Deeplink с параметрами (referrer_id, challenge_type)
  → Step 2 (friend)

Step 2: Friend Receives Link
  Friend: Открывает ссылку → попадает на C-screen quiz
  System: «Мария вызвала вас на 7-дневный ЗОЖ-челлендж!»
  → Step 3 (friend)

Step 3: Friend Medical Aha + Registration
  Friend: Проходит quiz → Medical Aha → регистрируется
  System: Дуэль активирована, оба видят dashboard
  Outcome: Новый пользователь + Social loop ↻
```

---

## 6. UI/UX Requirements

### 6.1 Design Principles
- **Psychology-first:** Каждый экран усиливает мотивацию, не осуждает
- **Micro-wins:** Ежедневное ощущение прогресса (streak, badges, level)
- **Medical credibility:** Визуальный язык медицины (графики, показатели), не «фитнес-глянец»
- **Simplicity:** Главное действие на каждом экране очевидно

### 6.2 Key Screens

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| C-screen Quiz | Конверсия новых пользователей | Progress bar, медицинский визуал, Aha-visualization |
| Dashboard | Ежедневный хаб | Today's lesson, streak, meal summary, coach tip |
| CBT Lesson | Обучение | Text + illustration + quiz + assignment |
| AI Coach Chat | Поддержка | Chat interface, suggested questions, CBT-context |
| Meal Tracker | Трекинг питания | Camera button, daily log, calorie/macro bars |
| Дуэль Board | Соревнование | Side-by-side progress, leaderboard, 7-day timer |
| Profile | Прогресс и настройки | Level, streak history, subscription, settings |
| Weekly Report | Рефлексия | Charts, achievements, next week goals |

---

## 7. Release Strategy

### 7.1 MVP (Phase 1) — Week 3-6

| Feature | Priority | Status |
|---------|----------|--------|
| C-screen Quiz + Medical Aha | Must | Planned |
| 14 CBT micro-lessons | Must | Planned |
| AI Coach (basic) | Must | Planned |
| Meal tracker (photo AI) | Must | Planned |
| Gamification (streak, levels) | Must | Planned |
| Push notifications | Must | Planned |
| Freemium paywall (₽499) | Must | Planned |

**Success Criteria:** 20 beta users, D3 retention >25%, NPS >30

### 7.2 v1.0 (Phase 2) — M3-6

| Feature | Priority | Status |
|---------|----------|--------|
| Дуэль referral mechanic | Should | Planned |
| Weekly reports | Should | Planned |
| VK OAuth | Should | Planned |
| PWA web version | Should | Planned |
| Extended CBT program (28 уроков) | Should | Planned |
| Churn prediction (AI) | Could | Planned |

### 7.3 Future Phases

| Phase | Features | Timeline |
|-------|----------|:--------:|
| v1.5 | Clinical tier (врачи), GLP-1 coordination | M6-9 |
| v2.0 | B2B wellness, wearable integrations, advanced analytics | M12-18 |
| v3.0 | CIS expansion, marketplace (nutritionists), group programs | M18-24 |

---

## 8. Dependencies

### 8.1 External Dependencies

| Dependency | Provider | Risk | Mitigation |
|------------|----------|:----:|------------|
| Claude API | Anthropic | Low | Rate limits: implement caching + fallback responses |
| Food recognition AI | TBD (Clarifai/custom) | Medium | Start with FatSecret API, migrate to custom model |
| RevenueCat | RevenueCat | Low | Standard SDK, can replace with in-house billing |
| VPS hosting | AdminVPS/HOSTKEY | Low | Docker = portable, can migrate VPS in hours |
| RuStore / Google Play | Store review | Medium | Comply with medical app guidelines proactively |

---

## 9. Risks & Mitigations

| ID | Risk | Prob. | Impact | Mitigation |
|----|------|:-----:|:------:|------------|
| R-001 | Medical Aha doesn't convert as expected | Med | High | A/B test 3+ C-screen variants by W2 |
| R-002 | Free→Paid <2% | Med | High | Test pricing (₽299/₽499), trial length (7/14d), paywall position |
| R-003 | AI coach gives inappropriate medical advice | Low | High | Strict CBT-only prompt guard, medical disclaimer, human review pipeline |
| R-004 | ФЗ-152 medical data compliance | Low | High | Legal review M1, consent flow in onboarding |
| R-005 | Claude API rate limits or pricing changes | Low | Med | Response caching, fallback to pre-written responses for common queries |
| R-006 | Food recognition accuracy <80% | Med | Med | Manual correction UX, crowd-sourced food DB, FatSecret API fallback |

---

## 10. Open Questions

| ID | Question | Owner | Resolution |
|----|----------|-------|------------|
| Q-001 | Which food recognition API gives best RU accuracy? | CTO | Benchmark 3 APIs by W3 |
| Q-002 | CBT content: license from psychologist or create original? | CEO | Original with psychologist review |
| Q-003 | Medical disclaimer wording for C-screen | Legal | Review by W2 |
| Q-004 | RuStore vs Google Play: publish to both or one first? | Growth | Both simultaneously |
| Q-005 | Flutter vs React Native for mobile? | CTO | Flutter (single codebase, better perf) |
