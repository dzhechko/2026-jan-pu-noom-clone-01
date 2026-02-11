# Meals Feature — Architecture

> Consistent with root `docs/Architecture.md`

## Component Map

```
apps/api/src/
├── app/
│   ├── api/meals/
│   │   ├── route.ts              # GET (list) + POST (manual entry) — EXISTS, fix bugs
│   │   ├── [id]/route.ts         # PATCH (edit) + DELETE — NEW
│   │   ├── recognize/route.ts    # POST (photo recognition) — NEW
│   │   ├── daily/route.ts        # GET (daily summary) — NEW
│   │   └── search/route.ts       # GET (food search) — NEW
│   └── meals/
│       ├── page.tsx              # History page — EXISTS, fix bugs + add daily summary
│       ├── add/page.tsx          # Add form — EXISTS, fix bugs + add photo flow
│       └── search/page.tsx       # Search page — NEW
├── components/
│   └── meals/
│       ├── daily-summary.tsx     # Traffic light summary card — NEW
│       ├── photo-capture.tsx     # Camera/gallery button + preview — NEW
│       ├── recognition-card.tsx  # "Верно?" confirmation — NEW
│       └── food-search-item.tsx  # Search result row — NEW
├── lib/
│   ├── engines/
│   │   ├── meal-recognition-engine.ts  # Photo → nutrition — NEW
│   │   ├── food-database.ts            # Search + lookup — NEW
│   │   └── meal-summary-engine.ts      # Daily totals + traffic light — NEW
│   └── validators/
│       └── meals.ts              # Zod schemas — NEW (separate from inline in route)
└── content/
    └── food-database.json        # Static Russian food DB (~500 items) — NEW

content/
└── food-database.json            # Symlink or copy at project root level
```

## Data Flow

### Photo Recognition Flow
```
User takes photo
  → meals/add/page.tsx (FormData)
  → POST /api/meals/recognize
    → Upload to MinIO (get URL)
    → meal-recognition-engine.ts
      → External Food Recognition API (FOOD_RECOGNITION_API_KEY)
      → food-database.ts (nutrition lookup)
    → Return RecognitionResult
  → User sees confirmation card
  → [Да] → POST /api/meals (with photoUrl, recognitionMethod: "ai_photo")
  → [Изменить] → Pre-fill form → edit → POST /api/meals
```

### Daily Summary Flow
```
meals/page.tsx loads
  → GET /api/meals/daily?date=today
    → Query MealLog for date range
    → Query MedicalProfile for targetCalories
    → meal-summary-engine.ts (compute summary)
    → Return meals + summary
  → Render DailySummary component (traffic light)
  → Render meal list below
```

### Manual Search Flow
```
User taps "Найти вручную"
  → meals/search/page.tsx
  → GET /api/meals/search?q=борщ
    → food-database.ts (searchFood)
    → Return results
  → User selects item, enters portion
  → POST /api/meals (recognitionMethod: "manual_search")
```

## External Dependencies

| Service | Purpose | Env Var | Fallback |
|---------|---------|---------|----------|
| Food Recognition API | Photo → dish identification | FOOD_RECOGNITION_API_KEY + FOOD_RECOGNITION_API_URL | Manual entry |
| MinIO | Photo storage | MINIO_USER, MINIO_PASSWORD | Skip photo storage |
| Redis | Food DB cache | REDIS_URL | In-memory cache |

## Database Changes

No schema changes needed. Existing MealLog model already has:
- `photoUrl` (nullable) — for photo recognition
- `recognitionMethod` — ai_photo / manual_search / manual_entry
- `aiConfidence` (nullable) — for recognition confidence

## Security Considerations

- Photo uploads: validate MIME type server-side (not just extension)
- Max 5MB enforced at route level (before MinIO upload)
- Food Recognition API key: server-side only (env var)
- PATCH/DELETE: ownership check (meal.userId === authUser.userId)
- Rate limiting: 30 req/hr for /meals/recognize (per Refinement.md)
