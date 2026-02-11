# Meals Feature — Refinement

> Reference: `docs/Refinement.md` §2.1, §3.1, §4.1

## Error Codes

| Code | HTTP | Trigger | Message |
|------|------|---------|---------|
| MEAL_001 | 400 | Photo > 5MB | "Файл слишком большой. Максимум 5 МБ" |
| MEAL_002 | 422 | Low confidence (< 0.3) | "Не удалось распознать. Попробуйте другое фото или найдите вручную" |
| MEAL_003 | 503 | Recognition API down | "Сервис распознавания временно недоступен. Введите вручную" |
| GEN_001 | 500 | Unexpected error | "Что-то пошло не так" |

## Test Plan

### Unit Tests — Engines

**meal-summary-engine.test.ts** (~10 tests)
- Empty meals array → all zeros, green
- Under target → green
- At target boundary → green
- Slightly over (1.05x) → yellow
- At yellow boundary (1.15x) → yellow
- Over 1.15x → red
- Decimal Prisma values (Decimal type) → correct Number conversion
- Default target (2000) used when not provided
- Custom target respected
- Single meal day

**food-database.test.ts** (~12 tests)
- Exact match → score 100
- Prefix match → score 80
- Substring match → score 60
- Multi-word partial match → proportional score
- No match → empty results
- Limit parameter respected
- Case insensitive search
- Russian characters handled
- Empty query → empty results
- lookupFood returns first result
- lookupFood returns null for no match
- Database loads once (caching)

**meal-recognition-engine.test.ts** (~8 tests)
- Successful recognition → correct nutrition calculation
- Low confidence (< 0.3) → MEAL_002 error
- API timeout → MEAL_003 error
- API error → MEAL_003 error
- Default portion (300g) when not estimated
- Custom portion multiplier
- Alternatives limited to 3
- Nutrition lookup miss → uses generic fallback

### Unit Tests — Validators

**meals-validators.test.ts** (~15 tests)
- updateMealSchema: all optional fields
- updateMealSchema: empty object valid
- updateMealSchema: individual field validation
- dailySummarySchema: valid date format
- dailySummarySchema: invalid date format rejected
- dailySummarySchema: missing date → defaults to undefined
- mealSearchSchema: valid query
- mealSearchSchema: empty query rejected
- mealSearchSchema: limit coercion from string
- mealSearchSchema: limit clamped to max 50

### Route Tests

**api/meals/route.test.ts** (~15 tests)
- POST: field name mismatch bug is fixed
- POST: MEAL validation error code correct
- POST: successful creation
- POST: duel score fired
- GET: returns meals with pagination
- GET: 7-day window filter
- GET: auth required

**api/meals/[id]/route.test.ts** (~10 tests)
- PATCH: updates specified fields only
- PATCH: ownership check (404 for other user's meal)
- PATCH: validation on partial fields
- DELETE: successful deletion → 204
- DELETE: ownership check (404)
- DELETE: non-existent id → 404
- Both: auth required

**api/meals/recognize/route.test.ts** (~10 tests)
- Success path → 200 with recognition result
- File too large → 400 MEAL_001
- Invalid MIME type → 400 MEAL_001
- Low confidence → 422 MEAL_002
- API unavailable → 503 MEAL_003
- Auth required

**api/meals/daily/route.test.ts** (~8 tests)
- Today's summary with traffic light
- Specific date query
- No meals → all zeros, green
- Uses MedicalProfile target calories
- Default 2000 when no profile
- Auth required

**api/meals/search/route.test.ts** (~6 tests)
- Returns matching results
- Empty query → 400
- Limit parameter respected
- Auth required

### Total: ~84 new tests

## Edge Cases

| Case | Handling |
|------|----------|
| Prisma Decimal fields | Convert to Number() before arithmetic |
| Photo HEIC format | Reject with MEAL_001 (only JPEG/PNG) |
| Recognition API key missing | Return MEAL_003 (service unavailable) |
| MedicalProfile missing | Default 2000 kcal target |
| Timezone for "today" | Use UTC for server, client sends local date |
| Very large photo (50MB) | Next.js body parser limit + route check |
| Concurrent meal edits | Last-write-wins (acceptable for single user) |
| Decimal precision | Round to 1 decimal for macros, integer for calories |

## Caching

| Data | Cache | TTL | Invalidation |
|------|-------|-----|-------------|
| Food database (static JSON) | In-memory Map | Forever | App restart |
| Food search results | Redis | 1h | Never (static data) |
| Daily summary | None (computed) | — | — |

## Performance Budget

| Operation | Target P50 | Target P99 |
|-----------|-----------|-----------|
| Photo recognition | 1s | 3s |
| Daily summary | 80ms | 200ms |
| Food search | 20ms | 50ms |
| Meal CRUD | 50ms | 150ms |
