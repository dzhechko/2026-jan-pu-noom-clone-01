# Meals Feature — Pseudocode

> Reference: `docs/Pseudocode.md` §4 (Meal Recognition Pipeline)

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
  foodDatabase = JSON.parse(readFile("content/food-database.json"))
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
FUNCTION handlePhotoUpload(formData: FormData):
  1. Extract file from FormData
  2. Validate: type in [image/jpeg, image/png]
  3. Validate: size <= 5MB
  4. Upload to MinIO → get photoUrl
  5. Call recognizeMeal(buffer, mimeType)
  6. Return recognition result + photoUrl

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
2. Parse FormData, extract photo file
3. Validate file type + size → MEAL_001 if too large
4. Upload to MinIO
5. Try recognizeMeal(buffer, mimeType)
   CATCH MealRecognitionError → MEAL_002 or MEAL_003
6. Return { result: { ...recognition, photoUrl } }
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
