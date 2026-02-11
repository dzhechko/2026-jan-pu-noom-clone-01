# Весна — Executive Summary

## Overview
«Весна» — первая в России платформа для управления весом, объединяющая когнитивно-поведенческую терапию (CBT), AI-коучинг на базе Claude API и медицинский скрининг. Продукт адаптирует модель Noom ($1B ARR) для российского рынка с 30M+ потенциальных пользователей, используя Medical Aha-момент как центральный механизм конверсии и product-led growth.

## Problem & Solution

**Problem:** 30M+ россиян с избыточным весом используют calorie trackers (FatSecret, MyFitnessPal), которые борются с симптомами, а не причиной. 95% диет заканчиваются возвратом веса. Ни один продукт в РФ не объединяет CBT + медицину + AI-персонализацию.

**Solution:** Весна трансформирует отношение к еде через CBT-подход: Medical Aha (C-screen quiz → метаболический возраст) → 14 CBT micro-lessons → AI-коуч → social «Дуэли» для accountability. AI-first архитектура снижает стоимость коучинга на 90% vs Noom's human coaches.

## Target Users
- **Primary:** Мотивированные женщины 28-42, BMI 25-30, пробовали 3+ диеты, хотят понять причину
- **Secondary:** Мужчины 35-50, BMI 30+, первое обращение за помощью, ценят научный подход

## Key Features (MVP)

| Feature | Value |
|---------|-------|
| C-Screen Quiz | Medical Aha → 3-5x конверсия в регистрацию |
| 14 CBT micro-lessons | 3-5 мин/день, меняют поведение, не считают калории |
| AI Coach (Claude API) | Персональные CBT-рекомендации 24/7 |
| Meal Tracker | AI фото-распознавание + Russian food database |
| Gamification | Streaks, levels, badges — retention +20-25% |
| Referral «Дуэли» | 7-дневные CBT-челленджи с друзьями (viral loop) |

## Technical Approach

- **Architecture:** Distributed Monolith in Monorepo
- **Mobile:** Flutter (single codebase iOS + Android)
- **Backend:** Next.js API Routes + Prisma + PostgreSQL
- **AI:** Claude API (coaching) + Food recognition API
- **Infrastructure:** Docker Compose on VPS (AdminVPS/HOSTKEY)
- **Deploy:** GitHub Actions → SSH → Docker Compose
- **Key Differentiator:** AI-first (90% cost reduction vs human coaches), self-hosted VPS (₽3-12K/мес vs cloud $50-200+)

## Research Highlights

1. **Blue Ocean confirmed:** Никто в РФ не объединяет CBT + Medical + AI — ниша свободна
2. **Unit economics healthy:** LTV:CAC 4.3:1, payback 1.8 мес — лучше Noom (3:1)
3. **20x cheaper CAC:** ₽1,200 (~$12) vs Noom's $200-300 благодаря российскому рынку
4. **Medical Aha = conversion multiplier:** «Метаболический возраст 47 при 32» = wow-момент для sharing
5. **AI coach feasibility proven:** Claude API quality sufficient for CBT coaching with proper guardrails

## Success Metrics

| Metric | M3 | M6 | M12 |
|--------|:--:|:--:|:---:|
| Total users | 2K | 15K | 80K |
| Paying users | 80 | 750 | 4K |
| MRR | ₽45K | ₽488K | ₽2.6M |
| Free→Paid | 4% | 5% | 6% |
| D30 retention | 10% | 12% | 14% |

## Timeline & Phases

| Phase | Features | Timeline |
|-------|----------|:--------:|
| **MVP** | C-screen, 14 CBT lessons, AI coach, meal tracker, gamification, paywall | W3-6 |
| **v1.0** | Дуэли, weekly reports, VK OAuth, extended CBT (28 lessons) | M3-6 |
| **v1.5** | Clinical tier (врачи), GLP-1 coordination | M6-9 |
| **v2.0** | B2B wellness, wearables, CIS expansion | M12-18 |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Medical Aha doesn't convert | A/B test 3+ variants in W1-2 (stop loss: ₽50K) |
| Free→Paid <2% | Test pricing ₽299/499, trial 7/14d, paywall position |
| AI coach gives bad advice | Strict CBT-only system prompt, medical keyword filter, human review |
| Regulatory tightening | Medical license from M1, partnership with licensed clinic |
| CAC inflation | Diversify: Telegram + SEO + Referral → 40% organic by M12 |

## Immediate Next Steps
1. Validate Medical Aha (25 CustDev + C-screen prototype, W1-2)
2. Set up development environment (Docker Compose, VPS)
3. Implement C-screen quiz + registration (W3)
4. Build first 14 CBT lessons with psychologist (W3-5)
5. Integrate Claude API for AI coach (W4)
6. Launch beta with 20 users from waitlist (W6)

## Documentation Package
- **PRD.md** — Product Requirements (22 user stories, Gherkin AC)
- **Research_Findings.md** — Market & Technology Research (50+ sources)
- **Solution_Strategy.md** — Problem Analysis (TRIZ + First Principles)
- **Specification.md** — Detailed Requirements (10 features, data model, API contracts)
- **Pseudocode.md** — Algorithms & Data Flow (8 engines)
- **Architecture.md** — System Design (monorepo, Docker, VPS, Prisma schema)
- **Refinement.md** — Testing & Edge Cases (100+ test cases, error matrix)
- **Completion.md** — Deployment & Operations (CI/CD, backups, runbooks)
- **CLAUDE.md** — AI Integration Guide (for Claude Code)

## Budget
₽6M (~$60K) for 6 months. Break-even at M23-24.

## Verdict
🟢 **GO** — Overall confidence 0.72. Market opportunity real, unit economics healthy, execution feasible with AI-assisted development.
