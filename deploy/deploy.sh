#!/usr/bin/env bash
#
# Deploys the Next.js app on the VPS (see DEPLOYMENT.md), or rolls back to the release
# before the live one:
#
#   /var/www/inofarma-next/deploy.sh             # deploy the latest master
#   /var/www/inofarma-next/deploy.sh --rollback  # back to the previous release
#
# Each deploy builds into a fresh releases/<time>-<commit>/ while the live release keeps
# serving, then switches the `current` symlink and restarts: the site is down only for
# the seconds the web server takes to start (Laravel's showed a maintenance page for the
# whole deploy instead; `next build` takes minutes, and it would overwrite the files the
# running server reads). If the new release doesn't answer /up, the old one comes back.
#
# It never touches shared/.env.local or the uploads: every release links to the same ones.
# Every setting can be overridden from the environment (the local rehearsal does).

set -euo pipefail

BASE_DIR="${BASE_DIR:-/var/www/inofarma-next}"
REPO_URL="${REPO_URL:-https://github.com/Cuncis/ino-next.git}"
BRANCH="${BRANCH:-master}"
PORT="${PORT:-3000}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_SECONDS="${HEALTH_SECONDS:-90}"
RESTART_WEB="${RESTART_WEB:-sudo supervisorctl restart inofarma-next-web}"
# queue:restart: the worker finishes its job, exits, and Supervisor starts it on the new release
RESTART_WORKER="${RESTART_WORKER:-sudo supervisorctl signal TERM inofarma-next-worker}"

REPO="$BASE_DIR/repo.git"
RELEASES="$BASE_DIR/releases"
SHARED="$BASE_DIR/shared"
CURRENT="$BASE_DIR/current"

say() { echo "--> $*"; }

point_current_at() {
    # a new symlink renamed over the old one: never a moment without `current`
    ln -sfn "$1" "$CURRENT.next"
    mv -Tf "$CURRENT.next" "$CURRENT"
}

restart_and_check() {
    say "Restarting the web server"
    eval "$RESTART_WEB"

    say "Waiting for http://127.0.0.1:$PORT/up"
    for _ in $(seq 1 "$HEALTH_SECONDS"); do
        if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up"; then
            say "Restarting the worker (it finishes its current job first)"
            eval "$RESTART_WORKER"
            return 0
        fi
        sleep 1
    done

    return 1
}

live_release() {
    if [ -L "$CURRENT" ]; then readlink -f "$CURRENT"; fi
}

# the release just before the live one, by name (names start with the deploy time)
previous_release() {
    local live
    live="$(live_release)"
    find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort | awk -v live="$live" '$0 == live { print prev; exit } { prev = $0 }'
}

if [ "${1:-}" = "--rollback" ]; then
    LIVE="$(live_release)"
    TARGET="$(previous_release)"
    [ -n "$TARGET" ] || { echo "!! No release before $LIVE to roll back to"; exit 1; }

    echo "==> Rolling back to $(basename "$TARGET")"
    point_current_at "$TARGET"

    if ! restart_and_check; then
        echo "!! $(basename "$TARGET") does not answer either; putting $(basename "$LIVE") back"
        point_current_at "$LIVE"
        eval "$RESTART_WEB"
        exit 1
    fi

    echo "==> Rolled back. The newer release is still in releases/ (delete it once fixed)."
    exit 0
fi

echo "==> Deploying Inofarma ($(date '+%Y-%m-%d %H:%M:%S'))"
mkdir -p "$RELEASES" "$SHARED/logs"
[ -f "$SHARED/.env.local" ] || { echo "!! $SHARED/.env.local is missing (DEPLOYMENT.md §1.3)"; exit 1; }

say "Fetching $BRANCH"
if [ -d "$REPO" ]; then
    git --git-dir="$REPO" fetch --prune origin "+refs/heads/*:refs/heads/*"
else
    git clone --mirror "$REPO_URL" "$REPO"
fi
COMMIT="$(git --git-dir="$REPO" rev-parse --short "$BRANCH")"
RELEASE="$RELEASES/$(date '+%Y%m%d%H%M%S')-$COMMIT"

say "Unpacking $COMMIT into releases/$(basename "$RELEASE")"
mkdir -p "$RELEASE"
git --git-dir="$REPO" archive "$BRANCH" | tar -x -C "$RELEASE"
ln -s "$SHARED/.env.local" "$RELEASE/.env.local"

# a failed build leaves the live release untouched; drop the half-built one
cleanup_failed() { echo "!! Deploy failed; the live site was not touched"; rm -rf "${RELEASE:?}"; }
trap cleanup_failed ERR

cd "$RELEASE"
say "Installing dependencies"
pnpm install --frozen-lockfile

say "Building (NEXT_PUBLIC_* values from .env.local are baked in here)"
pnpm build

trap - ERR
LIVE="$(live_release)"

say "Switching current to $(basename "$RELEASE")"
point_current_at "$RELEASE"

if ! restart_and_check; then
    if [ -n "$LIVE" ]; then
        echo "!! The new release does not answer /up; putting $(basename "$LIVE") back"
        point_current_at "$LIVE"
        eval "$RESTART_WEB"
    fi
    echo "!! Kept releases/$(basename "$RELEASE") to look at; see shared/logs/web.log"
    exit 1
fi

say "Keeping the newest $KEEP_RELEASES releases"
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort | head -n "-$KEEP_RELEASES" | while read -r old; do
    [ "$old" = "$(live_release)" ] || rm -rf "${old:?}"
done

echo "==> Deploy finished ($COMMIT)"
