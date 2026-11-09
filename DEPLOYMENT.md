# Deployment

How to run the Next.js app on the VPS that serves Laravel today, and how to ship updates
afterward. It follows Laravel's `DEPLOYMENT.md` (in `~/inofarma`): same server, same user
(`cuncis`), same PostgreSQL database, same upload folder. Switching the live domain over
is the cutover runbook's job; this sets everything up next to Laravel without touching it.

Commands prefixed `local$` run on your machine, `vps$` on the server as `cuncis`.

What changes compared with Laravel:

| Laravel | Next.js |
| --- | --- |
| PHP-FPM behind nginx | `next start` on 127.0.0.1:3000 behind nginx (Supervisor keeps it running) |
| `queue:work` (Supervisor) + `schedule:run` (cron) | one worker process does both (`src/jobs/worker.ts`); **no cron line** |
| sessions, cache, queue in PostgreSQL | sessions, rate limits, queue and cache in **Redis** (new on this server) |
| `deploy.sh`: maintenance page during the whole deploy | `deploy/deploy.sh`: builds a new release beside the live one, switches, ~2 s restart |
| rollback by hand (§3 there) | `deploy.sh --rollback` |

The database needs no migration: Next uses Laravel's tables exactly as they are (checked
table by table, column by column, index by index), and adds none of its own.

---

## 1. First-time setup

### 1.1 Packages

Node 24 (`package.json` asks for it), pnpm through Corepack, and Redis:

```
vps$ curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
vps$ sudo apt install -y nodejs redis-server postgresql-client
vps$ sudo corepack enable
vps$ node -v        # v24.x
```

Redis listens on 127.0.0.1 only by default (`bind 127.0.0.1 -::1` in
`/etc/redis/redis.conf`); leave it that way. Make it start on boot:

```
vps$ sudo systemctl enable --now redis-server
vps$ redis-cli ping   # PONG
```

`next build` needs memory. On a VPS with less than 4 GB, add swap first:

```
vps$ sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
vps$ sudo mkswap /swapfile && sudo swapon /swapfile
vps$ echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1.2 Folders

```
vps$ sudo mkdir -p /var/www/inofarma-next/shared/logs
vps$ sudo chown -R cuncis:cuncis /var/www/inofarma-next
```

`deploy/deploy.sh` keeps everything under that folder:

```
/var/www/inofarma-next/
  repo.git/                 a mirror of GitHub, fetched on each deploy
  releases/<time>-<commit>/ one folder per deploy, the newest 5 are kept
  current -> releases/...   the live release (Supervisor runs from here)
  shared/.env.local         the settings, linked into every release
  shared/logs/              web.log, worker.log
  deploy.sh
```

Put the deploy script in place (it updates with the repo; copy it again after it changes):

```
vps$ curl -fsSL https://raw.githubusercontent.com/Cuncis/ino-next/master/deploy/deploy.sh -o /var/www/inofarma-next/deploy.sh
vps$ chmod +x /var/www/inofarma-next/deploy.sh
```

(The repo is private? Then `git clone` it once anywhere and copy `deploy/deploy.sh`.)

Uploads stay in Laravel's folder, `/var/www/inofarma/storage/app/public`, so both apps
see the same photos. Next runs as `cuncis`; let new files keep the `www-data` group,
as Laravel's did:

```
vps$ sudo chown -R cuncis:www-data /var/www/inofarma/storage/app/public
vps$ sudo find /var/www/inofarma/storage/app/public -type d -exec chmod 2775 {} +
```

### 1.3 `shared/.env.local`

Start from `.env.example` in the repo and fill it in from Laravel's `/var/www/inofarma/.env`:

```
vps$ nano /var/www/inofarma-next/shared/.env.local
vps$ chmod 600 /var/www/inofarma-next/shared/.env.local
```

| Key | Value |
| --- | --- |
| `DATABASE_URL` | `postgres://inofarma_user:PASSWORD@127.0.0.1:5432/inofarma_db`: Laravel's `DB_*`, the same database |
| `REDIS_URL` | `redis://127.0.0.1:6379` |
| `APP_KEY` | **Laravel's `APP_KEY`, exactly.** 2FA secrets in the database are encrypted with it and links in sent emails are signed with it |
| `APP_PREVIOUS_KEYS` | Laravel's `APP_PREVIOUS_KEYS`, if it has any |
| `APP_URL` | `https://yourdomain.com` |
| `UPLOADS_DISK` | Laravel's `UPLOADS_DISK` (`public` today) |
| `UPLOADS_PUBLIC_ROOT` | `/var/www/inofarma/storage/app/public` |
| `UPLOADS_LEGACY_URLS` | leave empty: Laravel's stored links already use the live domain |
| `GOOGLE_CLOUD_*` / `AWS_*` | Laravel's, if `UPLOADS_DISK` is `gcs` or `s3` |
| `MAIL_MAILER` | `smtp` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Laravel's `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` (port 465 means TLS, anything else STARTTLS, as Laravel's mailer did) |
| `MAIL_FROM` / `MAIL_FROM_NAME` | Laravel's `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` |
| `DOKU_*`, `BITESHIP_*`, `WHATSAPP_*` | Laravel's, unchanged (production credentials, `DOKU_PRODUCTION=true`) |
| `QUEUE_CONNECTION` | `redis` |
| `WORKER_SCHEDULE` | `true` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Laravel's `VITE_GOOGLE_MAPS_API_KEY`; baked into the build, so changing it needs a deploy |

Nothing here maps to `APP_DEBUG`: a production build never shows stack traces.
`next start` sets `NODE_ENV=production`, which also makes every cookie `Secure`, so the
site must be reached over HTTPS (§1.6).

