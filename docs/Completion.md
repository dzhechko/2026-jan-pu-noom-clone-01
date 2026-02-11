# Completion

## Overview
Deployment procedures, CI/CD pipeline, backup strategy, rollback runbooks и handoff checklists для production-readiness MVP «Весна».

---

## 1. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: vesna_test
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/vesna_test
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/vesna_test
          REDIS_URL: redis://localhost:6379

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: |
          docker build -f Dockerfile.api -t vesna-api:${{ github.sha }} .
          docker save vesna-api:${{ github.sha }} | gzip > vesna-api.tar.gz
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/vesna
            git pull origin main
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --build
            docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
            # Health check
            sleep 10
            curl -f http://localhost:3000/api/health || exit 1
            # Cleanup old images
            docker image prune -f
      - name: Notify Telegram
        if: always()
        run: |
          STATUS="${{ job.status }}"
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TG_BOT_TOKEN }}/sendMessage" \
            -d chat_id=${{ secrets.TG_CHAT_ID }} \
            -d text="🚀 Deploy ${STATUS}: vesna-api@${GITHUB_SHA:0:7}"
```

### Branch Strategy

```
main (production)
  ↑ merge (PR + review)
develop (staging)
  ↑ merge
feature/US-XXX-description (work branches)
```

| Branch | Auto-deploy | Environment | Reviewers |
|--------|:-----------:|-------------|:---------:|
| feature/* | No | Local | — |
| develop | Yes → staging VPS | Staging | 1 reviewer |
| main | Yes → production VPS | Production | CTO approval |

---

## 2. Deployment Procedures

### 2.1 First Deploy (VPS Setup)

```bash
#!/bin/bash
# scripts/setup-vps.sh — Run once on new VPS

# 1. System updates
apt update && apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 3. Create app directory
mkdir -p /opt/vesna
cd /opt/vesna

# 4. Clone repo
git clone git@github.com:your-org/vesna.git .

# 5. Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://vesna:STRONG_PASSWORD@postgres:5432/vesna
REDIS_URL=redis://redis:6379
CLAUDE_API_KEY=sk-ant-xxx
JWT_SECRET=RANDOM_64_CHAR_STRING
FOOD_RECOGNITION_API_KEY=xxx
MINIO_USER=vesna_admin
MINIO_PASSWORD=STRONG_PASSWORD
DB_USER=vesna
DB_PASSWORD=STRONG_PASSWORD
EOF

# 6. SSL certificates (Let's Encrypt)
apt install -y certbot
certbot certonly --standalone -d api.vesna.app

# 7. Start services
docker compose -f docker-compose.prod.yml up -d

# 8. Run migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 9. Verify
curl https://api.vesna.app/api/health
```

### 2.2 Standard Deploy (Automated via CI/CD)

```
1. Developer pushes to main (after PR review)
2. GitHub Actions runs tests
3. If tests pass → SSH to VPS
4. Pull latest code
5. Rebuild containers
6. Run migrations
7. Health check (10s wait → curl /api/health)
8. Notify Telegram
```

### 2.3 Hotfix Deploy

```bash
# For critical production issues
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug main

# 2. Fix, test locally
npm test

# 3. Direct merge to main (skip develop)
git checkout main
git merge hotfix/critical-bug
git push origin main
# → CI/CD auto-deploys

# 4. Backport to develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop
```

---

## 3. Rollback Procedures

### 3.1 Application Rollback

```bash
#!/bin/bash
# scripts/rollback.sh — Rollback to previous version

cd /opt/vesna

# 1. Get previous commit
PREV_COMMIT=$(git log --format="%H" -2 | tail -1)
echo "Rolling back to: $PREV_COMMIT"

# 2. Checkout previous version
git checkout $PREV_COMMIT

# 3. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# 4. Health check
sleep 10
if curl -f http://localhost:3000/api/health; then
  echo "✅ Rollback successful"
else
  echo "❌ Rollback failed — manual intervention needed"
  exit 1
