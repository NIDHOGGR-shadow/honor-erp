# Honor setup and operations

Date: 23 October 2026. This runbook describes the first online implementation, not a claim that production resources exist.

## Local development

`python scripts/configure_dev.py` creates an ignored root `.env` with random database/session secrets, local development identity and explicit simulated payments. It refuses to overwrite an existing file. The Docker Compose development stack includes PostgreSQL 17, a migration job, the API/dashboard and an outbox worker. The database volume survives container restarts. Stop it with `docker compose -f compose.dev.yaml down`; do not add `--volumes` unless deliberately deleting its records.

Run `docker compose -f compose.dev.yaml up --build`, then `docker compose -f compose.dev.yaml exec api .venv/bin/python -m honor.cli seed-demo --email your-email@example.test`. Choose a password of at least 12 characters at the prompt. Seeding only works in development and refuses to overwrite an existing demo. No default password is provided.

The first company can instead be created through registration/sign-in and company setup. Add a location, its collection address and online-collection permission in Company. Add/publish products in Inventory, then receive checked stock with a reference. Stock in an internal warehouse is not automatically offered for online collection.

The original browser-only demonstration remains at `/demo`; its localStorage records never become connected company stock.

## Production resources

1. Create an isolated Honor Supabase project. Choose its database region near the API. Configure sender SMTP, email confirmation, Auth site URL and allowed redirects for the actual workspace domain. Existing projects for other products must not be reused.
2. Copy `services/backend/.env.example` into the hosting secret configuration. Set production mode, a PostgreSQL psycopg connection URL with TLS, a random session secret of at least 32 characters, Supabase HTTPS URL/publishable key, HTTPS workspace/storefront origins and their exact origin allowlist. Use `postgresql+psycopg://` in SQLAlchemy URLs. Choose pool/connection limits for the project capacity.
3. Run `uv run alembic upgrade head` with a migration-owner connection in `HONOR_DATABASE_URL`. Run migrations once per release, before serving the new API. Do not run competing migration processes on API replicas.
4. Create a dedicated non-owner runtime database role through the database operator's secure administration tools. Grant `USAGE` on `honor` and `SELECT, INSERT, UPDATE, DELETE` on its tables; revoke `UPDATE, DELETE, TRUNCATE` on `honor.stock_movements` and `honor.audit_events`. Do not grant schema creation, ownership, superuser or access to other application schemas. Keep the owner URL separate from the runtime URL. The `honor` schema must stay outside the Supabase Data API's exposed schemas.
5. Deploy the root Dockerfile to a paid, always-on Render web service. It includes the Vite dashboard and FastAPI. The start command uses Render's `PORT` where provided. The readiness endpoint is `/api/health`. Enable HTTPS, structured operational monitoring and appropriate backup retention before live use. The Docker image has not been built in the current executor because Docker is unavailable here.
6. Deploy a worker from the same image using `.venv/bin/python -m honor.jobs`. Keep worker credentials server-side. The worker performs reservation cleanup every minute. Also add scheduled commands `.venv/bin/python -m honor.cli cleanup` and `.venv/bin/python -m honor.cli reconcile`. Reservation expiry is also checked during checkout/payment operations; a delayed cleanup job does not extend a reservation's validity.
7. Deploy `apps/storefront` on Vercel with monorepo dependencies from the root lockfile. Use the app's build script. Set its server-only `HONOR_API_ORIGIN` to the backend HTTPS origin, `HONOR_STORE_SLUG` to the company's slug, and `HONOR_WORKSPACE_URL` to its workspace URL. The Next.js rewrite keeps storefront API calls on the storefront origin. Add that exact origin to the backend allowlist. Use commercial hosting plans for business use.

The straightforward initial deployment keeps the staff UI and API on the same host. If the dashboard is later moved to another host, design its proxy or same-site custom domains deliberately; cross-site cookies cannot be assumed to work. Keep credentials out of browser-prefixed variables.

## Managed identity acceptance

Production refuses to start with the development identity adapter, insecure cookies or the simulated-payment adapter. It uses Supabase's identity APIs; Honor creates its own revocable opaque session after successful identity verification. Provider access/refresh tokens are encrypted server-side and never returned to the browser. Changing the session-encryption secret requires a planned sign-out/rotation procedure.

