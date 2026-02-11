# Research Findings

## Executive Summary
Исследование подтверждает жизнеспособность CBT-based weight management platform в России. Рынок $500M+ с отсутствием прямых конкурентов в нише CBT+Medical+AI. Unit economics здорова (LTV:CAC 4.3:1) благодаря 20x разнице в CAC между РФ и USA. Ключевой риск — конверсия Medical Aha (C-screen), валидируется за 2 недели.

## Research Objective
Определить: (1) размер и динамику рынка, (2) конкурентный ландшафт, (3) оптимальную технологическую стратегию, (4) каналы привлечения, (5) финансовую модель для Russian Noom analog.

## Methodology
GOAP-based research через 50+ web sources. Модули M1-M6 reverse-engineering-unicorn skill. 6 фаз: Intelligence → Product → Market → Finance → Growth → Playbook.

---

## Market Analysis

### Размер рынка
- TAM (глобальный weight management): $320B+, CAGR 6-8%
- SAM (Россия digital weight management): $500M+
- SOM (Year 3): $2-5M (30K paying users × ₽650 ARPU × 12 мес)
- 30M+ россиян с BMI >25 (потенциальная аудитория)

### Noom Reference Model
- Revenue: $600M (2021) → $1B ARR (2023)
- Subscribers: 1.5M paying at $17-70/мес
- Valuation: $3.66B (Series F, 6.17x revenue)
- Ad spend: $330M/год (2021) → <$100M (2024, declining)
- Coaches: $19-24/hr, managing 300-400 users each
- Key insight: 33% users buy add-ons ($80-100 each)

### Российский контекст
- VK Ads + Яндекс.Директ = 34% рынка мобильного маркетинга
- Android 86% market share (CPI Android ₽86, iOS ₽140)
- Микро-инфлюенсеры (1-50K подписчиков) — растущий канал
- Telegram Ads — эффективен для B2B и health-тематик
- Dev salaries: Middle ₽230K/мес, Senior ₽272-290K/мес (+18% YoY)

## Competitive Landscape

| Competitor | Users (RU) | Revenue Model | CBT | Medical | AI Coach | Threat |
|------------|:----------:|---------------|:---:|:-------:|:--------:|:------:|
| FatSecret | 5M+ | Freemium + Ads | ❌ | ❌ | ❌ | Medium |
| Yazio | 1M+ | Premium $7/mo | ❌ | ❌ | ❌ | Low |
| MyFitnessPal | 2M+ | Premium $10/mo | ❌ | ❌ | Basic | Low |
| Noom (global) | ~0 in RU | $17-70/mo | ✅ | Partial | Human | Low (no RU) |
| Weight Watchers | Minimal | Points + Meetings | Partial | ❌ | ❌ | Low |

**Blue Ocean Position:** Никто в РФ не объединяет CBT + Medical + AI. Ближайший по подходу (Noom) не локализован.

### Competitive Advantages vs Noom
| Dimension | Noom | Весна | Advantage |
|-----------|------|-------|-----------|
| Coaching | Human ($19-24/hr) | AI (Claude API) | 90% cost reduction |
| CAC | $200-300 | ₽1,200 (~$12) | 95% cheaper |
| Medical | Noom Med (limited) | Врач + GLP-1 + CBT | Deeper integration |
| Localization | English-first | Russian-first | Native content |
| Pricing | $17-70/mo | ₽499/mo (~$5) | PPP-adjusted |

## Technology Assessment

### Recommended Stack (from Architecture constraints)
- **Mobile:** Flutter (single codebase iOS + Android)
- **Backend:** Next.js + Prisma + PostgreSQL
- **AI:** Claude API (coaching) + food recognition API
- **Infra:** Docker + Docker Compose on VPS (AdminVPS)
- **Analytics:** AppMetrica (Яндекс) — free, RU-optimized
- **Payments:** RevenueCat (manages App Store + Google Play subscriptions)
- **Push:** OneSignal (free tier: 10K devices)

### AI Integration Points
1. **AI Coach:** Claude API → CBT-based responses, personalized to user's lesson progress
2. **Meal Recognition:** Photo → food identification → calorie/macro estimation
3. **Churn Prediction:** ML model on behavioral data → proactive intervention
4. **Content Generation:** AI-assisted CBT lesson creation (with psychologist review)

## User Insights

### Key Behavioral Patterns (from M2 research)
- 95% of diets fail within 1 year — users KNOW this, frustrated
- Emotional eating is #1 trigger — not lack of knowledge
- "Метаболический возраст" concept resonates strongly — it's personal, medical, shocking
- Social accountability (friends) increases D30 retention by 15-30%
- Gamification (streaks) reduces churn by 20-25%

### Health App Retention Benchmarks
| Metric | Industry Average | Target |
|--------|:----------------:|:------:|
| D1 retention | 25-40% | 35% |
| D7 retention | ~15% | 22% |
| D30 retention | 5-10% | 12% |
| Monthly subscriber churn | 8-12% | 10% |
| Free→Paid (30d) | 3-8% | 5% |

## Confidence Assessment

| Finding | Confidence | Sources |
|---------|:----------:|:-------:|
| Market size ($500M+ RU) | High | 3+ sources |
| No CBT+Medical competitor in RU | High | Competitive scan |
| Unit economics viable (LTV:CAC 4.3:1) | Medium | Financial modeling + benchmarks |
| Medical Aha improves conversion 3-5x | Medium | Noom analog data, not directly tested |
| AI coaching can replace human coaches | Medium | Tech feasibility confirmed, quality TBD |
| D30 retention 12% achievable | Medium | Industry benchmarks + gamification lift |
| K-factor 0.25 by M12 | Low | Ambitious, Дуэль mechanic untested |

## Key Risks Identified
1. **Medical Aha conversion** — central hypothesis, unvalidated
2. **AI coach quality** — CBT requires nuance, AI may hallucinate
3. **Regulatory** — telehealth tightening could limit Clinical tier
4. **GLP-1 supply** — shortage continues, limits Clinical attractiveness
5. **CAC inflation** — competition for VK Ads health audience growing
