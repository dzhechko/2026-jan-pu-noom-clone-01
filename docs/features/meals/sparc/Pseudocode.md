# Meals Feature — Pseudocode

> Reference: `docs/Pseudocode.md` §4 (Meal Recognition Pipeline)

## 0. Bug Fixes (Pre-Implementation)

```pseudocode
BF-1: Field Name Corrections (meals/add/page.tsx line 37-43)
  CHANGE in api.post body:
    protein  → proteinG
    fat      → fatG
    carbs    → carbsG
    portionGrams → portionG

BF-2: Error Code Comment (api/meals/route.ts line 96)
  KEEP "QUIZ_001" — it's used project-wide for generic validation errors
  ADD comment: // QUIZ_001 is the generic validation error code (not meal-specific)
  NOTE: MEAL_001 = file too large (photo), MEAL_002 = unrecognizable, MEAL_003 = API down

BF-3: Interface Fix (meals/page.tsx lines 12-22)
  CHANGE MealEntry interface:
    protein: number      → proteinG: number  (Prisma Decimal comes as number in JSON)
    fat: number          → fatG: number
    carbs: number        → carbsG: number
    portionGrams: number → portionG: number
    createdAt: string    → loggedAt: string
  UPDATE all JSX references to use new field names
```

## 1. Meal Recognition Engine

File: `src/lib/engines/meal-recognition-engine.ts`

```pseudocode
INTERFACE RecognitionResult {
  dishName: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionG: number
  confidence: number
  alternatives: Array<{ dishName: string, calories: number }>
}

FUNCTION recognizeMeal(photoBuffer: Buffer, mimeType: string): RecognitionResult
  INPUT: photo buffer (JPEG/PNG, already validated < 5MB)
  OUTPUT: RecognitionResult

  1. Resize image to max 1024px (sharp library)
  2. Call external food recognition API
     - POST to FOOD_RECOGNITION_API_URL with image
     - Timeout: 5 seconds
     - Headers: Authorization with FOOD_RECOGNITION_API_KEY

  3. IF response.confidence < 0.3 THEN
       THROW MealRecognitionError("MEAL_002")

  4. Look up nutrition in food database
     nutrition = lookupFood(response.dishName)
     IF nutrition == null THEN
       // Fallback: generic moderate-calorie values per 100g
       nutrition = { caloriesPer100g: 150, proteinPer100g: 10, fatPer100g: 5, carbsPer100g: 20 }

  5. Calculate for estimated portion
     portionG = response.estimatedPortion ?? 300
     multiplier = portionG / 100

  6. RETURN {
       dishName: response.dishName,
       calories: ROUND(nutrition.caloriesPer100g * multiplier),
       proteinG: ROUND(nutrition.proteinPer100g * multiplier, 1),
       fatG: ROUND(nutrition.fatPer100g * multiplier, 1),
       carbsG: ROUND(nutrition.carbsPer100g * multiplier, 1),
       portionG,
       confidence: response.confidence,
       alternatives: response.alternatives.slice(0, 3)
     }
```

## 2. Food Database Engine

File: `src/lib/engines/food-database.ts`

```pseudocode
INTERFACE FoodItem {
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
}

// Load static JSON database at startup, cache in memory
LET foodDatabase: FoodItem[] = null

FUNCTION loadFoodDatabase(): FoodItem[]
  IF foodDatabase != null THEN RETURN foodDatabase
  // Canonical path: <project-root>/content/food-database.json
  foodDatabase = JSON.parse(readFile(join(process.cwd(), "..", "..", "content", "food-database.json")))
  RETURN foodDatabase

FUNCTION searchFood(query: string, limit: number = 10): FoodItem[]
  db = loadFoodDatabase()
  queryLower = query.toLowerCase()

  // Score-based matching
  results = db
    .map(item => ({
      item,
      score: computeMatchScore(item.name.toLowerCase(), queryLower)
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.item)

  RETURN results

FUNCTION computeMatchScore(name: string, query: string): number
  IF name === query THEN RETURN 100          // exact match
  IF name.startsWith(query) THEN RETURN 80   // prefix match
  IF name.includes(query) THEN RETURN 60     // substring match
  // Fuzzy: each query word found in name
  words = query.split(" ")
  matchedWords = words.filter(w => name.includes(w))
  IF matchedWords.length > 0 THEN
    RETURN 20 + (matchedWords.length / words.length) * 30
  RETURN 0

FUNCTION lookupFood(dishName: string): FoodItem | null
  results = searchFood(dishName, 1)
  RETURN results[0] ?? null
```