### 1.4 First build

```
vps$ /var/www/inofarma-next/deploy.sh
```

It clones, builds and switches `current`, then tries to restart the web server, which
Supervisor doesn't know yet (§1.5): after 90 seconds it reports that `/up` doesn't
answer and keeps the release. That's expected the first time; `current` points at it.

### 1.5 Supervisor

Add only the web server for now. **The worker waits for the cutover**: Laravel's
`queue:work` and `schedule:run` are still running, and two schedulers would expire
orders and send reminders twice. (`supervisorctl update` would start both, so it is
not used here.)

```
vps$ sudo cp /var/www/inofarma-next/current/deploy/supervisor/inofarma-next.conf /etc/supervisor/conf.d/
vps$ sudo supervisorctl reread
vps$ sudo supervisorctl add inofarma-next-web
vps$ sudo supervisorctl status
vps$ curl -s http://127.0.0.1:3000/up | grep -o 'Application up'
```

Until the worker is added, each deploy ends with a harmless "no such process" when it
tries to restart it.

Allow the deploy script its two restarts without a password, and nothing else:

```
vps$ sudo visudo -f /etc/sudoers.d/cuncis-next-restart
```

```
cuncis ALL=(root) NOPASSWD: /usr/bin/supervisorctl restart inofarma-next-web
cuncis ALL=(root) NOPASSWD: /usr/bin/supervisorctl signal TERM inofarma-next-worker
```

### 1.6 Nginx

`deploy/nginx/inofarma-next.conf` replaces Laravel's site at the cutover. Before that,
try it on a second hostname (`next.yourdomain.com`, or a second DuckDNS name) so
Laravel keeps the real one:

```
vps$ sudo cp /var/www/inofarma-next/current/deploy/nginx/inofarma-next.conf /etc/nginx/sites-available/inofarma-next
vps$ sudo nano /etc/nginx/sites-available/inofarma-next      # server_name next.yourdomain.com
vps$ sudo ln -s /etc/nginx/sites-available/inofarma-next /etc/nginx/sites-enabled/
vps$ sudo nginx -t && sudo systemctl reload nginx
vps$ sudo certbot --nginx -d next.yourdomain.com
```

While that trial site uses the live database, anything done on it is real: orders,
stock, emails. Look around and sign in; don't place orders there.

What the config does, and why (each was tested against `next start`):
- `/storage/` is served from the uploads folder by nginx. `next start` only serves files
  that existed when it was built, so without this every photo uploaded after a deploy
  would be a 404.
- `Host` is passed as the browser sent it: the app's CSRF check compares it with the
  `Origin` header.
- `X-Forwarded-For` is overwritten with the real address, never appended: the sign-in,
  OTP and password-reset limits key on it, and a client could otherwise send its own.
- `client_max_body_size 20M`, as Laravel; the app accepts the same (`next.config.ts`).
- Response buffering is off, so streamed pages arrive as they render.
- The security headers come from the app, so they aren't added here again.

### 1.7 Backups

Laravel's backup section still shows `mysqldump`; the database is PostgreSQL now.
`deploy/backup.sh` replaces it (daily, 30 days, password from `~/.pgpass`):

```
vps$ sudo cp /var/www/inofarma-next/current/deploy/backup.sh /usr/local/bin/inofarma-backup.sh
vps$ sudo sh -c 'echo "127.0.0.1:5432:inofarma_db:inofarma_user:PASSWORD" > /root/.pgpass && chmod 600 /root/.pgpass'
vps$ sudo /usr/local/bin/inofarma-backup.sh && ls -la /var/backups/inofarma
vps$ sudo crontab -e      # 0 2 * * * /usr/local/bin/inofarma-backup.sh
```

Restore one into a scratch database to be sure it works:
`createdb inofarma_restore_test && pg_restore -d inofarma_restore_test /var/backups/inofarma/inofarma-DATE.dump`.

### 1.8 Smoke test (on the trial hostname)

- `https://next.yourdomain.com` loads the storefront; product photos show.
- `https://next.yourdomain.com/admin` signs in (with 2FA if the account has it).
- Upload a picture in Media File and open its link: it loads (nginx `/storage/`). It is
  a real file in the shared folder: delete it again with "Hapus permanen".
- `sudo supervisorctl status`: `inofarma-next-web` RUNNING (no worker until cutover).
- `tail -f /var/www/inofarma-next/shared/logs/web.log` stays free of errors meanwhile.

---

## 2. Every update after that

Push to GitHub, then on the server:

```
vps$ /var/www/inofarma-next/deploy.sh
```

It fetches `master`, unpacks it into a new release, installs dependencies, builds, then
switches `current` and restarts the web server; the site is down only for the ~2 seconds
the server takes to start (measured in the rehearsal). The worker is told to stop after
its current job, and Supervisor starts it again on the new release, like
`queue:restart`. If the new release doesn't answer `/up` within 90 seconds, the previous
one is put back and restarted, and the failed release is kept to look at. A failed
install or build never touches the live site.

---

## 3. Rollback

```
vps$ /var/www/inofarma-next/deploy.sh --rollback
```

Back to the release before the live one (the newest 5 are kept). The database is shared
and has no Next-only schema, so code rollbacks need no database step.

---

## 4. Logs and checks

- `shared/logs/web.log`, `shared/logs/worker.log` (rotated by Supervisor, 5 × 20 MB)
- `https://yourdomain.com/up`: Laravel's health page, for uptime monitors
- `redis-cli info memory`: sessions and the queue live here now
