# Meals Feature — Specification (Delta)

> Reference: `docs/Specification.md` §F4, `docs/Refinement.md` §4.1

## 1. Bug Fixes

### BF-1: Field Name Mismatch (meals/add/page.tsx)
**Current:** Sends `protein`, `fat`, `carbs`, `portionGrams`
**Expected:** `proteinG`, `fatG`, `carbsG`, `portionG`

### BF-2: Wrong Error Code (api/meals/route.ts:96)
**Current:** `"QUIZ_001"` for validation failures
**Expected:** `"MEAL_001"` or new meal validation error code

Note: MEAL_001 is defined as "Файл слишком большой" in errors.ts. Need a new code
or reuse QUIZ_001 semantics. Decision: create no new code — use the pattern from
lessons route: inline `{ code: "QUIZ_001", message: "..." }` is acceptable for
generic validation errors. Just ensure the message is meal-appropriate. Better:
change to a generic validation pattern using the existing error code.

**Resolution:** Keep QUIZ_001 for generic Zod validation failures (used project-wide).
Add a comment in the route for clarity. Error code semantics:
- QUIZ_001 = generic Zod validation failure (body/params) — used across all routes
- MEAL_001 = photo file too large (> 5MB)
- MEAL_002 = photo unrecognizable (confidence < 0.3)
- MEAL_003 = recognition API unavailable

### BF-3: MealEntry Interface Mismatch (meals/page.tsx)
**Current interface:**
```typescript
{ protein: number, fat: number, carbs: number, portionGrams: number, createdAt: string }
```
**API returns:**
```typescript
{ proteinG: Decimal, fatG: Decimal, carbsG: Decimal, portionG: number, loggedAt: string }
```

## 2. New API Endpoints

### POST /api/meals/recognize
Photo-based meal recognition.

```typescript
// Request: multipart/form-data
{ photo: File } // JPEG/PNG, max 5MB

// Response 200:
{
  result: {
    dishName: string,
    calories: number,
    proteinG: number,
    fatG: number,
    carbsG: number,
    portionG: number,
    confidence: number, // 0-1
    alternatives: Array<{ dishName: string, calories: number }>
  }
}

// Response 400 (MEAL_001): File too large
// Response 422 (MEAL_002): Unrecognizable
// Response 503 (MEAL_003): API unavailable
```

**Implementation:** Use FOOD_RECOGNITION_API_KEY env var. The external API
is called server-side. Resize image to max 1024px before sending.
Store photo in MinIO, return URL in response.

### GET /api/meals/daily
Daily summary with traffic light.

```typescript
// Query: ?date=YYYY-MM-DD (defaults to today)

// Response 200:
{
  date: string, // YYYY-MM-DD
  meals: MealEntry[],
  summary: {
    totalCalories: number,
    totalProteinG: number,
    totalFatG: number,
    totalCarbsG: number,
    targetCalories: number, // from MedicalProfile or default 2000
    status: "green" | "yellow" | "red"
  }
}
```

**Traffic light logic:**
- Green: total <= target * 1.0
- Yellow: target * 1.0 < total <= target * 1.15
- Red: total > target * 1.15

### PATCH /api/meals/[id]
Edit a meal entry (correction after recognition).

```typescript
// Request:
{
  dishName?: string,
  calories?: number,
  proteinG?: number,
  fatG?: number,
  carbsG?: number,
  portionG?: number,
  mealType?: MealType
}

// Response 200: { meal: MealEntry }
// Response 404: meal not found or not owned
```

### DELETE /api/meals/[id]
Delete a meal entry.

```typescript
// Response 204: no content
// Response 404: meal not found or not owned
```

### GET /api/meals/search
Food database search (manual fallback).

```typescript
// Query: ?q=борщ&limit=10

// Response 200:
{
  results: Array<{
    name: string,
    caloriesPer100g: number,
    proteinPer100g: number,
    fatPer100g: number,
    carbsPer100g: number,
  }>
}
```

**Implementation:** Static JSON food database bundled with the app
(Russian foods, ~500 items for MVP). Cached in Redis for 1h.
Full 50K database is a future enhancement.

## 3. New Validators

File: `src/lib/validators/meals.ts`

```typescript
// Photo upload: validated manually at route level (FormData, not JSON)
// No Zod schema — MIME type + size checked before buffer extraction

// Daily summary query
export const dailySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Meal update (partial)
export const updateMealSchema = z.object({
  dishName: z.string().min(1).max(200).optional(),
  calories: z.number().int().min(0).max(10000).optional(),
  proteinG: z.number().min(0).max(1000).optional(),
  fatG: z.number().min(0).max(1000).optional(),
  carbsG: z.number().min(0).max(1000).optional(),
  portionG: z.number().int().min(1).max(5000).optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
});

// Search query
export const mealSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
```

## 4. New UI Components

### Photo capture flow (meals/add/page.tsx enhancement)
- Camera/gallery button above manual form
- Loading state during recognition (< 3s target)
- Confirmation card: "Верно?" with [Да] [Изменить] buttons
- On [Изменить]: pre-fill manual form with recognized values

### Daily summary section (meals/page.tsx enhancement)
- At top of page, before meal list
- Shows: total cal / target cal with progress bar
- Traffic light color on progress bar
- Macro breakdown: P/F/C totals

### Search page (meals/search/page.tsx — new)
- Search bar with debounced input
- Results list with cal per 100g
- Tap → portion selector → add to log