## 3. Daily Summary Engine

File: `src/lib/engines/meal-summary-engine.ts`

```pseudocode
INTERFACE DailySummary {
  totalCalories: number
  totalProteinG: number
  totalFatG: number
  totalCarbsG: number
  targetCalories: number
  status: "green" | "yellow" | "red"
}

FUNCTION computeDailySummary(
  meals: Array<{ calories: number, proteinG: number, fatG: number, carbsG: number }>,
  targetCalories: number = 2000
): DailySummary
  totalCalories = SUM(meals.map(m => m.calories))
  totalProteinG = SUM(meals.map(m => Number(m.proteinG)))
  totalFatG = SUM(meals.map(m => Number(m.fatG)))
  totalCarbsG = SUM(meals.map(m => Number(m.carbsG)))

  ratio = totalCalories / targetCalories
  status = ratio <= 1.0 ? "green"
         : ratio <= 1.15 ? "yellow"
         : "red"

  RETURN { totalCalories, totalProteinG, totalFatG, totalCarbsG, targetCalories, status }
```

## 4. Photo Upload Flow

```pseudocode
FUNCTION handlePhotoUpload(formData: FormData, userId: string):
  1. file = formData.get("photo")
  2. IF !file THEN THROW 400 "Файл не найден"
  3. IF file.type NOT IN ["image/jpeg", "image/png"] THEN THROW MEAL_001
  4. IF file.size > 5 * 1024 * 1024 THEN THROW MEAL_001
  5. buffer = Buffer.from(await file.arrayBuffer())
  6. IF !process.env.FOOD_RECOGNITION_API_KEY THEN THROW MEAL_003
  7. result = recognizeMeal(buffer, file.type)
  8. Upload buffer to MinIO → photoUrl (bucket: "meal-photos", key: `${userId}/${uuid}.jpg`)
     // Upload AFTER recognition so we don't store photos for failed recognitions
  9. Return { result: { ...result, photoUrl } }

FUNCTION handleMealConfirm(userId, recognitionResult, photoUrl):
  // User tapped "Да" — save as-is
  prisma.mealLog.create({
    userId,
    ...recognitionResult,
    photoUrl,
    recognitionMethod: "ai_photo",
    aiConfidence: recognitionResult.confidence
  })

FUNCTION handleMealCorrect(userId, correctedData, photoUrl):
  // User tapped "Изменить" and edited values
  prisma.mealLog.create({
    userId,
    ...correctedData,
    photoUrl,
    recognitionMethod: "ai_photo", // still AI, just corrected
    aiConfidence: null // user overrode
  })
```

## 5. Route Implementations

### POST /api/meals/recognize
```pseudocode
1. requireAuth(req)
2. handlePhotoUpload(formData, userId)
   — validates type, size, API key
   — calls recognizeMeal → nutrition
   — uploads to MinIO after success
   — CATCH MealRecognitionError → MEAL_001, MEAL_002, or MEAL_003
3. Fire-and-forget: updateDuelScore(userId, "meal_logged") — skipped here, only on confirm
4. Return { result: { ...recognition, photoUrl } }
```

### GET /api/meals/daily
```pseudocode
1. requireAuth(req)
2. Parse date param (default: today)
3. Query meals for userId + date range (start of day → end of day)
4. Get targetCalories from MedicalProfile (or default 2000)
5. computeDailySummary(meals, targetCalories)
6. Return { date, meals, summary }
```

### PATCH /api/meals/[id]
```pseudocode
1. requireAuth(req)
2. Validate body with updateMealSchema
3. Find meal by id WHERE userId = authUser.userId
4. If not found → 404
5. prisma.mealLog.update({ where: { id }, data: validatedFields })
6. Return { meal: updated }
```

### DELETE /api/meals/[id]
```pseudocode
1. requireAuth(req)
2. Find meal by id WHERE userId = authUser.userId
3. If not found → 404
4. prisma.mealLog.delete({ where: { id } })
5. Return 204
```

### GET /api/meals/search
```pseudocode
1. requireAuth(req)
2. Validate query with mealSearchSchema
3. searchFood(query, limit)
4. Return { results }
```
