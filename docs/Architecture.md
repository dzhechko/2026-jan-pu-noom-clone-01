# Architecture

## Overview
System design для MVP «Весна» — distributed monolith в monorepo, Docker + Docker Compose, VPS deploy.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTS                                │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │  Telegram Mini App      │  │   Web (standalone)       │  │
│  │  React + @tma.js/sdk    │  │   Same Next.js pages     │  │
│  └───────────┬─────────────┘  └───────────┬──────────────┘  │
│              └───────────────────────────┘                   │
│                      │ HTTPS/REST                           │
├──────────────────────┼──────────────────────────────────────┤
│                REVERSE PROXY (Nginx)                        │
│           SSL termination, rate limiting                     │
├──────────────────────┼──────────────────────────────────────┤
│               API LAYER (Next.js API Routes)                │
│  ┌────────┬────────┬────────┬────────┬──────────────────┐  │
│  │ Auth   │ Quiz   │Lessons │ Meals  │ Coach│Gamif│Duels│  │
│  │ Module │ Module │ Module │ Module │Module│    │     │  │
│  └────┬───┴────┬───┴────┬───┴────┬───┴──┬───┴──┬─┴──┬──┘  │
│       └────────┴────────┼────────┴──────┴──────┴────┘      │
│                         │ Prisma ORM                        │
├─────────────────────────┼───────────────────────────────────┤
│                    DATA LAYER                                │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │ PostgreSQL  │  │  Redis   │  │  File Storage (S3)  │   │
│  │ Primary DB  │  │  Cache   │  │  Meal photos        │   │
│  │             │  │  Sessions│  │  Lesson assets      │   │
│  └─────────────┘  └──────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                 EXTERNAL SERVICES                            │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Claude API│ │Food Recog.│ │RevenueCat│ │  OneSignal   │  │
│  │AI Coach  │ │   API     │ │Payments  │ │  Push        │  │
│  └──────────┘ └───────────┘ └──────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|:-------:|-----------|
| **Frontend** | Telegram Mini App (React) | — | Embedded in Telegram, instant distribution, no app store |
| **Backend** | Next.js | 14+ | API routes + future SSR, fullstack JS |
| **ORM** | Prisma | 5+ | Type-safe queries, migrations, PostgreSQL support |
| **Database** | PostgreSQL | 16 | ACID, JSON support, medical data compliance |
| **Cache** | Redis | 7+ | Sessions, rate limiting, coach context caching |
| **Reverse Proxy** | Nginx | 1.25+ | SSL, rate limiting, static files |
| **Container** | Docker | 24+ | Consistent environments |
| **Orchestration** | Docker Compose | 2.24+ | Multi-container management |
| **AI Coach** | Claude API | Sonnet 4 | Best instruction-following for CBT |
| **Payments** | RevenueCat | SDK | Manages App Store + Google Play subs |
| **Analytics** | AppMetrica | SDK | Free, RU-optimized, no sanctions risk |
| **Push** | OneSignal | SDK | Free tier, segmentation |
| **File Storage** | MinIO | Latest | S3-compatible, self-hosted on VPS |
| **CI/CD** | GitHub Actions | — | Free tier, Docker build + SSH deploy |

---

## 3. Monorepo Structure

