# Meals Feature — Completion (Implementation Plan)

## Implementation Order

Dependencies determine the order. Each step is a commit.

### Phase A: Bug Fixes (3 commits)
Independent, can be done in parallel.

1. **fix(meals): field name mismatch in add page**
   - File: `meals/add/page.tsx`
   - Change: `protein→proteinG`, `fat→fatG`, `carbs→carbsG`, `portionGrams→portionG`

2. **fix(meals): use correct error code in API route**
   - File: `api/meals/route.ts`
   - Change: `QUIZ_001` → keep generic but add comment, OR use meal-specific inline

3. **fix(meals): align MealEntry interface with API response**
   - File: `meals/page.tsx`
   - Change: Fix interface fields (`proteinG`, `fatG`, `carbsG`, `portionG`, `loggedAt`)

### Phase B: Engines + Validators (3 commits)
Pure functions, no route dependencies. Can be done in parallel.

4. **feat(meals): add meal summary engine with traffic light**
   - New: `lib/engines/meal-summary-engine.ts`
   - New: `lib/engines/meal-summary-engine.test.ts`

5. **feat(meals): add food database engine with search**
   - New: `lib/engines/food-database.ts`
   - New: `lib/engines/food-database.test.ts`
   - New: `content/food-database.json` (Russian food DB, ~500 items)

6. **feat(meals): add meal validators**
   - New: `lib/validators/meals.ts` (updateMeal, dailySummary, mealSearch schemas)
   - New: `lib/validators/meals.test.ts`
   - Move existing `createMealSchema` from route to validators file

### Phase C: API Routes (4 commits)
Depend on Phase B engines/validators.

7. **feat(meals): add PATCH/DELETE endpoints**
   - New: `api/meals/[id]/route.ts`
   - Test: `api/meals/[id]/route.test.ts`

8. **feat(meals): add daily summary endpoint**
   - New: `api/meals/daily/route.ts`
   - Test: `api/meals/daily/route.test.ts`

9. **feat(meals): add food search endpoint**
   - New: `api/meals/search/route.ts`
   - Test: `api/meals/search/route.test.ts`

10. **feat(meals): add photo recognition endpoint**
    - New: `api/meals/recognize/route.ts`
    - New: `lib/engines/meal-recognition-engine.ts`
    - Test: `api/meals/recognize/route.test.ts`
    - Test: `lib/engines/meal-recognition-engine.test.ts`

### Phase D: Frontend (3 commits)
Depend on Phase C API routes.

11. **feat(meals): add daily summary UI component**
    - New: `components/meals/daily-summary.tsx`
    - Update: `meals/page.tsx` (integrate daily summary at top)

12. **feat(meals): add food search page**
    - New: `meals/search/page.tsx`
    - New: `components/meals/food-search-item.tsx`

13. **feat(meals): add photo capture + recognition flow**
    - New: `components/meals/photo-capture.tsx`
    - New: `components/meals/recognition-card.tsx`
    - Update: `meals/add/page.tsx` (add photo flow above manual form)

### Phase E: Route Tests for Existing Endpoints (1 commit)

14. **test(meals): add route tests for GET/POST /api/meals**
    - New: `api/meals/route.test.ts`

## Parallel Execution Plan

```
Phase A (3 bug fixes)          ─── parallel ───→ commit
Phase B (3 engines/validators) ─── parallel ───→ commit
Phase C (4 API routes)         ─── sequential ──→ commit each
Phase D (3 frontend)           ─── parallel ───→ commit
Phase E (1 test file)          ─────────────────→ commit
```

Total: ~14 commits, ~84 new tests

## Environment Setup Required

Before Phase C step 10 (photo recognition):
- `FOOD_RECOGNITION_API_KEY` — external food recognition service API key
- `FOOD_RECOGNITION_API_URL` — API endpoint URL
- MinIO must be running for photo storage

If these are not configured, the recognize endpoint returns MEAL_003 gracefully.

## Verification

After each phase:
```bash
npx vitest run                    # all tests pass
npx tsc --noEmit                  # type checking
```

After Phase D:
- Manual test: navigate to /meals, add meal, verify display
- Manual test: daily summary shows correct totals
- Manual test: search finds Russian food items
