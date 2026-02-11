# Solution Strategy

## Problem Decomposition (First Principles)

### Root Problem
Люди с лишним весом используют инструменты, которые борются с симптомами (калории), а не причиной (поведение). Результат: 95% диет заканчиваются возвратом веса.

### First Principles Breakdown
1. **Лишний вес = поведенческая проблема**, не информационная (люди знают, что есть, но не могут остановиться)
2. **CBT доказанно меняет пищевое поведение** (Noom: $1B ARR подтверждает product-market fit)
3. **Россия = нет CBT-based weight management app** (Blue Ocean)
4. **AI может заменить human coaches** с 90% снижением затрат (Claude API vs $19-24/hr coaches)
5. **Medical integration усиливает trust** и конверсию (Medical Aha = 3-5x conversion lift)

### SCQA Framework
- **Situation:** 30M+ россиян с BMI >25, $500M+ рынок, digital health растёт
- **Complication:** Все существующие приложения — calorie trackers без CBT/медицины. Noom не локализован.
- **Question:** Как создать CBT+Medical+AI платформу для РФ с unit economics лучше Noom?
- **Answer:** Medical Aha (C-screen) → CBT micro-lessons → AI-coach → Social Дуэли. AI-first = 90% дешевле coaches, 20x дешевле CAC.

---

## TRIZ Contradictions & Resolutions

### Contradiction 1: Быстрый рост vs Качество пользователей

**Technical Contradiction:** Хотим расти быстро (volume), но это снижает quality of users → higher churn → worse economics

**TRIZ Principle #23 (Feedback):** Referral «Дуэль» = growth от самых вовлечённых пользователей. Только тот, кто сам получает ценность, пригласит друга → invited users = higher quality.

**Resolution:** Dual acquisition: (1) Paid для volume (VK Ads, ₽1,000 CAC), (2) Дуэль referral для quality (₽0 CAC, higher LTV). Target: 40% organic/referral к M12.

### Contradiction 2: Простой onboarding vs Глубокий продукт

**Physical Contradiction:** Продукт должен быть ПРОСТЫМ (для первых 3 минут) И ГЛУБОКИМ (для 6+ месяцев).

**TRIZ Principle #1 (Segmentation):** Progressive disclosure — показывать сложность постепенно.

**Resolution:**
- 0-3 мин: C-screen quiz (простой, визуальный, wow)
- Day 1-3: Базовые CBT-уроки (3 мин/день, никакой сложности)
- Day 7-14: Meal tracking + AI-коуч (добавляем engagement layers)
- Day 14+: Дуэли, advanced CBT, персональные planы (глубина)

### Contradiction 3: Дорогая медицина vs Доступный продукт

**Physical Contradiction:** Медицинская экспертиза ДОРОГАЯ (₽5,000/консультация) И продукт ДОСТУПНЫЙ (₽499/мес).

**TRIZ Principle #25 (Self-service) + #24 (Intermediary):**
- AI-coach заменяет 90% функций human coach → ₽0 marginal cost
- Врач-эндокринолог только для Clinical tier (₽4,990) — цена оправдана
- Part-time врачи (₽80K/мес) обслуживают 40-60 пациентов
- C-screen даёт «медицинский» feel всем пользователям — бесплатно

### Contradiction 4: Низкий CAC vs Качественные каналы

**TRIZ Principle #13 (Other Way Round):** Вместо «мы ищем пользователей» → «пользователи находят нас». SEO-контент по CBT + medical keywords (low competition в РФ). CAC ₽200 vs ₽1,000 paid.

**Resolution:** Channel sequencing: Paid (M1-3) → Influencers (M1-6) → SEO/Content (M4-12) → Organic flywheel (M12+). Постепенно снижаем зависимость от paid.

---

## Solution Architecture

### Product Strategy: «Воронка веры»

```
Level 1: SHOCK (C-screen)
  «Твой метаболический возраст 47» → WOW → Registration
  
Level 2: HOPE (CBT Day 1-3)
  «Диеты не работают — вот почему» → Insight → Engagement
  
Level 3: TRUST (CBT Day 4-14 + AI Coach)
  «Вот твой персональный план» → Progress → Trial → Payment
  
Level 4: HABIT (Day 14+)
  Streaks + Дуэли + Weekly reports → Retention → Referral
  
Level 5: IDENTITY (Month 3+)
  «Я — человек, который понимает свои отношения с едой» → LTV → Advocacy
```

### Monetization Strategy

| Tier | Price | Trigger | Features | Target % |
|------|:-----:|---------|----------|:--------:|
| Free | ₽0 | C-screen | 3 CBT-уроков, базовый трекер | 95% |
| Premium | ₽499/мес | Lesson 4 paywall | Полная CBT, AI-коуч, продвинутый трекер | 4.25% |
| Clinical | ₽4,990/мес | BMI >30 routing | Врач + GLP-1 + всё Premium | 0.75% |

### Go-to-Market Strategy

**Phase 1 (M1-3): Validation**
- 25 CustDev → C-screen prototype test → MVP → 20 beta users
- Channels: VK Ads (test), Telegram micro-influencers (test)
- Budget: ₽200K marketing

**Phase 2 (M4-6): First Users**
- Scale VK Ads, optimize CAC, launch Дуэль referral
- Content: Дзен + Telegram + YouTube shorts
- Target: 15K users, 750 paying, ₽488K MRR

**Phase 3 (M7-12): Growth**
- SEO compound effect kicks in
- Organic/referral grows to 40%
- Clinical tier launch (врачи)
- Target: 80K users, 4K paying, ₽2.6M MRR

---

## Decision Log

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Mobile framework | Flutter | React Native, Native | Single codebase, better performance, hot reload |
| Backend | Next.js + Prisma | NestJS, FastAPI | Team familiarity, fullstack JS, API routes |
| Database | PostgreSQL | MongoDB, MySQL | ACID for medical data, JSON support, Prisma compatibility |
| AI Coach | Claude API | GPT-4, custom model | Best instruction-following, safety guardrails for medical context |
| Hosting | VPS (Docker) | AWS, Vercel | Cost control (₽3K/мес vs $50+), full control, no vendor lock-in |
| Payments | RevenueCat | Stripe direct, in-app only | Handles App Store + Google Play + web, analytics built-in |
| Analytics | AppMetrica | Amplitude, Mixpanel | Free, RU-optimized, owned by Яндекс (no sanctions risk) |
| Push | OneSignal | Firebase FCM | Free tier, easy setup, segmentation built-in |
| Auth | Email + VK OAuth | Phone OTP, Apple Sign In | VK = largest RU social (90M MAU), email = universal |

---

## Confidence & Risks

| Strategy Element | Confidence | Key Risk |
|------------------|:----------:|----------|
| CBT → weight loss efficacy | 0.85 | Well-proven (Noom, clinical studies) |
| Medical Aha conversion | 0.65 | Unvalidated for Russian market |
| AI replaces human coaching | 0.70 | Quality gap for complex emotional situations |
| Unit economics (LTV:CAC 4.3:1) | 0.70 | Depends on churn and conversion assumptions |
| PLG flywheel (K-factor 0.25) | 0.50 | Дуэль mechanic untested |
| Break-even M24 | 0.60 | Multiple assumptions compound |
| **Overall strategy viability** | **0.72** | **GO — validate Medical Aha first** |
