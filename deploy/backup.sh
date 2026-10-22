#!/bin/sh
# Daily PostgreSQL backup with rotation. Runs inside the postgres image (pg_dump, gzip, find).
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p /backups
while true; do
  file="/backups/agula-quiz-$(date -u +%Y-%m-%dT%H%M).sql.gz"
  if pg_dump -h postgres -U quiz quiz | gzip > "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "backup: wrote $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.tmp"
    echo "backup: FAILED at $(date -u)" >&2
  fi
  find /backups -name 'agula-quiz-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  sleep "$INTERVAL"
done
