#!/usr/bin/env bash
#
# Daily PostgreSQL backup, kept 30 days: Laravel's DEPLOYMENT.md §4, for the PostgreSQL
# database both apps share (that section still shows the old mysqldump). Install as
# /usr/local/bin/inofarma-backup.sh and run from root's crontab (DEPLOYMENT.md §1.8).
#
# The password comes from ~/.pgpass (chmod 600), never from this file:
#   127.0.0.1:5432:inofarma_db:inofarma_user:the-password

set -euo pipefail

DEST="${DEST:-/var/backups/inofarma}"
DB_NAME="${DB_NAME:-inofarma_db}"
DB_USER="${DB_USER:-inofarma_user}"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$DEST"
# custom format: compressed, and pg_restore can bring back one table on its own
pg_dump --host=127.0.0.1 --username="$DB_USER" --format=custom --no-owner "$DB_NAME" > "$DEST/inofarma-$DATE.dump.part"
mv "$DEST/inofarma-$DATE.dump.part" "$DEST/inofarma-$DATE.dump"
find "$DEST" -name 'inofarma-*.dump' -mtime +30 -delete
