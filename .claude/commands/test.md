# /test $ARGUMENTS — Test Generation & Execution

Генерация и запуск тестов на основе BDD-сценариев.

## Process

1. Определи scope: $ARGUMENTS (feature name, module, or "all")
2. Найди BDD-сценарии в docs/test-scenarios.md
3. Найди edge cases в docs/Refinement.md
4. Найди acceptance criteria в docs/Specification.md

## Test Generation

### Unit Tests (Jest/Vitest)
- Для каждого алгоритма из docs/Pseudocode.md
- Покрытие: happy path + error cases + edge cases
- Файлы: `*.test.ts` рядом с модулем

### Integration Tests (supertest)
- Для каждого API endpoint из docs/Specification.md
- Покрытие: auth, validation, business logic, errors
- Файлы: `__tests__/integration/*.test.ts`

### E2E Tests (Playwright / Patrol)
- 5 critical flows из docs/Refinement.md (E2E-001 to E2E-005)
- Файлы: `__tests__/e2e/*.test.ts`

## Execution
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All with coverage
npm run test:coverage
```

## Parallel Execution
Запускай тесты параллельно с линтингом:
- Task 1: `npm test`
- Task 2: `npm run lint`
- Task 3: `npm run type-check`
