#!/usr/bin/env bash
#
# Moves the live site from Laravel to the Next.js app on the same server, and back
# (DEPLOYMENT.md §5). Both apps use the same database and the same upload folder, so no
# data is copied: what moves is the web traffic (nginx), the job queue and the scheduler.
#
#   deploy/cutover.sh prepare    # checks, and writes the Next site for the live domain; nothing live changes
#   deploy/cutover.sh switch     # Laravel -> Next
#   deploy/cutover.sh rollback   # Next -> Laravel
#   deploy/cutover.sh status     # which app has the traffic, the queues and the schedulers
#
# Run it as cuncis from /var/www/inofarma-next/current; it asks for sudo where needed.
# `switch` and `rollback` skip the steps already done, so either one can simply be run
# again (after a queue that took too long to empty, say).
#
# The order matters: exactly one scheduler and one queue worker may run at a time, and a
# worker is only stopped once its queue is empty, so no notification is lost or sent twice.

set -euo pipefail

BASE_DIR="${BASE_DIR:-/var/www/inofarma-next}"
LARAVEL_DIR="${LARAVEL_DIR:-/var/www/inofarma}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
SUPERVISOR_DIR="${SUPERVISOR_DIR:-/etc/supervisor/conf.d}"
LARAVEL_SITE="${LARAVEL_SITE:-inofarma}"
NEXT_SITE="${NEXT_SITE:-inofarma-next}"
LARAVEL_WORKER="${LARAVEL_WORKER:-inofarma-worker}"
NEXT_WORKER="${NEXT_WORKER:-inofarma-next-worker}"
PORT="${PORT:-3000}"
DRAIN_SECONDS="${DRAIN_SECONDS:-900}"
SUDO="${SUDO:-sudo}"
NGINX_RELOAD="${NGINX_RELOAD:-$SUDO systemctl reload nginx}"
BACKUP="${BACKUP:-$SUDO /usr/local/bin/inofarma-backup.sh}"

ENV_FILE="$BASE_DIR/shared/.env.local"
STATE="$BASE_DIR/shared/cutover"
TEMPLATE="$BASE_DIR/current/deploy/nginx/inofarma-next.conf"
WORKER_CONF="$BASE_DIR/current/deploy/supervisor/inofarma-next-worker.conf"
SCHEDULE_MARK="# inofarma-cutover: "

say() { echo "--> $*"; }
warn() { echo " !  $*"; }
fail() { echo "!! $*" >&2; exit 1; }

env_value() {
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

[ -f "$ENV_FILE" ] || fail "$ENV_FILE is missing (DEPLOYMENT.md §1.3)"
DATABASE_URL="$(env_value DATABASE_URL)"
REDIS_URL="$(env_value REDIS_URL)"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"

# ---- what is running ----------------------------------------------------------------

# rows in Laravel's database queue, delayed ones (chat reply emails) included
laravel_jobs() { psql "$DATABASE_URL" -XtAqc "select count(*) from jobs"; }
laravel_failed_jobs() { psql "$DATABASE_URL" -XtAqc "select count(*) from failed_jobs"; }

# jobs BullMQ has yet to finish, delayed ones included
next_jobs() {
    local total=0 n key
    for key in "llen bull:default:wait" "llen bull:default:active" "llen bull:default:paused" \
        "zcard bull:default:delayed" "zcard bull:default:prioritized"; do
        # shellcheck disable=SC2086
        n="$(redis-cli -u "$REDIS_URL" --no-auth-warning $key)" || return 1
        total=$((total + n))
    done
    echo "$total"
}

program_running() {
    local out
    out="$($SUDO supervisorctl status "$1:*" 2>&1 || true)"
    [[ "$out" == *RUNNING* ]]
}

program_known() {
    local out
    out="$($SUDO supervisorctl status "$1:*" 2>&1 || true)"
    [[ "$out" != *"no such group"* && "$out" != *"no such process"* ]]
}

# Laravel's scheduler: the `schedule:run` line in cuncis' crontab (Laravel's DEPLOYMENT.md §1.10)
laravel_schedule_on() { crontab -l 2>/dev/null | grep -qE '^[^#].*artisan schedule:run'; }
laravel_schedule_marked() { crontab -l 2>/dev/null | grep -q "^$SCHEDULE_MARK"; }

# a schedule:run started just before the line was switched off, or a task it started
laravel_tasks_running() { pgrep -f "artisan (schedule:run|pesanan:|notifikasi:)" >/dev/null; }

site_enabled() { [ -e "$NGINX_DIR/sites-enabled/$1" ]; }

# waits until "$@" prints 0, or gives up after DRAIN_SECONDS (nothing is undone: run again)
wait_until_empty() {
    local what="$1" waited=0 n
    shift
    while true; do
        n="$("$@")" || fail "Could not count $what"
        [ "$n" -gt 0 ] || break
        [ "$waited" -lt "$DRAIN_SECONDS" ] || fail "$what: still $n after ${DRAIN_SECONDS}s. Nothing was undone; run this command again to keep waiting"
        [ $((waited % 15)) -ne 0 ] || say "$what: $n left, waiting"
        sleep 5
        waited=$((waited + 5))
    done
    say "$what: empty"
}

status() {
    echo "==> Status"
    if site_enabled "$NEXT_SITE" && ! site_enabled "$LARAVEL_SITE"; then
        echo "    traffic:          Next.js"
    elif site_enabled "$LARAVEL_SITE" && ! site_enabled "$NEXT_SITE"; then
        echo "    traffic:          Laravel"
    else
        echo "    traffic:          ?? check $NGINX_DIR/sites-enabled"
    fi
    echo "    Laravel worker:   $(program_running "$LARAVEL_WORKER" && echo running || echo stopped)"
    echo "    Laravel schedule: $(laravel_schedule_on && echo on || echo off)"
    echo "    Laravel queue:    $(laravel_jobs) waiting, $(laravel_failed_jobs) failed"
    echo "    Next web:         $(curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up" && echo "answers /up" || echo "NOT answering /up")"
    echo "    Next worker:      $(program_running "$NEXT_WORKER" && echo "running (queue and schedule)" || echo stopped)"
    echo "    Next queue:       $(next_jobs) waiting"
}

