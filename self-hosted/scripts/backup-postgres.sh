#!/bin/bash
set -euo pipefail

# Daily PostgreSQL backup for Supabase self-hosted
#
# Usage:
#   ./backup-postgres.sh                    # backup to default dir
#   BACKUP_DIR=/mnt/backups ./backup-postgres.sh  # custom dir
#
# Keeps last 30 days of backups. Designed to run via launchd/cron.

BACKUP_DIR="${BACKUP_DIR:-$HOME/supabase-backups}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/supabase_${TIMESTAMP}.sql.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup..."

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  log "ERROR: Docker is not running"
  exit 1
fi

# Run pg_dump inside the supabase-db container
if docker exec supabase-db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_FILE"; then
  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup created: $BACKUP_FILE ($FILESIZE)"
else
  log "ERROR: pg_dump failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  log "ERROR: Backup file is empty"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Clean up old backups
DELETED=$(find "$BACKUP_DIR" -name "supabase_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l | tr -d ' ')
if [ "$DELETED" -gt 0 ]; then
  log "Cleaned up $DELETED old backup(s) (older than $RETENTION_DAYS days)"
fi

log "Backup complete"
