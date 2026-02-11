# Development Guide: Весна

## Обзор инструментов

| Инструмент | Тип | Назначение |
|------------|-----|------------|
| `/init` | Command | Первоначальная настройка проекта |
| `/plan [feature]` | Command | Планирование реализации из SPARC docs |
| `/test [scope]` | Command | Генерация и запуск тестов |
| `/deploy [env]` | Command | Деплой (dev/staging/prod) |
| `/feature [name]` | Command | Полный lifecycle фичи (4 фазы) |
| `/myinsights [title]` | Command | Захват отладочного инсайта |
| `@planner` | Agent | Разбивка фичи на задачи из Pseudocode.md |
| `@architect` | Agent | Проверка соответствия Architecture.md |
| `@code-reviewer` | Agent | Code review с edge cases из Refinement.md |
| `@tdd-guide` | Agent | Test-first разработка из test-scenarios.md |

## Этапы разработки

### 🚀 Этап 1: Старт проекта
- Уже сделано: `/init`
- Результат: git инициализирован, контекст загружен

### 🏗️ Этап 2: Планирование фичи
- `/plan [feature]` или `@planner`
- Сверяйся с BDD-сценариями из docs/test-scenarios.md
- Проверяй алгоритмы в docs/Pseudocode.md

### 💻 Этап 3: Реализация
- Task tool для параллельных подзадач (независимые модули)
- Коммить после каждого логического изменения
- Используй Zod для всех API inputs

### 🧪 Этап 4: Тестирование
- `/test [scope]` — генерация тестов из BDD-сценариев
- Gherkin-сценарии из docs/test-scenarios.md как основа
- Тесты параллельно с линтингом: `npm test` + `npm run lint` + `npm run type-check`

### 🔍 Этап 5: Code Review
- `@code-reviewer` перед мержем
- Проверка: error codes, security, edge cases, performance budgets

### 🆕 Этап 6: Добавление новых фичей
- `/feature [name]` — полный lifecycle:
  1. **PLAN:** SPARC документация → docs/features/\<name\>/sparc/
  2. **VALIDATE:** requirements-validator (swarm, итерации до score ≥70)
  3. **IMPLEMENT:** swarm agents + parallel tasks из валидированных docs
  4. **REVIEW:** brutal-honesty-review (swarm) → fix all criticals
- Документация каждой фичи сохраняется для повторного использования

### 🚢 Этап 7: Деплой
- `/deploy [env]` — dev → staging → prod
- Docker Compose на VPS через SSH (GitHub Actions)
- Тегируй релизы: `v0.X.0`
- Мониторь Telegram-алерты 15 мин после деплоя

### 💡 Этап 8: Захват инсайтов (постоянно)
- `/myinsights [title]` — после решения нетривиальной проблемы
- Claude сам предложит захватить инсайт после сложного дебага
- Каждая запись: Symptoms → Diagnostic → Root Cause → Solution → Prevention
- Auto-commit через Stop hook, не нужно помнить про git add
- **Перед дебагом** — сначала проверь docs/insights.md!

### 🔐 Этап 9: Настройка интеграций (если внешние API)
- Settings > Integrations в UI приложения
- AES-GCM 256-bit шифрование, только в браузере
- См. `.claude/rules/secrets-management.md`

## Git Workflow

```
feat | fix | refactor | test | docs | chore
1 логическое изменение = 1 коммит
max 50 chars subject line
```

Branches: `feature/US-XXX-description` → `develop` (PR) → `main` (PR + review)

## Swarm Agents: когда использовать

| Сценарий | Agents | Параллелизм |
|----------|--------|-------------|
| Новая большая фича | @planner + 2-3 impl agents | Да (Task tool) |
| Рефакторинг модуля | @code-reviewer + @architect | Да |
| Баг-фикс | 1 agent | Нет |
| Тестирование | @tdd-guide + test runner | Да (test + lint) |
| Архитектурное решение | @architect | Нет |

## Recommended Implementation Order

1. 🔧 Infrastructure: Docker Compose + Prisma + migrations
2. 🔐 F7: Auth (JWT + VK OAuth)
3. 🏥 F1: C-Screen Quiz (Medical Aha)
4. 📚 F2: CBT Lessons + Paywall trigger
5. 🤖 F3: AI Coach (Claude API)
6. 🍽️ F4: Meal Tracker (photo recognition)
7. 🎮 F5: Gamification (streaks, XP)
8. 💳 F9: Payments (RevenueCat)
9. 🔔 F8: Push Notifications (OneSignal)
10. ⚔️ F6: Referral Дуэли (most complex — last)