fi
```

### 3.2 Database Rollback

```bash
# Prisma migration rollback (if migration caused issues)
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Full database restore from backup
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U vesna -d vesna -c /backups/vesna_YYYYMMDD.dump
docker compose -f docker-compose.prod.yml start api
```

### 3.3 Rollback Decision Matrix

| Symptom | Severity | Action | Time Budget |
|---------|:--------:|--------|:-----------:|
| API 5xx >5% | Critical | Immediate rollback | 5 min |
| Login failures >50% | Critical | Rollback + investigate | 5 min |
| Payment processing broken | Critical | Rollback + manual orders | 10 min |
| Coach responses broken | High | Disable coach, keep app running | 15 min |
| Meal recognition errors >50% | Medium | Enable manual-only mode | 30 min |
| UI rendering issues | Medium | Rollback if widespread | 30 min |
| Performance degradation <2x | Low | Investigate, schedule fix | 2 hours |

---

## 4. Backup Strategy

### 4.1 Automated Backups

```bash
#!/bin/bash
# scripts/backup.sh — Run via cron daily at 03:00 UTC

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M)
RETENTION_DAYS=14

# 1. PostgreSQL dump
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U vesna -Fc vesna > "${BACKUP_DIR}/db_${DATE}.dump"

# 2. MinIO data (meal photos)
docker compose -f docker-compose.prod.yml exec -T minio \
  mc mirror /data "${BACKUP_DIR}/minio_${DATE}/"

# 3. Redis RDB snapshot
docker compose -f docker-compose.prod.yml exec -T redis \
  redis-cli BGSAVE
sleep 5
docker cp vesna-redis-1:/data/dump.rdb "${BACKUP_DIR}/redis_${DATE}.rdb"

# 4. Compress
tar -czf "${BACKUP_DIR}/vesna_full_${DATE}.tar.gz" \
  "${BACKUP_DIR}/db_${DATE}.dump" \
  "${BACKUP_DIR}/redis_${DATE}.rdb"

# 5. Upload to off-site (second VPS or S3-compatible)
rsync -az "${BACKUP_DIR}/vesna_full_${DATE}.tar.gz" \
  backup@backup-server:/backups/vesna/

# 6. Cleanup old backups
find "${BACKUP_DIR}" -name "vesna_full_*" -mtime +${RETENTION_DAYS} -delete

# 7. Verify
if [ $? -eq 0 ]; then
  curl -s "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
    -d chat_id="${TG_CHAT}" -d text="✅ Backup complete: vesna_full_${DATE}"
else
  curl -s "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
    -d chat_id="${TG_CHAT}" -d text="❌ Backup FAILED: ${DATE}"
fi
```

### 4.2 Backup Schedule

| Data | Frequency | Retention | Off-site |
|------|:---------:|:---------:|:--------:|
| PostgreSQL full dump | Daily 03:00 UTC | 14 days | Yes |
| PostgreSQL WAL (incremental) | Continuous | 7 days | Yes (Phase 2) |
| Redis RDB | Daily 03:00 UTC | 7 days | Yes |
| MinIO (photos) | Daily 04:00 UTC | 30 days | Yes |
| Application code | Git (always) | Permanent | GitHub |
| .env / secrets | Manual, encrypted | Permanent | Encrypted USB |

### 4.3 Backup Verification (Monthly)

```bash
# Test restore procedure monthly
# 1. Spin up test Docker environment
# 2. Restore latest backup
# 3. Run smoke tests
# 4. Document results
```

---

## 5. Health Check Endpoint

```typescript
// src/app/api/health/route.ts
export async function GET() {
  const checks = {
    api: "ok",
    database: await checkPostgres(),
    redis: await checkRedis(),
    claude_api: await checkClaude(),
    timestamp: new Date().toISOString(),
    version: process.env.GIT_SHA || "unknown",
    uptime: process.uptime(),
  };

  const allOk = Object.values(checks)
    .filter(v => typeof v === "string")
    .every(v => v === "ok");

  return Response.json(checks, { status: allOk ? 200 : 503 });
}
```

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_URL` | ✅ | — | Redis connection string |
| `CLAUDE_API_KEY` | ✅ | — | Anthropic API key for AI coach |
| `JWT_SECRET` | ✅ | — | JWT signing secret (RS256 private key) |
| `JWT_PUBLIC_KEY` | ✅ | — | JWT verification public key |
| `FOOD_RECOGNITION_API_KEY` | ✅ | — | Food recognition service key |
| `REVENUECCAT_API_KEY` | ✅ | — | RevenueCat server API key |
| `ONESIGNAL_APP_ID` | ✅ | — | OneSignal push notifications |
| `ONESIGNAL_API_KEY` | ✅ | — | OneSignal REST API key |
| `MINIO_USER` | ✅ | — | MinIO root user |
| `MINIO_PASSWORD` | ✅ | — | MinIO root password |
| `NODE_ENV` | ❌ | development | Environment mode |
| `PORT` | ❌ | 3000 | API server port |
| `LOG_LEVEL` | ❌ | info | Log verbosity |
| `TG_BOT_TOKEN` | ❌ | — | Telegram bot for alerts |
| `TG_CHAT_ID` | ❌ | — | Telegram chat for alerts |

