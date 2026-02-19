#!/bin/bash
set -euo pipefail

# Health check for Supabase self-hosted deployment
#
# Usage:
#   ./health-check.sh https://supabase-api.yourdomain.com
#   ./health-check.sh http://localhost:8000  # local check

BASE_URL="${1:-http://localhost:8000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  printf "%-40s " "$name"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "$expected" ]; then
    echo "OK ($HTTP_CODE)"
    PASS=$((PASS + 1))
  else
    echo "FAIL (got $HTTP_CODE, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Supabase Self-Hosted Health Check ==="
echo "URL: $BASE_URL"
echo ""

# Core services
check "GoTrue (Auth)"            "$BASE_URL/auth/v1/health"
check "PostgREST (REST API)"     "$BASE_URL/rest/v1/" "200"
check "Kong (API Gateway)"       "$BASE_URL"

# Realtime (returns 101 upgrade or 200)
printf "%-40s " "Realtime"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/realtime/v1/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "101" ] || [ "$HTTP_CODE" = "426" ]; then
  echo "OK ($HTTP_CODE)"
  PASS=$((PASS + 1))
else
  echo "FAIL ($HTTP_CODE)"
  FAIL=$((FAIL + 1))
fi

echo ""

# Docker containers (local only)
if docker info > /dev/null 2>&1; then
  echo "=== Docker Containers ==="
  CONTAINERS=$(docker ps --filter "name=supabase" --format "{{.Names}}\t{{.Status}}" 2>/dev/null)
  if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS"
  else
    echo "No supabase containers found"
  fi
  echo ""
fi

# Summary
TOTAL=$((PASS + FAIL))
echo "=== Result: $PASS/$TOTAL checks passed ==="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Some checks failed. Run 'docker compose logs' in the supabase/docker directory for details."
  exit 1
fi
