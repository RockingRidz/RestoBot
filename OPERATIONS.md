# RestoBot pilot operations

Scope: one restaurant per server process. This runbook does not claim a deployment, live restore drill or completed pilot.

## Before deployment

1. Use Node 22, install with `npm ci`, and run `npm run check`. Recompile research references with `node scripts/compile-research.mjs` when the source documents change.
2. Back up the existing Supabase project using the project's established backup mechanism. Preserve its retention/access controls. Restore into an isolated project to verify recovery before relying on the backup.
3. Apply pending migrations in numeric order, through `006_closure_calendar.sql`, including the zero-sales functions in `005_confirmed_zero_sales.sql`. Migration 004 tightens recipe ingredient links; it must not be skipped. Local PostgreSQL tests cover these migrations, not the live deployment.
4. Configure server-only AI and Supabase service keys, the Supabase public auth key, the restaurant ID and the deployed auth redirect URLs. Never put service keys in `VITE_*` variables or frontend code. AI remains off until both its enable flag and a positive daily request cap are deliberately configured.
5. Run `npm run preflight`. It is read-only and reports missing required columns without printing secrets. It does not prove RLS policy correctness, external login flows or provider availability. Production startup also rejects missing required columns.
6. Start the compiled server with `NODE_ENV=production` using the host's environment configuration and `npm start`. Use TLS at the host/reverse proxy. Run the real authenticated owner workflow and an independent second-tenant denial check before opening the pilot.

## Daily supervised operation

Import recent POS records, reconcile counted stock and review recipes/pack sizes. Generate a forecast, review warnings, edit quantities with a reason and approve. Copy/export records an owner action; it is not confirmation that the supplier received the order. Confirm supplier receipt independently.

Historical import preserves today's stock. Operational import consumes ingredients. Refunds and voids require explicit reconciliation; do not silently turn a prepared-food refund into returned stock. Do not label missing days as zero-sales days without confirmation.

Monitor `/healthz` for server liveness; it does not prove AI or database readiness. Review authenticated `/api/health` and preflight results for dependencies. AI temporary failures get one retry; usage-limit and credential errors require configuration/account review. A retained forecast is reused only while its date and sales/stock/recipe fingerprint remain current. Updates require a new forecast and approval.

Record closure dates in Settings using Detroit calendar dates. Closed dates are excluded from purchase demand and invalidate existing forecasts/approvals. Use the sales page to record confirmed zero sales only on completed open days.

An opt-in daily draft scheduler is implemented as of October 1. Migration 007 is applied and a live one-shot draft is verified. Unattended scheduling remains disabled until deployment and monitoring are verified. No alert destination or supplier delivery service has been configured. A 5 AM automated-delivery promise must remain disabled until scheduling, retries, monitoring and failure notifications have been deployed and exercised.

## Daily draft scheduler (October 1)

The owner confirmed `America/Detroit`. This value is saved in the local environment;
`RESTOBOT_SCHEDULER_ENABLED=false` remains in effect. Before enabling:

1. Apply `supabase/migrations/007_daily_forecast_jobs.sql` to any new deployment project. It is already applied to the existing project as of October 1. It adds a job ledger and service-role-only functions; existing restaurant/forecast/order data is preserved. Local PostgreSQL migration, privilege, retry and restore tests pass. Live SQL verification confirms service-role execution and denial of anonymous/authenticated claim execution and authenticated direct reads. All 11 preflight checks, including the ledger, pass.
2. Set the exact `RESTOBOT_RESTAURANT_ID`, `RESTOBOT_SCHEDULE_TIMEZONE=America/Detroit`, and `RESTOBOT_SCHEDULE_AT=04:30`. Production now requires an explicit restaurant ID and fails if it is absent or cannot be found. There is no production name-based fallback.
3. Keep **one operational app process per restaurant**. The app maintains its working data in memory after startup and updates it on API writes. The job ledger protects overlapping runs/restarts; it does not make independent app caches consistent. Import/change data through the running app; restart after external database changes.
4. Enable `RESTOBOT_SCHEDULER_ENABLED=true` only in the intended supervised environment, then run preflight and start the compiled server. Startup checks the ledger. The first tick happens on startup, then every minute. After 04:30 it catches up the current local day; it does not backfill missed earlier days. A skipped daylight-saving clock time runs at the first later tick. Repeated clock times share the same local-date job identity.
5. Verify a generated draft, owner review/approval, restart deduplication and closure skip. Scheduling, sales grouping, closure dates and the forecast's next-day target use Detroit local calendar dates. Date-only POS input is interpreted as Detroit midnight; timestamps with explicit offsets retain their stated instant. Check a late-night sale and both daylight-saving transitions during pilot review.
6. Configure the host's monitor to run `node dist/check-operations.mjs` from the app directory every minute. Development equivalent: `npm run operations:check`. Exit 0 means healthy/not due, 1 means failure/missing/overdue/unavailable, and 2 means disabled. Missing runs become unhealthy after a five-minute startup allowance. Connect failures to a confirmed alert destination and verify actual notification delivery. The command itself sends no messages.