```
vesna/
├── apps/
│   └── api/                       # Next.js (API + Web frontend)
│       ├── src/
│       │   ├── app/               # App Router
│       │   │   ├── api/           # REST API routes
│       │   │   │   ├── auth/      # Login, register, refresh, telegram
│       │   │   │   ├── quiz/      # Questions, submit, save
│       │   │   │   ├── lessons/   # List, detail, complete
│       │   │   │   ├── coach/     # Message, messages history
│       │   │   │   ├── meals/     # List, create
│       │   │   │   ├── gamification/
│       │   │   │   ├── dashboard/
│       │   │   │   ├── user/      # Profile
│       │   │   │   └── health/
│       │   │   ├── quiz/          # Quiz pages
│       │   │   ├── lessons/       # Lesson pages
│       │   │   ├── coach/         # Chat page
│       │   │   ├── meals/         # Meal tracking pages
│       │   │   ├── profile/       # Profile page
│       │   │   ├── gamification/  # Achievements page
│       │   │   ├── duels/         # Duels page
│       │   │   ├── login/         # Auth page
│       │   │   ├── layout.tsx     # Root layout (TG SDK + providers)
│       │   │   ├── page.tsx       # Home dashboard
│       │   │   └── globals.css    # Tailwind + TG theme vars
│       │   ├── components/        # React components
│       │   │   ├── ui/            # Button, Card, Input, etc.
│       │   │   ├── layout/        # AppShell, BottomNav, PageHeader
│       │   │   ├── quiz/          # QuizStepper, QuizResultCard
│       │   │   ├── lessons/       # LessonCard, LessonQuiz
│       │   │   ├── coach/         # MessageBubble, ChatInput
│       │   │   └── providers/     # TelegramProvider, AuthProvider
│       │   ├── hooks/             # useAuth, useTelegram
│       │   ├── lib/
│       │   │   ├── prisma.ts      # Prisma client singleton
│       │   │   ├── auth.ts        # JWT utilities
│       │   │   ├── telegram-auth.ts # TG initData validation
│       │   │   ├── api-client.ts  # Frontend fetch wrapper
│       │   │   ├── redis.ts       # Redis client
│       │   │   ├── engines/       # Business logic
│       │   │   └── validators/    # Zod schemas
│       │   └── middleware.ts      # Security headers, iframe policy
│       ├── prisma/
│       │   ├── schema.prisma      # Database schema
│       │   └── migrations/
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── next.config.js
│       └── package.json
│
├── packages/
│   └── shared/                    # Shared types, constants
│       ├── types/
│       ├── constants/
│       └── utils/
│
├── content/
│   └── lessons/                   # CBT lesson content (JSON/MDX)
│       ├── lesson-01.json
│       ├── lesson-02.json
│       └── ...
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.api
├── nginx/
│   └── nginx.conf
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── deploy.yml
├── .gitignore
└── package.json                   # Root workspace
```

---

## 4. Docker Compose Configuration

### Development

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://vesna:vesna_dev@postgres:5432/vesna
      - REDIS_URL=redis://redis:6379
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - FOOD_RECOGNITION_API_KEY=${FOOD_RECOGNITION_API_KEY}
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vesna
      POSTGRES_PASSWORD: vesna_dev
      POSTGRES_DB: vesna
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: vesna_minio
      MINIO_ROOT_PASSWORD: vesna_minio_secret
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Production

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: always

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    restart: always
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: vesna
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    deploy:
      resources:
        limits:
          memory: 2G

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: always

  minio:
    image: minio/minio
    command: server /data
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    restart: always

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum SubscriptionTier {
  free
  premium
  clinical
}

enum Gender {
  male
  female
}

enum ActivityLevel {
  sedentary
  light
  moderate
  active
}

model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  passwordHash        String    @map("password_hash")
  name                String
  subscriptionTier    SubscriptionTier @default(free) @map("subscription_tier")
  subscriptionExpires DateTime?  @map("subscription_expires_at")
  vkId                String?    @unique @map("vk_id")
  settings            Json       @default("{}")
  createdAt           DateTime   @default(now()) @map("created_at")
  updatedAt           DateTime   @updatedAt @map("updated_at")

  medicalProfile      MedicalProfile?
  lessonProgress      LessonProgress[]
  mealLogs            MealLog[]
  coachMessages       CoachMessage[]
  streak              Streak?
  gamification        Gamification?
  challengerDuels     Duel[]     @relation("challenger")
  opponentDuels       Duel[]     @relation("opponent")

  @@map("users")
}

model MedicalProfile {
  id             String    @id @default(uuid())
  userId         String    @unique @map("user_id")
  gender         Gender
  birthDate      DateTime  @map("birth_date")
  heightCm       Int       @map("height_cm")
  weightKg       Decimal   @map("weight_kg")
  bmi            Decimal
  metabolicAge   Int       @map("metabolic_age")
  activityLevel  ActivityLevel @map("activity_level")
  risks          Json      @default("[]")
  quizAnswers    Json      @map("quiz_answers")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user           User      @relation(fields: [userId], references: [id])

  @@map("medical_profiles")
}