# ---- the steps ----------------------------------------------------------------------

# enables one nginx site and disables the other in a single reload; a rejected config is undone
use_site() {
    local on="$1" off="$2"

    if site_enabled "$on" && ! site_enabled "$off"; then
        say "nginx already serves $on"
        return
    fi

    [ -f "$NGINX_DIR/sites-available/$on" ] || fail "$NGINX_DIR/sites-available/$on is missing"
    say "nginx: enabling $on, disabling $off"
    $SUDO ln -sfn "$NGINX_DIR/sites-available/$on" "$NGINX_DIR/sites-enabled/$on"
    $SUDO rm -f "$NGINX_DIR/sites-enabled/$off"

    if ! $SUDO nginx -t; then
        $SUDO ln -sfn "$NGINX_DIR/sites-available/$off" "$NGINX_DIR/sites-enabled/$off"
        $SUDO rm -f "$NGINX_DIR/sites-enabled/$on"
        fail "nginx rejected the config; the sites are back as they were and nothing was reloaded. Fix it and run this again, or \`$0 rollback\` to undo the steps before it"
    fi

    eval "$NGINX_RELOAD"
}

schedule_laravel_off() {
    if laravel_schedule_on; then
        say "Switching off Laravel's scheduler (the schedule:run line in cuncis' crontab)"
        mkdir -p "$STATE"
        crontab -l > "$STATE/crontab.before-switch"
        crontab -l | sed -E "/^[^#].*artisan schedule:run/s/^/$SCHEDULE_MARK/" | crontab -
    elif laravel_schedule_marked; then
        say "Laravel's scheduler is already off"
    else
        fail "No 'artisan schedule:run' line in cuncis' crontab. Where does Laravel's scheduler run? Switch it off by hand, then run this again"
    fi

    while laravel_tasks_running; do
        say "A Laravel scheduled task is still running, waiting"
        sleep 5
    done
}

schedule_laravel_on() {
    if laravel_schedule_marked; then
        say "Switching Laravel's scheduler back on"
        crontab -l | sed "s/^$SCHEDULE_MARK//" | crontab -
    elif laravel_schedule_on; then
        say "Laravel's scheduler is already on"
    else
        warn "Found no schedule:run line switched off by this script: check cuncis' crontab ($STATE/crontab.before-switch)"
    fi
}

# Laravel's worker comes out of Supervisor's config too (renamed *.off), so a reboot can't start it
laravel_worker_off() {
    if program_running "$LARAVEL_WORKER"; then
        say "Stopping Laravel's worker (each process finishes its current job first)"
        $SUDO supervisorctl stop "$LARAVEL_WORKER:*"
    fi

    if [ -f "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf" ]; then
        $SUDO mv "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf" "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf.off"
        $SUDO supervisorctl reread >/dev/null
    fi

    if program_known "$LARAVEL_WORKER"; then
        $SUDO supervisorctl remove "$LARAVEL_WORKER"
    fi

    say "Laravel's worker is stopped"
}

