# Git Workflow

## Commit Rules
- Commit after each logical change (not at end of session)
- Format: `type(scope): description`
- Max 50 chars for subject line
- Types: feat, fix, refactor, docs, test, chore

## Examples
```
feat(quiz): implement metabolic age calculation
fix(coach): add medical keyword filter before Claude API call
refactor(meals): extract nutrition calculator to shared util
docs(feature): SPARC planning for gamification
test(auth): add JWT refresh token integration tests
chore: update Docker Compose Redis config
```

## Branch Strategy
```
main (production) ← PR + CTO review
  ↑
develop (staging) ← PR + 1 review
  ↑
feature/US-XXX-description (work)
```

## Rules
- Never commit directly to main
- Feature branches from develop
- Hotfixes: branch from main, merge to both main and develop
- Tag releases: `v0.X.0`
- Delete branches after merge
