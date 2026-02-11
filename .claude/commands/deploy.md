# /deploy $ARGUMENTS — Deployment Workflow

Deploy to specified environment. Usage: `/deploy dev`, `/deploy staging`, `/deploy prod`

## Pre-Deploy Checklist
1. All tests passing: `npm test && npm run test:integration`
2. Lint clean: `npm run lint`
3. Type check: `npm run type-check`
4. Build succeeds: `docker compose -f docker-compose.prod.yml build`
5. Prisma migrations ready: `npx prisma migrate status`

## Deploy by Environment

### dev (local Docker)
```bash
docker compose up -d --build
docker compose exec api npx prisma migrate dev
curl http://localhost:3000/api/health
```

### staging
```bash
git push origin develop  # triggers GitHub Actions → staging VPS
# Verify: curl https://staging.vesna.app/api/health
```

### prod
```bash
# 1. Create release tag
git tag -a v0.X.0 -m "Release v0.X.0: [description]"
git push origin main --tags

# 2. GitHub Actions auto-deploys to production VPS
# 3. Monitor health check
# 4. Watch Telegram alerts for 15 min
# 5. If issues: run scripts/rollback.sh
```

## Post-Deploy
- [ ] Health check green
- [ ] Error rate <2%
- [ ] Monitor Telegram alerts 15 min
- [ ] Verify critical flows (quiz, login, coach)

## Rollback
See docs/Completion.md section 3 for detailed rollback procedures.
```bash
ssh deploy@vps "cd /opt/vesna && bash scripts/rollback.sh"
```
