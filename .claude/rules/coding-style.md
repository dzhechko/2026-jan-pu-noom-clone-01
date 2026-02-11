# Coding Style

## TypeScript (Backend — Next.js API)
- Strict mode: `"strict": true` in tsconfig.json
- Explicit return types on all public functions
- Zod schemas for all API input validation
- Prisma generated types for DB entities
- Named exports (no default except pages)
- Async/await over .then() chains
- Error handling: try/catch with typed error codes from docs/Refinement.md

## React (Frontend — Telegram Mini App)
- All interactive pages use `'use client'` directive
- React Context + hooks for state (TelegramProvider, AuthProvider)
- Tailwind CSS with Telegram theme CSS variables (`tg-*` tokens)
- `clsx` for conditional class composition
- Components in `src/components/{ui,layout,quiz,lessons,coach}/`
- Custom hooks in `src/hooks/` (useAuth, useTelegram)
- API calls via `src/lib/api-client.ts` (fetch wrapper with JWT)

## File Naming
- TypeScript: `kebab-case.ts` (e.g., `metabolic-age.ts`)
- React components: `kebab-case.tsx` (e.g., `quiz-stepper.tsx`)
- Tests: `*.test.ts`
- Components: `PascalCase` class name, kebab-case file name

## API Route Pattern
```typescript
// src/app/api/quiz/submit/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ /* ... */ });

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: { code: "QUIZ_001", message: "Проверьте данные" } },
      { status: 400 }
    );
  }
  // business logic
}
```

## Error Response Format
```json
{
  "error": {
    "code": "AUTH_001",
    "message": "Неверный email или пароль",
    "details": {}
  }
}
```

## Imports Order
1. Node/Framework built-ins
2. Third-party libraries
3. Internal packages (@/lib, @/utils)
4. Relative imports
5. Type imports last
