#!/usr/bin/env bash
# Smoke-test deployed Supabase edge functions. Requires SUPABASE_ANON_KEY.
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-cbexfvwjxvwcnorbpjkg}"
BASE="https://${PROJECT_REF}.supabase.co/functions/v1"

if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set SUPABASE_ANON_KEY before running." >&2
  exit 1
fi

call_fn() {
  local name="$1"
  local data="${2:-{}}"
  echo "=== $name ==="
  local response
  response=$(curl -sS -X POST "${BASE}/${name}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    --data "$data")
  echo "$response" | node -e "
    const r = JSON.parse(require('fs').readFileSync(0,'utf8'));
    console.log(JSON.stringify(r, null, 2));
    if (r.code && r.message) process.exit(1);
  "
}

call_fn coles-scraper
call_fn woolworths-scraper
call_fn send-deal-alerts '{}'

echo "All API smoke tests passed."
