#!/usr/bin/env bash
# Installs Vesna cron jobs on VPS
# Usage: sudo bash scripts/setup-cron.sh

set -euo pipefail

ENV_FILE="/opt/vesna/.env"
CRON_FILE="/etc/cron.d/vesna-cron"
API_URL="http://localhost:3000"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Deploy first."
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET not set in $ENV_FILE"
  exit 1
fi

# Validate secret contains only safe characters (no shell metacharacters)
if [[ ! "$CRON_SECRET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: CRON_SECRET contains unsafe characters. Use only [a-zA-Z0-9_-]"
  exit 1
fi

cat > "$CRON_FILE" << EOF
# Vesna scheduled tasks — managed by setup-cron.sh
SHELL=/bin/bash

# Notifications cron (hourly at :05)
5 * * * * root curl -sf -X POST ${API_URL}/api/notifications/cron -H "X-Cron-Secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> /var/log/vesna-cron.log 2>&1

# Subscription expiration cron (hourly at :10)
10 * * * * root curl -sf -X POST ${API_URL}/api/subscription/cron -H "X-Cron-Secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> /var/log/vesna-cron.log 2>&1

# Duels cron (every 15 minutes)
*/15 * * * * root curl -sf -X POST ${API_URL}/api/duels/cron -H "X-Cron-Secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> /var/log/vesna-cron.log 2>&1
EOF

chmod 600 "$CRON_FILE"
echo "Cron jobs installed at $CRON_FILE (mode 600)"
