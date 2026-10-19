# ssl-enforcement-check

English | [日本語](README.ja.md)

> Japanese copies of the code (Japanese comments and UI) are in [`ja/`](ja/). The main files (`sql/`, `scripts/`, `supabase/`, `app/`) are English.

Small scripts and SQL to check how connections behave **before** and **after** you flip the "Enforce SSL" switch on a Supabase project. No real database password is used.

> **This is a personal learning project.** It is not an official sample from any company and it is not meant for production.
> The page/UI texts and code comments are in English; sample data and queries may stay Japanese (none in this repo so far).

The code for these articles (written in Japanese):
- How-to: Qiita "How to enforce SSL connections on Supabase, and what happens when the database restarts after the change"
- App: Qiita "I built a status page that makes SSL and DB restarts visible: is it encrypted, and how long was it down, on one screen" (`app/` and `supabase/functions/security-status/`)

## What is in here

| File | Purpose |
|---|---|
| `scripts/check-ssl.sh` | Connects with `sslmode=disable` and `sslmode=require` using a **deliberately wrong password**, and prints at which stage the connection is refused |
| `sql/00_heartbeat_cron.sql` | (Optional) a cron job every 10 seconds, to see the gap during the restart |
| `sql/01_postgres_start_time.sql` | Asks Postgres when it started, to confirm that it restarted |
| `sql/02_cron_gap.sql` | Shows a rough measure of the downtime from gaps in the cron run history |
| `app/` | The status page (one HTML file, no build step) |
| `supabase/functions/security-status/` | The Edge Function the status page calls |
| `ja/` | Copies of the code with Japanese comments / Japanese UI |
| `README.ja.md` | Japanese README |

## Status page (`app/`)

One small screen that shows the encryption of the app -> database connection (`pg_stat_ssl`), the last restart (`pg_postmaster_start_time()`), and gaps in cron runs (`cron.job_run_details`). It is a single HTML file and needs no build.

```bash
# Deploy supabase/functions/security-status/index.ts under the name security-status (Verify JWT off; the key is checked inside the function)
# You need a cron job that runs every 10 seconds (sql/00_heartbeat_cron.sql)
cd app
cp config.example.js config.js     # fill in the URL and the publishable key (config.js is in .gitignore)
python3 -m http.server 8765 --bind 127.0.0.1   # -> http://127.0.0.1:8765/index.html
```

- The page only looks at the "app -> DB" connection. Check connections from outside with `scripts/check-ssl.sh`.
- **Cost**: the page calls the function every 30 seconds. With one tab left open that is about 2,880 calls a day and about 86,000 a month (calculated estimate). That is about 17% of the Free plan's 500,000 calls a month (per the docs).
- In my environment the connection was TLS 1.3 (`TLS_AES_256_GCM_SHA384`), and the two restarts showed gaps of 1 min 17 s and 1 min 29 s (October 2026, a small empty demo).
- Caveats: if there are several cron jobs, the gap calculation is thrown off. The start time is known only for the last restart, so older restarts show as "unknown". For a public page, add a real login.

## Prerequisites

- A Supabase project (I checked on a Free plan demo project)
- A terminal and `psql` (the PostgreSQL client)
- I only checked on a Mac

## Cost

- In my run on the Free plan, the switch itself did not cost anything (I did not see a price item for it either, but I did not check how it is handled on paid plans).
- **However, flipping the switch restarts the database.** In my demo (nearly empty, smallest size) the gap was about 20 seconds, but the dialog said "a few minutes of downtime". In production, do it when few customers are using the service.

## How to use

1. In the dashboard, open **Connect -> Session pooler** and note the host and user name.
2. **Before flipping the switch**, run the test.
   ```bash
   export PGHOST="aws-0-<region>.pooler.supabase.com"
   export PGUSER="postgres.<PROJECT_REF>"
   ./scripts/check-ssl.sh
   ```
   Before the switch, both modes get as far as `password authentication failed` (= even without encryption you can reach the front door).
3. Under **Project -> Database -> Settings**, turn on **Enforce SSL on incoming connections** (this triggers a restart).
4. Run the same test again. If `sslmode=disable` is refused with `(ESSLREQUIRED) SSL connection is required` before the password is even checked, enforcement is working.
   ```
   sslmode=disable  -> ... FATAL:  (ESSLREQUIRED) SSL connection is required for user: postgres
   sslmode=require  -> ... FATAL:  password authentication failed for user "postgres"
   ```
   (The start of the message can differ a little depending on your `psql` version.)
5. To confirm the restart, run `sql/01_postgres_start_time.sql` and `sql/02_cron_gap.sql` in the SQL Editor. If you have a 10-second cron job, the gap in the run history is a rough measure of the downtime (if you have no job, use `sql/00_heartbeat_cron.sql`).

## Notes

- The password in the connection test is a deliberately wrong string. **Do not put your real password into this script or into environment variables.**
- My direct database host (IPv6) was not reachable, so I used the Session pooler, which works over IPv4.
- The numbers I measured are **a single result from a small, nearly empty demo**. They will differ with production data volumes and connection counts.
- `sslmode=require` encrypts the connection but does not verify that the server is the real one. I have not tried `verify-full` with a certificate.

## Not verified

- Restart time on a production database with lots of data and many connections
- Using `verify-full` with a certificate
- Other regions and other connection paths (I only checked the Session pooler)
- Steps on Windows / Linux
- The English-translated `app/index.html`, `scripts/check-ssl.sh` and Edge Function were syntax-checked only (`node --check`, `bash -n`); they were not re-run against a live backend after the translation. The `ja/` copies are the versions I actually ran.

## Cleanup

If you used `sql/00_heartbeat_cron.sql`, run the `cron.unschedule` line at the end of that file to remove the job.

## License

MIT (see `LICENSE`)
