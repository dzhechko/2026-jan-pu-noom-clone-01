# Весна — CBT Weight Management Platform

## Project Overview
Первая в России платформа управления весом: CBT micro-lessons + AI-коуч (Claude API) + Medical Aha screening. Distributed Monolith, Flutter + Next.js + PostgreSQL, Docker на VPS.

## Documentation
Read before implementing:
1. `docs/PRD.md` — 22 user stories, personas, success metrics
2. `docs/Specification.md` — 10 features, data model, API contracts, Gherkin AC
3. `docs/Pseudocode.md` — 8 engines (Quiz, Lessons, Coach, Meals, Gamification, Duels, Notifications, Subscriptions)
4. `docs/Architecture.md` — monorepo structure, Docker Compose, Prisma schema, ADRs
5. `docs/Refinement.md` — 100+ tests, error matrix (20 codes), caching, security
6. `docs/Completion.md` — CI/CD (GitHub Actions), VPS setup, backups, rollback
7. `docs/validation-report.md` — INVEST/SMART scores, gap register
8. `docs/test-scenarios.md` — 55 BDD scenarios

## Tech Stack
| Layer | Tech |
|-------|------|
| Mobile | Flutter 3.24+ (Dart, Riverpod) |
| Backend | Next.js 14+ (API Routes) |
| ORM | Prisma 5+ |
| DB | PostgreSQL 16 |
| Cache | Redis 7 |
| AI | Claude API (claude-sonnet-4-20250514) |
| Storage | MinIO (S3-compatible) |
| Payments | RevenueCat |
| Push | OneSignal |
| Analytics | AppMetrica |
| Proxy | Nginx 1.25+ |
| Deploy | Docker Compose → VPS via GitHub Actions SSH |

## Monorepo Structure
```
vesna/
├── apps/
│   ├── mobile/              # Flutter (iOS + Android)
│   │   └── lib/{screens, widgets, providers, services, models}
│   └── api/                 # Next.js backend
│       └── src/app/api/{auth, quiz, lessons, meals, coach, gamification, duels, health}
├── packages/shared/         # Shared types, constants
├── content/lessons/         # CBT lesson content (JSON)
├── prisma/                  # Schema + migrations
├── nginx/                   # Nginx config
├── scripts/                 # Deploy, backup, setup
├── docker-compose.yml       # Dev
└── docker-compose.prod.yml  # Prod
```

## Key Entities (8)
User, MedicalProfile, LessonProgress, MealLog, CoachMessage, Streak, Gamification, Duel

## API Groups (15 endpoints)
Auth (4) · Quiz (3) · Lessons (3) · Meals (3) · Coach (1) · Gamification (1) · Duels (3) · Health (1)

## Parallel Execution Strategy
- Use `Task` tool for independent subtasks (e.g., build API + Flutter screens simultaneously)
- Run tests, linting, type-checking in parallel
- For complex features: spawn specialized agents (@planner, @architect, @code-reviewer)
- Independent modules (Quiz, Lessons, Coach, Meals) can be developed in parallel

## Swarm Agents
| Agent | Use For |
|-------|---------|
| `@planner` | Break feature into tasks from Pseudocode.md |
| `@architect` | Ensure consistency with Architecture.md |
| `@code-reviewer` | Quality review with edge cases from Refinement.md |
| `@tdd-guide` | Test-first development from test-scenarios.md |

## 🔄 Feature Development Lifecycle
New features use the 4-phase lifecycle: `/feature [name]`
1. **PLAN** — SPARC docs → `docs/features/<name>/sparc/`
2. **VALIDATE** — requirements-validator swarm → score ≥70
3. **IMPLEMENT** — parallel agents from validated docs
4. **REVIEW** — brutal-honesty-review swarm → fix all criticals

Available lifecycle skills in `.claude/skills/`:
- `sparc-prd-manual` (+ explore, goap-research, problem-solver-enhanced)
- `requirements-validator`
- `brutal-honesty-review`

## 💡 Insights Knowledge Base
- After solving non-trivial problems: `/myinsights [title]`
- Before debugging: check `docs/insights.md` first
- Auto-committed on session Stop via hook

## Implementation Rules
- **Must** features first: C-screen, CBT Lessons, AI Coach, Meal Tracker, Auth, Paywall
- **Should** features next: Gamification, Дуэли, Weekly Reports
- Match pseudocode from docs/Pseudocode.md exactly
- Use error codes from docs/Refinement.md (AUTH_001...GEN_002)
- Zod validation on ALL API inputs
- Medical data encrypted at rest (AES-256)
- AI Coach: ALWAYS check `containsMedicalRequest()` before Claude API call
- Commit after each logical change: `type(scope): description`

## Security (CRITICAL)
- JWT RS256: 15min access, 7d refresh
- bcrypt 12 rounds for passwords
- Rate limiting: 100/min general, 10/min auth, 20/hr coach
- Medical data: encrypted at rest, ФЗ-152 consent required
- External API keys: client-side AES-GCM in IndexedDB only
- See `.claude/rules/security.md` for full requirements

## Environment Variables
```
DATABASE_URL, REDIS_URL, CLAUDE_API_KEY, JWT_SECRET, JWT_PUBLIC_KEY,
FOOD_RECOGNITION_API_KEY, REVENUECCAT_API_KEY, ONESIGNAL_APP_ID,
ONESIGNAL_API_KEY, MINIO_USER, MINIO_PASSWORD, NODE_ENV, TG_BOT_TOKEN
```

## Commands
| Command | Purpose |
|---------|---------|
| `/init` | First run: read docs, init git, show plan |
| `/plan [feature]` | Plan implementation from SPARC docs |
| `/test [scope]` | Generate and run tests |
| `/deploy [env]` | Deploy to VPS |
| `/feature [name]` | Full 4-phase feature lifecycle |
| `/myinsights [title]` | Capture debugging insight |