Verify signup confirmation, login, logout, password change and recovery with real configured SMTP. For recovery emails, use a Supabase email template linking to the workspace with the token hash, for example `https://YOUR-WORKSPACE/workspace?recovery={{ .TokenHash }}`. The backend verifies that token specifically as a recovery token before updating the password. Configure the actual workspace URL; the placeholder is not a deployment address.

Administrators enrol an authenticator in Security, verify it and re-enter their password before privileged team changes. The protected-action window is five minutes. Staff invitations expire after two days, require the matching verified email, are single-use and obtain roles/locations from server records. Issuing a new invitation invalidates older unused links for that email/company. Invitations are queued; queue status is visible in Company. A queued email is not a delivery receipt.

Suspension denies subsequent company operations even with an existing session. Forced sign-out blocks existing sessions for that company without removing the person's records or signing them out of unrelated companies. A person can sign in again after a forced sign-out; use suspension to withdraw continued access.

Managed identity/MFA/SMTP flows are implemented but require external acceptance testing with a configured Supabase project. The local integration tests use the isolated development identity adapter; they do not prove the external provider setup.

## Merchant setup

Confirm merchant registration country, eligibility, settlement currency and customer countries before selecting a provider. Configure exactly one pilot merchant: `HONOR_PAYMENT_PROVIDER=paystack` or `stripe`, its secret, and `HONOR_MERCHANT_COMPANY_ID`. Stripe also requires `HONOR_PAYMENT_WEBHOOK_SECRET`. Keep payments disabled until this is done. The one-merchant configuration is not a multi-merchant marketplace onboarding system.

Configure the provider webhook to `https://YOUR-BACKEND/api/v1/payment-webhooks/paystack` or `/stripe`. Events are signature-checked, stored and acknowledged; the worker verifies the provider transaction and matches amount, currency and reference before changing payment state. Never mark an order paid from the browser callback. Retries reuse stable payment references; an uncertain Paystack initialization without a saved checkout URL may require operator reconciliation instead of silently creating another charge attempt.

Exercise provider test-mode checkout, abandoned/failed payment, duplicate events, wrong amount/currency, delayed payment, expired reservation and fulfilment. No real payment was made during implementation. A late payment without stock becomes `REFUND_REQUIRED`; automatic provider refunds are not implemented. Review and resolve such cases in the merchant provider, preserving an external reference and support audit. Do not mistake a return record for a completed monetary refund.

Collection is the implemented fulfilment method. Inventory at locations not enabled for online collection is excluded from checkout. Every order is allocated from one eligible location, and the customer receives its collection name/address. Multi-location order splitting, shipping rates, carrier labels and delivery integrations remain separate extensions.

## Reconciliation, failures and recovery

Run `python -m honor.cli reconcile` using the configured runtime environment. It compares ledger totals, stock projections, active reservations and serial-unit states. Nonzero differences produce a nonzero exit status and require investigation. Never clamp balances or edit historical movements to hide a difference.

The worker leases jobs, retries failures with backoff and records a failure after eight attempts. Company administrators can see status/error class without credentials or raw email payloads. Alert on failed payment-event jobs and resolve them through an operator runbook; no in-app failed-job retry control is provided yet. Replaying a payment event is safe because processing is idempotent. External emails are at-least-once delivery and could repeat after an uncertain provider response.

Set recovery-point/recovery-time targets with the business. Back up PostgreSQL and any future private files, test a restore into a separate environment and rerun reconciliation. Do not drop the ledger to roll back a release; initial-migration downgrade intentionally refuses destructive deletion. Keep dev/preview/production databases and payment modes separate.

## Verification boundary

The backend suite exercises actual PostgreSQL SQL through an embedded PostgreSQL engine locally; its connection multiplexer cannot establish native concurrency behaviour. CI provisions native PostgreSQL 17 for the concurrent last-unit case. Browser preview could render the sign-in UI, but the preview supervisor is isolated from the Python runtime, so authenticated end-to-end browser verification was not completed. Native hosted-provider acceptance, Docker startup, production backups and operational monitoring remain release gates.