laravel_worker_on() {
    if [ -f "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf.off" ]; then
        $SUDO mv "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf.off" "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf"
    fi

    $SUDO supervisorctl reread >/dev/null

    if ! program_known "$LARAVEL_WORKER"; then
        $SUDO supervisorctl add "$LARAVEL_WORKER"
    elif ! program_running "$LARAVEL_WORKER"; then
        $SUDO supervisorctl start "$LARAVEL_WORKER:*"
    fi

    sleep 3
    program_running "$LARAVEL_WORKER" || fail "Laravel's worker did not start: sudo supervisorctl status; $LARAVEL_DIR/storage/logs/worker.log"
    say "Laravel's worker is running"
}

next_worker_on() {
    if program_running "$NEXT_WORKER"; then
        say "The Next worker is already running"
        return
    fi

    [ -f "$WORKER_CONF" ] || fail "$WORKER_CONF is missing: deploy a release that has it first"
    say "Starting the Next worker (queue and scheduler)"
    $SUDO cp "$WORKER_CONF" "$SUPERVISOR_DIR/$NEXT_WORKER.conf"
    $SUDO supervisorctl reread >/dev/null

    if program_known "$NEXT_WORKER"; then
        $SUDO supervisorctl start "$NEXT_WORKER:*"
    else
        $SUDO supervisorctl add "$NEXT_WORKER"
    fi

    sleep 5
    program_running "$NEXT_WORKER" || fail "The Next worker did not start: $BASE_DIR/shared/logs/worker.log"
    say "The Next worker is running"
}

# ...and out of Supervisor's config again, so a reboot can't start it beside Laravel's
next_worker_off() {
    if program_running "$NEXT_WORKER"; then
        say "Stopping the Next worker (it finishes its current job first)"
        $SUDO supervisorctl stop "$NEXT_WORKER:*"
    fi

    if program_known "$NEXT_WORKER"; then
        $SUDO supervisorctl remove "$NEXT_WORKER"
    fi

    $SUDO rm -f "$SUPERVISOR_DIR/$NEXT_WORKER.conf"
    $SUDO supervisorctl reread >/dev/null
    say "The Next worker is stopped"
}

# ---- commands -----------------------------------------------------------------------

prepare() {
    local laravel_conf="$NGINX_DIR/sites-available/$LARAVEL_SITE" names cert key site

    echo "==> Checking"
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up" || fail "The Next web server doesn't answer http://127.0.0.1:$PORT/up (DEPLOYMENT.md §1.5)"
    [ -f "$WORKER_CONF" ] || fail "$WORKER_CONF is missing: deploy the latest release first"
    site_enabled "$LARAVEL_SITE" || fail "Laravel's site $LARAVEL_SITE is not enabled: has the switch already happened? ($0 status)"
    ! site_enabled "$NEXT_SITE" || fail "$NEXT_SITE is already enabled. The trial site must be called $NEXT_SITE-trial (DEPLOYMENT.md §1.6)"
    ! program_running "$NEXT_WORKER" || fail "The Next worker is running beside Laravel's: stop it now (sudo supervisorctl stop $NEXT_WORKER)"
    program_running "$LARAVEL_WORKER" || warn "Laravel's worker is not running: \`switch\` needs it to empty Laravel's queue"
    [ -f "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf" ] || fail "$SUPERVISOR_DIR/$LARAVEL_WORKER.conf not found: set LARAVEL_WORKER to the program's name"
    laravel_schedule_on || fail "No 'artisan schedule:run' line in cuncis' crontab: where does Laravel's scheduler run?"

    local waiting
    waiting="$(next_jobs)"
    if [ "$waiting" -gt 0 ]; then
        warn "$waiting job(s) already wait in the Next queue, from things done on the trial site."
        warn "They are real (an order marked shipped there queued the customer's email) and go out"
        warn "when the Next worker starts at the switch."
    fi

    echo "==> Writing the Next site for Laravel's domain"
    names="$(awk '$1 == "server_name" { for (i = 2; i <= NF; i++) { sub(/;$/, "", $i); if ($i != "") print $i } }' "$laravel_conf" | sort -u | tr '\n' ' ' | sed 's/ $//')"
    cert="$(awk '$1 == "ssl_certificate" { sub(/;$/, "", $2); print $2; exit }' "$laravel_conf")"
    key="$(awk '$1 == "ssl_certificate_key" { sub(/;$/, "", $2); print $2; exit }' "$laravel_conf")"
    [ -n "$names" ] || fail "No server_name in $laravel_conf"
    if [ -z "$cert" ] || [ -z "$key" ]; then
        fail "$laravel_conf has no ssl_certificate: is HTTPS set up there (certbot)?"
    fi

    mkdir -p "$STATE"
    site="$STATE/$NEXT_SITE.site"
    sed -e "s|server_name yourdomain.com www.yourdomain.com;|server_name $names;|" \
        -e "s|ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;|ssl_certificate $cert;|" \
        -e "s|ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;|ssl_certificate_key $key;|" \
        -e "s|server 127.0.0.1:3000;|server 127.0.0.1:$PORT;|" \
        -e "s|alias /var/www/inofarma/storage/|alias $LARAVEL_DIR/storage/|" \
        "$TEMPLATE" > "$site"
    ! grep -q yourdomain.com "$site" || fail "The template changed: $site still says yourdomain.com"

    # tested on its own, since it can't be enabled beside Laravel's site yet
    printf 'events {}\nhttp {\n    include %s/mime.types;\n    include %s;\n}\n' "$NGINX_DIR" "$site" > "$STATE/nginx-test.conf"
    $SUDO nginx -t -q -c "$STATE/nginx-test.conf" || fail "nginx rejects $site"

    $SUDO install -m 644 "$site" "$NGINX_DIR/sites-available/$NEXT_SITE"
    say "$NGINX_DIR/sites-available/$NEXT_SITE: $names, certificate $cert (not enabled yet)"

    status
    echo "==> Ready. \`$0 switch\` when you are."
}

