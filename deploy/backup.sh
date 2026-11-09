#!/usr/bin/env bash
#
# Daily PostgreSQL backup, kept 30 days: Laravel's DEPLOYMENT.md §4, for the PostgreSQL
# database both apps share (that section still shows the old mysqldump). Install as
# /usr/local/bin/inofarma-backup.sh and run from root's crontab (DEPLOYMENT.md §1.7).
# An argument names a one-off copy beside the daily one: `inofarma-backup.sh before-cutover`
# writes inofarma-DATE-before-cutover.dump (deploy/cutover.sh does).
#
# The password comes from ~/.pgpass (chmod 600), never from this file:
#   127.0.0.1:5432:inofarma_db:inofarma:the-password
# (the user is Laravel's DB_USERNAME: `inofarma` if made as in Laravel's DEPLOYMENT.md §5.1)

set -euo pipefail

DEST="${DEST:-/var/backups/inofarma}"
DB_NAME="${DB_NAME:-inofarma_db}"
DB_USER="${DB_USER:-inofarma}"
NAME="inofarma-$(date +%Y-%m-%d)${1:+-$1}"

mkdir -p "$DEST"
# custom format: compressed, and pg_restore can bring back one table on its own
pg_dump --host=127.0.0.1 --username="$DB_USER" --format=custom --no-owner "$DB_NAME" > "$DEST/$NAME.dump.part"
mv "$DEST/$NAME.dump.part" "$DEST/$NAME.dump"
echo "$DEST/$NAME.dump"
find "$DEST" -name 'inofarma-*.dump' -mtime +30 -delete
