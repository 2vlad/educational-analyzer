#!/bin/bash
set -euo pipefail

# Apply all database migrations to Supabase self-hosted PostgreSQL
#
# Usage:
#   ./apply-migrations.sh                          # defaults: localhost:5432
#   ./apply-migrations.sh --host 192.168.1.10      # custom host
#   PGPASSWORD=secret ./apply-migrations.sh        # pass password via env
#
# Migrations are applied in dependency order.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/migrations"

# Defaults
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --host) DB_HOST="$2"; shift 2 ;;
    --port) DB_PORT="$2"; shift 2 ;;
    --user) DB_USER="$2"; shift 2 ;;
    --db)   DB_NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Migration files in dependency order
MIGRATIONS=(
  "0001_init.sql"
  "0002_multi_user_support.sql"
  "20250122_programs_batch_analyzer.sql"
  "20250111_fix_programs_manual_support.sql"
  "20250127_atomic_job_locking.sql"
  "20250128_add_session_tracking.sql"
)

echo "=== Supabase Migration Runner ==="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check psql is available
if ! command -v psql &> /dev/null; then
  echo "Error: psql not found. Install PostgreSQL client:"
  echo "  brew install libpq && brew link --force libpq"
  exit 1
fi

# Test connection
echo "Testing connection..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "Error: Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT"
  echo "Make sure Docker is running and PGPASSWORD is set."
  exit 1
fi
echo "Connection OK"
echo ""

# Apply migrations
APPLIED=0
FAILED=0

for migration in "${MIGRATIONS[@]}"; do
  filepath="$MIGRATIONS_DIR/$migration"

  if [ ! -f "$filepath" ]; then
    echo "[SKIP] $migration - file not found"
    continue
  fi

  echo -n "[APPLY] $migration ... "

  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$filepath" > /dev/null 2>&1; then
    echo "OK"
    APPLIED=$((APPLIED + 1))
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
    echo "  Run manually to see errors:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $filepath"
  fi
done

echo ""
echo "=== Done: $APPLIED applied, $FAILED failed ==="

if [ $FAILED -gt 0 ]; then
  exit 1
fi
