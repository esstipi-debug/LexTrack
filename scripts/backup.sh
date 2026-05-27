#!/bin/bash
# Manual Postgres backup for LexTrack
# Usage: ./scripts/backup.sh [output_dir]
# chmod +x scripts/backup.sh
set -e

OUTPUT_DIR="${1:-./backups}"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/lextrack_manual_${TIMESTAMP}.sql.gz"

echo "Creating backup: $BACKUP_FILE"
pg_dump "${DATABASE_URL}" | gzip > "$BACKUP_FILE"
echo "Backup complete: $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"