---

## 7. Handoff Checklists

### For Development Team
- [ ] Repository access (GitHub, read/write)
- [ ] VPS SSH access (dev environment)
- [ ] Docker Desktop installed locally
- [ ] `.env.local` configured with dev API keys
- [ ] `docker compose up` runs successfully
- [ ] Prisma migrations applied to local DB
- [ ] Flutter SDK installed, emulator working
- [ ] Claude API key provisioned (dev)
- [ ] Code review guidelines read (CLAUDE.md)
- [ ] Git workflow understood (feature → develop → main)

### For QA Team
- [ ] Staging environment access
- [ ] Test accounts created (free, premium, clinical)
- [ ] Test payment sandbox configured (RevenueCat sandbox)
- [ ] Bug reporting process (GitHub Issues, template provided)
- [ ] Test scenarios document (from Specification.md Gherkin)
- [ ] Device matrix for mobile testing (Android 8+, iOS 14+)

### For Operations Team
- [ ] Production VPS access (SSH key)
- [ ] Monitoring dashboard access (Grafana, Phase 2)
- [ ] Telegram alerts group membership
- [ ] Backup verification access
- [ ] Rollback runbook reviewed and tested
- [ ] On-call schedule established
- [ ] Incident response procedure documented
- [ ] SSL certificate renewal scheduled (Let's Encrypt auto-renew)

---

## 8. Key Metrics for Monitoring

| Metric | Tool | Threshold | Alert |
|--------|------|:---------:|-------|
| API response time (p99) | Custom middleware | >800ms 5min | Telegram |
| Error rate (5xx) | Nginx logs | >2% 5min | Telegram |
| DB connections | Prisma | >80% pool | Telegram |
| Redis memory | Redis INFO | >200MB | Telegram |
| Disk usage | cron + df | >85% | Telegram |
| Claude API errors/hour | App logs | >5/hr | Telegram |
| Daily active users | AppMetrica | <50% of previous day | Email |
| Payment failures | RevenueCat webhook | >3 in 1hr | Telegram |
| SSL cert expiry | cron + openssl | <14 days | Email |
| Backup completion | Backup script | Any failure | Telegram |

---

## 9. Post-Launch Checklist (Week 1)

- [ ] All health checks passing
- [ ] Backups running and verified
- [ ] Monitoring alerts configured and tested
- [ ] First 20 beta users onboarded
- [ ] Error rates within acceptable thresholds
- [ ] Coach responses reviewed (sample 20 conversations)
- [ ] Meal recognition accuracy tracked (target >75%)
- [ ] RevenueCat subscription webhook working
- [ ] Push notifications delivering
- [ ] App Store / Google Play / RuStore listings live
- [ ] Analytics events flowing to AppMetrica
- [ ] Team on-call rotation active
