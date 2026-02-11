# Secrets Management

## Principle
External API keys entered by user via UI → stored encrypted in browser. NEVER on server.

## Client-Side Encryption Pattern

### Storage
- Encryption: AES-GCM 256-bit (Web Crypto API)
- Key derivation: PBKDF2 from user password (100K+ iterations)
- Storage: IndexedDB for encrypted data
- Master key: only in memory (never persisted)
- Auto-lock after 15 min inactivity

### UX Requirements
- Settings > Integrations page with clear labels
- Password-masked input fields for all keys
- "Где взять ключ?" links with instructions
- "Проверить подключение" button for each integration
- Contextual hints on first use of a feature requiring a key

### Operations
- View: show last 4 chars only ("...xxxx")
- Update: re-encrypt with same master key
- Delete: remove from IndexedDB + clear memory
- Backup: encrypted export option
- No clipboard auto-clear (user responsibility)

## NEVER Do
- Send API keys to backend
- Log API keys (even masked)
- Store in localStorage (use IndexedDB)
- Store unencrypted anywhere
- Include in analytics events
- Expose in error messages or stack traces

## Server-Side Keys (DevOps)
- Store in `.env` file on VPS (not in git)
- `.env.example` with placeholder values in repo
- Rotate keys quarterly
- Different keys per environment (dev/staging/prod)
