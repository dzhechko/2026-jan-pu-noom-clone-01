# Security Rules

## Authentication
- JWT RS256: 15min access tokens, 7d refresh tokens
- bcrypt 12 rounds for password hashing
- VK OAuth 2.0 as alternative auth method
- Account lockout: 5 failed attempts → 15min block

## Authorization
- Role-based: free / premium / clinical / admin
- Middleware check on all protected routes
- Feature flags per subscription tier
- Free users MUST NOT access: AI Coach, Lessons 4+, Duels

## Input Validation (MANDATORY)
- Zod schema on EVERY API input — no exceptions
- Prisma ORM only (parameterized queries, no raw SQL)
- File uploads: validate type + size (max 5MB images)
- Content-Security-Policy headers on all responses

## Medical Data Protection
- MedicalProfile fields: encrypted at rest (AES-256 via pgcrypto)
- Every read of MedicalProfile logged (user_id, timestamp, purpose)
- ФЗ-152 consent checkbox required at registration
- Right to deletion: DELETE /api/user/data cascading
- Right to export: GET /api/user/export → JSON

## AI Coach Safety (CRITICAL)
- ALWAYS run `containsMedicalRequest()` BEFORE calling Claude API
- Medical keywords: дозировка, таблетки, лекарство, оземпик, диагноз, анализы, назначить, прописать, рецепт, давление, инсулин
- If medical detected → return disclaimer, do NOT call Claude
- System prompt enforces: Russian language, CBT-only, no medical advice, 50-200 words

## Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| /auth/* | 10 req | 1 min |
| /coach/message | 20 req | 1 hour |
| /meals/recognize | 30 req | 1 hour |
| All other | 100 req | 1 min |
| Global per IP | 300 req | 1 min |

## External API Keys
- NEVER store on backend
- Client-side only: AES-GCM 256-bit encryption
- Storage: IndexedDB (encrypted)
- Key derivation: PBKDF2 from user password (100K+ iterations)
- Auto-lock after inactivity timeout

## Security Headers (Nginx)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
