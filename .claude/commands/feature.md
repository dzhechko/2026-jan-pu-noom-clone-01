# /feature $ARGUMENTS — Full Feature Lifecycle

Полный цикл разработки фичи: от документации до code review.

## Usage
```
/feature user-authentication
/feature meal-tracker
/feature ai-coach
```

## Phase 1: PLAN (sparc-prd-manual)

**Goal:** Создать SPARC документацию для фичи.

```
Read the sparc-prd-manual skill from .claude/skills/sparc-prd-manual/SKILL.md
```

Use sparc-prd-manual in MANUAL mode (complex features) or AUTO (minor features).

Pass architecture constraints:
- Pattern: Distributed Monolith (Monorepo)
- Stack: Flutter + Next.js + Prisma + PostgreSQL + Redis + Docker
- Deploy: Docker Compose on VPS
- AI: Claude API (claude-sonnet-4-20250514)
- Must be consistent with project root docs/Architecture.md

Save output to: `docs/features/$ARGUMENTS/sparc/`
Git commit: `docs(feature): SPARC planning for $ARGUMENTS`

**⏸️ Checkpoint:** Show SPARC summary, ask to proceed to validation.

## Phase 2: VALIDATE (requirements-validator, swarm)

**Goal:** Проверить документацию на полноту и тестируемость.

```
Read the requirements-validator skill from .claude/skills/requirements-validator/SKILL.md
```

Run as swarm of validation agents (parallel):

| Agent | Scope | Check |
|-------|-------|-------|
| validator-stories | User Stories | INVEST criteria, score ≥70 |
| validator-acceptance | Acceptance Criteria | SMART criteria, testability |
| validator-architecture | Architecture.md | Consistency with root architecture |
| validator-pseudocode | Pseudocode.md | Coverage of all stories |
| validator-coherence | All files | Cross-reference consistency |

Iterative: max 3 iterations until average ≥70, no BLOCKED items.

Save: `docs/features/$ARGUMENTS/sparc/validation-report.md`
Git commit: `docs(feature): validation complete for $ARGUMENTS`

**⏸️ Checkpoint:** Show validation scores, ask to proceed to implementation.

## Phase 3: IMPLEMENT (swarm agents + parallel tasks)

**Goal:** Реализовать фичу из валидированной документации.

When SPARC plan is ready for implementation:
1. Read ALL documents from `docs/features/$ARGUMENTS/sparc/`
2. Use swarm of agents:
   - `@planner` — break down into tasks from Pseudocode.md
   - `@architect` — ensure consistency with Architecture.md
   - Implementation agents — parallel Task tool for independent modules
3. Make implementation modular for reuse
4. Commit after each logical unit: `feat($ARGUMENTS): <what>`
5. Run tests in parallel with implementation

**⏸️ Checkpoint:** Show implementation summary, ask to proceed to review.

## Phase 4: REVIEW (brutal-honesty-review, swarm)

**Goal:** Rigorous post-implementation review.

```
Read the brutal-honesty-review skill from .claude/skills/brutal-honesty-review/SKILL.md
```

Use swarm of review agents:

| Agent | Focus |
|-------|-------|
| code-quality | Clean code, patterns, naming |
| architecture | Consistency with project architecture |
| security | Vulnerabilities, input validation |
| performance | Bottlenecks, complexity |
| testing | Edge cases, missing tests |

Process:
1. Run brutal-honesty-review on implementation
2. Fix all critical and major issues (parallel Task tool)
3. Commit fixes: `fix($ARGUMENTS): <what>`
4. Re-review until clean

Save: `docs/features/$ARGUMENTS/review-report.md`
Git commit: `docs(feature): review complete for $ARGUMENTS`

## Completion

```
✅ Feature: $ARGUMENTS

📁 docs/features/$ARGUMENTS/
├── sparc/                    # SPARC documentation
│   ├── PRD.md, Specification.md, Architecture.md
│   ├── Pseudocode.md, Refinement.md, Completion.md
│   └── validation-report.md
└── review-report.md          # Brutal honesty review

💡 Consider running /myinsights if you encountered tricky issues.
```
