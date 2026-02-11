# /init — Project Initialization

Первоначальная настройка проекта «Весна». Запусти один раз после unzip.

## Steps

1. Прочитай CLAUDE.md — главный контекст проекта
2. Прочитай DEVELOPMENT_GUIDE.md — этапы разработки и workflow
3. Прочитай docs/PRD.md — что строим, для кого, зачем
4. Прочитай docs/Architecture.md — как строим, tech stack, monorepo
5. Прочитай docs/validation-report.md — ограничения и caveats
6. Если существует docs/insights.md — прочитай известные проблемы и решения

7. Инициализируй git:
```bash
git init
git add .
git commit -m "chore: initial project setup from SPARC documentation"
```

8. Покажи пользователю:
   - Краткое описание: CBT + AI-коуч + Medical Aha для управления весом
   - MVP features (10): C-screen, CBT Lessons, AI Coach, Meal Tracker, Gamification, Дуэли, Auth, Push, Paywall, Analytics
   - Список команд: /plan, /test, /deploy, /feature, /myinsights
   - Список агентов: @planner, @architect, @code-reviewer, @tdd-guide
   - Рекомендуемый первый шаг: настроить Docker Compose + Prisma → реализовать F7 Auth → F1 C-screen Quiz

9. Спроси: "Готов начать? Какую фичу реализуем первой?"

## Recommended Implementation Order
1. 🔧 Infrastructure: Docker Compose + PostgreSQL + Redis + Prisma migrations
2. 🔐 F7: Auth & Profile (email + VK OAuth, JWT)
3. 🏥 F1: C-Screen Quiz (Medical Aha) — core conversion
4. 📚 F2: CBT Lessons (14 уроков + paywall)
5. 🤖 F3: AI Coach (Claude API integration)
6. 🍽️ F4: Meal Tracker (photo recognition)
7. 🎮 F5: Gamification (streaks, XP, levels)
8. 💳 F9: Paywall & Payments (RevenueCat)
9. 🔔 F8: Notifications (OneSignal)
10. ⚔️ F6: Referral Дуэли (most complex, last)