model LessonProgress {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  lessonId    Int       @map("lesson_id")
  status      String    @default("locked") // locked, available, completed, review_needed
  quizScore   Int?      @map("quiz_score")
  completedAt DateTime? @map("completed_at")
  xpEarned    Int       @default(0) @map("xp_earned")

  user        User      @relation(fields: [userId], references: [id])

  @@unique([userId, lessonId])
  @@map("lesson_progress")
}

model MealLog {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  mealType          String   @map("meal_type") // breakfast, lunch, dinner, snack
  dishName          String   @map("dish_name")
  photoUrl          String?  @map("photo_url")
  calories          Int
  proteinG          Decimal  @map("protein_g")
  fatG              Decimal  @map("fat_g")
  carbsG            Decimal  @map("carbs_g")
  portionG          Int      @map("portion_g")
  recognitionMethod String   @map("recognition_method") // ai_photo, manual_search, manual_entry
  aiConfidence      Decimal? @map("ai_confidence")
  loggedAt          DateTime @default(now()) @map("logged_at")

  user              User     @relation(fields: [userId], references: [id])

  @@index([userId, loggedAt])
  @@map("meal_logs")
}

model CoachMessage {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  role      String   // user, assistant
  content   String
  context   Json?
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("coach_messages")
}

model Streak {
  id             String   @id @default(uuid())
  userId         String   @unique @map("user_id")
  currentStreak  Int      @default(0) @map("current_streak")
  longestStreak  Int      @default(0) @map("longest_streak")
  lastActiveDate DateTime @map("last_active_date")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user           User     @relation(fields: [userId], references: [id])

  @@map("streaks")
}

model Gamification {
  id       String   @id @default(uuid())
  userId   String   @unique @map("user_id")
  xpTotal  Int      @default(0) @map("xp_total")
  level    Int      @default(1)
  badges   Json     @default("[]")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User     @relation(fields: [userId], references: [id])

  @@map("gamification")
}

