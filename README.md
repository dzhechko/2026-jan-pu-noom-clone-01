# Весна — CBT Weight Management Platform

Первая в России платформа управления весом, объединяющая когнитивно-поведенческую терапию (CBT), AI-коучинг и медицинский скрининг.

## Quick Start

```bash
unzip vesna.zip
cd vesna
claude
/init
```

## Документация

| Файл | Описание |
|------|----------|
| [PRD](docs/PRD.md) | Что строим: 22 user stories, personas, метрики |
| [Specification](docs/Specification.md) | Детальные требования: features, data model, API |
| [Architecture](docs/Architecture.md) | Как строим: monorepo, Docker, Prisma, ADRs |
| [Pseudocode](docs/Pseudocode.md) | Алгоритмы: 8 engines |
| [Refinement](docs/Refinement.md) | Качество: 100+ тестов, error matrix |
| [Completion](docs/Completion.md) | Деплой: CI/CD, бэкапы, rollback |
| [Test Scenarios](docs/test-scenarios.md) | 55 BDD-сценариев |
| [Validation Report](docs/validation-report.md) | INVEST/SMART валидация |

## Стек

- **Mobile:** Flutter 3.24+ (iOS + Android)
- **Backend:** Next.js 14+ (API Routes)
- **DB:** PostgreSQL 16 + Redis 7
- **AI:** Claude API (AI-коуч)
- **Deploy:** Docker Compose → VPS

## Architecture

Distributed Monolith в Monorepo. Docker + Docker Compose. VPS deploy через GitHub Actions SSH.

## Команды Claude Code

| Команда | Назначение |
|---------|------------|
| `/init` | Первый запуск проекта |
| `/plan [feature]` | Планирование реализации |
| `/test [scope]` | Генерация и запуск тестов |
| `/deploy [env]` | Деплой (dev/staging/prod) |
| `/feature [name]` | Полный lifecycle фичи |
| `/myinsights [title]` | Захват инсайта |
