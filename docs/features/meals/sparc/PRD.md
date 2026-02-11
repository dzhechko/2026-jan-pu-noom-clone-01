# Meals Feature — PRD (Delta)

> Reference: `docs/PRD.md` US-012..US-015, `docs/Specification.md` US-030..US-034

## Problem Statement

Meal tracking is partially implemented with critical bugs and missing sub-features.
Users cannot photograph food, search a database, see daily summaries, or get traffic-light feedback.

## Current State

| Component | Status | Issues |
|-----------|--------|--------|
| POST /api/meals | Done | Wrong error code (QUIZ_001 → MEAL_001) |
| GET /api/meals | Done | Works correctly |
| meals/page.tsx | Done | MealEntry interface mismatches API (field names, date field) |
| meals/add/page.tsx | Done | Field name mismatch (protein→proteinG, fat→fatG, carbs→carbsG, portionGrams→portionG) |
| POST /api/meals/recognize | Missing | Photo recognition endpoint |
| GET /api/meals/daily | Missing | Daily summary with traffic light |
| PATCH /api/meals/[id] | Missing | Edit/correct meal |
| DELETE /api/meals/[id] | Missing | Delete meal |
| Search/food database | Missing | Manual fallback search |
| Photo upload UI | Missing | Camera/gallery integration |
| Daily summary UI | Missing | Traffic light page section |

## Scope (Full Spec)

### Must (P0) — Bug Fixes
1. Fix field name mismatch in meals/add/page.tsx
2. Fix error code QUIZ_001 → MEAL_001 in api/meals/route.ts
3. Fix MealEntry interface in meals/page.tsx to match API response

### Must (P1) — Core Features
4. POST /api/meals/recognize — photo recognition via external API
5. PATCH /api/meals/[id] — edit/correct recognized meal (US-031)
6. DELETE /api/meals/[id] — remove meal
7. GET /api/meals/daily — daily summary endpoint (US-033)
8. Manual search endpoint — food database lookup (US-032)
9. Photo upload UI + confirmation flow
10. Daily summary section on meals page with traffic light (US-034)

### Should (P2) — Enhancements
11. Search UI page for manual fallback
12. Calorie target from quiz results (MedicalProfile)

## Success Criteria
- All 3 bugs fixed, form submission works end-to-end
- Photo → calories pipeline works within 3 seconds
- Daily summary shows correct totals with traffic light indicator
- Manual search returns relevant Russian food items
- 6 BDD scenarios from docs/test-scenarios.md pass

## User Stories (Delta — New Only)

| ID | Story | Priority |
|----|-------|----------|
| US-030 | Photo → auto calories/macros | Must |
| US-031 | Edit/correct recognition result | Must |
| US-032 | Manual search fallback | Must |
| US-033 | Daily summary view | Must |
| US-034 | Traffic light indicator | Should |