model Duel {
  id              String    @id @default(uuid())
  challengerId    String    @map("challenger_id")
  opponentId      String?   @map("opponent_id")
  inviteToken     String    @unique @map("invite_token")
  status          String    @default("pending") // pending, active, completed, expired
  startDate       DateTime? @map("start_date")
  endDate         DateTime? @map("end_date")
  challengerScore Int       @default(0) @map("challenger_score")
  opponentScore   Int       @default(0) @map("opponent_score")
  winnerId        String?   @map("winner_id")
  expiresAt       DateTime  @map("expires_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  challenger      User      @relation("challenger", fields: [challengerId], references: [id])
  opponent        User?     @relation("opponent", fields: [opponentId], references: [id])

  @@map("duels")
}
```

---

## 6. Security Architecture

```
┌──────────────────────────────────────────────┐
│              SECURITY LAYERS                  │
├──────────────────────────────────────────────┤
│ L1: Network                                   │
│   • Nginx: rate limiting (100 req/min/IP)    │
│   • TLS 1.3 (Let's Encrypt)                 │
│   • CORS whitelist (app domains only)        │
├──────────────────────────────────────────────┤
│ L2: Authentication                            │
│   • JWT RS256 (15min access + 7d refresh)    │
│   • bcrypt 12 rounds (passwords)             │
│   • VK OAuth 2.0 (optional)                  │
│   • Rate limit: 10 auth attempts/min         │
├──────────────────────────────────────────────┤
│ L3: Authorization                             │
│   • Role-based: free / premium / clinical    │
│   • Middleware check on protected routes     │
│   • Feature flags per tier                   │
├──────────────────────────────────────────────┤
│ L4: Data Protection                           │
│   • MedicalProfile: AES-256 at rest          │
│   • API keys (external): AES-GCM client-side │
│   • PII: ФЗ-152 consent flow                │
│   • Coach messages: encrypted in transit     │
├──────────────────────────────────────────────┤
│ L5: Input Validation                          │
│   • Zod schemas on ALL API inputs            │
│   • Prisma ORM (parameterized queries)       │
│   • Content-Security-Policy headers          │
│   • File upload: type + size validation      │
└──────────────────────────────────────────────┘
```

---

## 7. ADRs (Architecture Decision Records)

### ADR-001: Distributed Monolith vs Microservices
**Status:** Accepted  
**Decision:** Distributed Monolith in Monorepo  
**Rationale:** MVP with 2-3 devs. Microservices = premature complexity. Module boundaries (auth, quiz, lessons, meals, coach) are clear enough for future extraction.  
**Consequences:** Simpler deploy, shared DB. Refactor to microservices at 100K+ users if needed.

### ADR-002: Telegram Mini App over Flutter/React Native
**Status:** Accepted (revised)
**Decision:** Telegram Mini App (React web in Next.js)
**Rationale:** Instant distribution via Telegram (80M+ RU users), no App Store/Google Play review delays, zero install friction, built-in auth via initData, lower development cost (single codebase with API). Hybrid auth supports standalone web access.
**Consequences:** Limited to web capabilities (no native sensors, limited background processing). Can add native apps in Phase 2 if needed.

### ADR-003: Next.js API Routes over Dedicated Backend
**Status:** Accepted  
**Decision:** Next.js API Routes  
**Rationale:** Fullstack JS (shared types), future SSR for web app (Phase 2), simpler deploy. Edge functions for lightweight operations.  
**Consequences:** Not ideal for WebSocket (use polling for duel updates). Limited to REST (no GraphQL needed for MVP).

### ADR-004: Self-hosted MinIO over Cloud S3
**Status:** Accepted  
**Decision:** MinIO on VPS  
**Rationale:** S3-compatible API. No vendor lock-in. ₽0 cost (uses VPS storage). Easy migration to real S3 later.  
**Consequences:** Backup responsibility on us. Storage limited by VPS disk.

### ADR-005: Redis for Caching and Sessions
**Status:** Accepted  
**Decision:** Redis  
**Rationale:** Session storage (JWT blacklist), rate limiting counters, coach context caching (reduce Claude API calls), real-time duel score cache.  
**Consequences:** Single point of failure for sessions. Mitigate: Redis persistence, reconnect logic.

---

## 8. Deployment Architecture

```
┌──────────────────────────────────────────────┐
│              VPS (AdminVPS/HOSTKEY)           │
│              4 vCPU, 8GB RAM, 200GB SSD      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          Docker Compose                │  │
│  │                                        │  │
│  │  ┌────────┐  ┌─────┐  ┌────────────┐ │  │
│  │  │ Nginx  │  │ API │  │ PostgreSQL │ │  │
│  │  │ :80/443│→ │:3000│  │ :5432      │ │  │
│  │  └────────┘  └─────┘  └────────────┘ │  │
│  │                                        │  │
│  │  ┌────────┐  ┌─────────────────────┐  │  │
│  │  │ Redis  │  │ MinIO (S3-compat)  │  │  │
│  │  │ :6379  │  │ :9000              │  │  │
│  │  └────────┘  └─────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Monitoring: Prometheus + Grafana (Phase 2)  │
│  Backups: pg_dump daily → off-site           │
└──────────────────────────────────────────────┘

CI/CD Pipeline (GitHub Actions):
  push to main → test → build Docker image → 
  SSH to VPS → docker compose pull → docker compose up -d →
  health check → notify Telegram
```

### VPS Sizing

| Phase | Users | VPS Spec | Monthly Cost |
|-------|:-----:|----------|:------------:|
| MVP (M1-3) | 0-2K | 2 vCPU, 4GB, 100GB | ₽3,000 |
| Growth (M4-6) | 2K-15K | 4 vCPU, 8GB, 200GB | ₽6,000 |
| Scale (M7-12) | 15K-80K | 8 vCPU, 16GB, 500GB | ₽12,000 |
| Large (M12+) | 80K+ | 2× VPS + LB | ₽25,000+ |