switch() {
    echo "==> Switching to Next.js ($(date '+%Y-%m-%d %H:%M:%S'))"
    [ -f "$NGINX_DIR/sites-available/$NEXT_SITE" ] || fail "Run \`$0 prepare\` first"
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up" || fail "The Next web server doesn't answer /up; nothing was changed"

    if site_enabled "$LARAVEL_SITE"; then
        say "Backing up the database"
        eval "$BACKUP before-cutover"
    fi

    # 1. one scheduler: Laravel's stops before the Next worker starts
    schedule_laravel_off

    # 2. web traffic: from here on, new jobs go to the Next queue (worked from step 4)
    use_site "$NEXT_SITE" "$LARAVEL_SITE"

    # 3. Laravel's worker sends what its queue still holds (chat emails wait up to 2 minutes)
    if [ "$(laravel_jobs)" -gt 0 ] && ! program_running "$LARAVEL_WORKER"; then
        fail "Laravel's queue holds $(laravel_jobs) job(s) but its worker is stopped: sudo supervisorctl start '$LARAVEL_WORKER:*', then run this again"
    fi
    wait_until_empty "Laravel's queue" laravel_jobs
    laravel_worker_off

    # 4. the Next worker: its queue, and the scheduler
    next_worker_on

    status
    local failed
    failed="$(laravel_failed_jobs)"
    [ "$failed" -eq 0 ] || warn "Laravel's failed_jobs holds $failed job(s); the Next worker doesn't retry those (php artisan queue:failed to look)"
    echo "==> Next.js is live. Rollback: $0 rollback"
}

rollback() {
    echo "==> Rolling back to Laravel ($(date '+%Y-%m-%d %H:%M:%S'))"
    [ -f "$NGINX_DIR/sites-available/$LARAVEL_SITE" ] || fail "$NGINX_DIR/sites-available/$LARAVEL_SITE is missing"

    # 1. web traffic back; Laravel's web queues its jobs in the database again, so its worker starts too
    use_site "$LARAVEL_SITE" "$NEXT_SITE"
    laravel_worker_on

    # 2. the Next worker sends what its queue still holds, then stops
    if [ "$(next_jobs)" -gt 0 ] && ! program_running "$NEXT_WORKER"; then
        fail "The Next queue holds $(next_jobs) job(s) but its worker is stopped: sudo supervisorctl start $NEXT_WORKER, then run this again"
    fi
    wait_until_empty "The Next queue" next_jobs
    next_worker_off

    # 3. one scheduler: Laravel's again, now that the Next worker is gone
    schedule_laravel_on

    status
    echo "==> Laravel is live again. The Next web server keeps running for the trial site."
}

case "${1:-}" in
    prepare) prepare ;;
    switch) switch ;;
    rollback) rollback ;;
    status) status ;;
    *) fail "Usage: $0 prepare|switch|rollback|status" ;;
esac
