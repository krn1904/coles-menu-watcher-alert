#!/bin/bash
set -euo pipefail

PROJECT_REF="cbexfvwjxvwcnorbpjkg"

if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set SUPABASE_ANON_KEY before running this script." >&2
  exit 1
fi

curl -L -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/coles-scraper" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data '{}'
