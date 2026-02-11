# Insights Capture Protocol

## When to Capture
- After debugging that took >30 minutes
- When finding undocumented behavior in a library/API
- When a workaround proved better than the "correct" solution
- When encountering environment-specific issues (Docker, VPS, Flutter build)
- After resolving a production incident

## How to Capture
Run `/myinsights [short title]` and provide:
- **Symptoms:** What you observed
- **Diagnostic:** What you checked and ruled out
- **Root Cause:** The actual problem
- **Solution:** What fixed it
- **Prevention:** How to avoid in future

## Before Debugging
ALWAYS check `docs/insights.md` first — the answer might already be there.

## Auto-Commit
The Stop hook in settings.json automatically commits insights.md changes when you end a session. No manual git add needed.

## Tags
Use hashtags for searchability: #prisma #docker #flutter #claude-api #nginx #redis #auth #deploy #performance
