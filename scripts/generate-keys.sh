#!/bin/bash
# Generate RS256 key pair for JWT signing (development)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/apps/api/.env.local"

echo "Generating RS256 key pair..."

# Generate private key
PRIVATE_KEY=$(openssl genrsa 2048 2>/dev/null)

# Extract public key
PUBLIC_KEY=$(echo "$PRIVATE_KEY" | openssl rsa -pubout 2>/dev/null)

# Convert newlines to \n for env var format
PRIVATE_KEY_ESCAPED=$(echo "$PRIVATE_KEY" | awk '{printf "%s\\n", $0}')
PUBLIC_KEY_ESCAPED=$(echo "$PUBLIC_KEY" | awk '{printf "%s\\n", $0}')

# Write to .env.local
cat > "$ENV_FILE" << EOF
# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ") — DO NOT COMMIT
DATABASE_URL=postgresql://vesna:vesna_dev@localhost:5432/vesna
REDIS_URL=redis://localhost:6379
JWT_SECRET="${PRIVATE_KEY_ESCAPED}"
JWT_PUBLIC_KEY="${PUBLIC_KEY_ESCAPED}"
NODE_ENV=development
EOF

echo "Keys written to $ENV_FILE"
echo "Done."
