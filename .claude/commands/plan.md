# /plan $ARGUMENTS — Implementation Planning

Спланируй реализацию фичи на основе SPARC документации.

## Process

1. Определи какую фичу планируем: $ARGUMENTS
2. Найди соответствующие user stories в docs/Specification.md
3. Найди алгоритмы в docs/Pseudocode.md
4. Найди архитектурные решения в docs/Architecture.md
5. Найди edge cases в docs/Refinement.md

## Output

### Implementation Plan for: $ARGUMENTS

**User Stories:** [список US-XXX]
**Story Points:** [сумма]
**Dependencies:** [другие фичи]

**Tasks (с параллелизмом):**

| # | Task | Agent | Parallel | Est |
|---|------|-------|----------|-----|
| 1 | ... | @architect | — | ... |
| 2 | ... | impl | с #3 | ... |
| 3 | ... | impl | с #2 | ... |
| 4 | ... | @tdd-guide | после #2,#3 | ... |

**Acceptance Criteria:** [из Specification.md]
**Test Scenarios:** [из test-scenarios.md]
**Error Codes:** [из Refinement.md]

Спроси: "Начинаем реализацию? Какой task первым?"