Each restaurant/local date has one durable job. A five-minute lease fences crashed
workers. Transient failures retry at five-minute intervals, up to three job attempts;
each attempt can make at most two provider calls using the existing transient retry.
Quota, credentials, unavailable models and malformed predictions stop automatic
retry for that day. Review configuration and use manual generation after correction;
do not delete the ledger to force another run. A crash can repeat provider work after
lease expiry, but forecast insertion and successful job completion share one SQL
transaction, so completion-response retries do not create a second saved forecast.
Closed Detroit target dates record a skip without calling the AI service.

`GET /api/operations/daily-forecast` exposes the last 14 run states to the authenticated
owner when enabled. Structured server logs use controlled failure codes and exclude
provider response text, keys and customer data. The worker creates draft forecasts
only; it never approves, exports, contacts a supplier or claims receipt. The deployment
monitor must alert on both a failed job and an unavailable monitor/database.

An explicit supervised check is available as `npx tsx scripts/run-daily-forecast-once.ts --run-once`.
It follows the configured local due time even when the unattended scheduler is disabled.
It can call the configured AI service and retains a real draft and job record; run it only for the intended
restaurant. October 1 verification used the labeled synthetic dataset, produced one
saved AI draft, and never approved or sent an order. `node scripts/verify-live-startup.mjs`
provides a separate read-only compiled-startup/auth-boundary probe and closes its server.

To roll back this feature, set `RESTOBOT_SCHEDULER_ENABLED=false` and restart the app.
Wait for any running generation to finish or for its five-minute lease to expire
before re-enabling. Keep migration 007 and its audit records in place. Restore the
previous application artifact through the hosting provider if needed; do not reverse
the migration by dropping tables. This is a rollback procedure, not evidence of a
live deployment rollback drill.

## Recovery and rollback

Keep the prior application build and deploy configuration. Roll back application code through the host's normal release mechanism. Do not reverse database migrations by deleting culinary columns or approval records. For database recovery, use a verified backup restored to an isolated target first, verify tenant isolation and reconcile all POS/orders since the backup, then plan the controlled cutover.

The local restore regression in `src/tests/culinary-database.test.ts` dumps and restores PostgreSQL with recipe yield, stock, forecast/approval records, actor, original/edited quantities, reason, timestamp and tenant isolation. Run it with `npx vitest run src/tests/culinary-database.test.ts`. It is not a substitute for a Supabase backup/restore drill.

## Release gates still open

Authenticated browser restart/recovery verification; full source POS export; measured replacement portions and supplier information; deployed monitoring/scheduling/backup recovery; real-restaurant held-out evaluation; at least seven supervised pilot days. Track incidents, forecast errors, stockouts, waste and owner review time during the pilot.


## September 29 verification and login recovery

Migrations 005 and 006 were applied to the existing Supabase project on September 29. The eight read-only preflight checks passed. Service-role workflow checks verified explicit zero-sales observations and unchanged stock across restart, plus edited approval snapshots, print/copy records, status history and idempotent export retries. All uniquely identified verification records were removed. These checks do not replace authenticated browser validation.

Build login configuration with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never expose service-role or AI keys. After building, run `node scripts/check-built-auth.mjs` from the app directory. Signup is opt-in only. The live-database development server hides demo entry. The login page provides Forgot password; the owner requests the email and chooses the new password. Recovery email delivery and the completed reset still need owner verification.

Optional live checks (create/remove uniquely marked test records): bundle and run `scripts/verify-workflows.ts` and `scripts/verify-approval-roundtrip.ts` with the existing esbuild setup. The latter checks concurrent duplicate export creation and a fresh-process retry without resetting its completed status.
