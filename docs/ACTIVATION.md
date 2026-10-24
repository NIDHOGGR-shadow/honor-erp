# Activate Honor

Updated 24 October 2026. The database is installed. This is the remaining
deployment sequence; the API and worker have not yet been activated.

## Current state

| Component | Verified state |
| --- | --- |
| GitHub | Private `NIDHOGGR-shadow/honor-erp`; staff/customer flows and PostgreSQL permission checks are implemented |
| Vercel | `honor-storefront` production build is READY; dashboard at `/workspace`; hosting authentication may restrict visitors |
| Honor Supabase target | `uxbpiigidvmlfwysomnl`, accessible through the connection named `honor`; healthy PostgreSQL 17.11 |
| Database | Installed at Alembic revision `0004`: 22 private tables, zero companies, identities, products, orders or stock movements |
| Backend database login | Restricted `honor_api` created; its generated password is stored encrypted in Supabase Vault, with no runtime access to Vault |
| Auth endpoint | Public settings return HTTP 200; email signup enabled and confirmation required; hosted login/email delivery still untested |
| API and worker | `render.yaml` defines both services; it has not been applied |
| Payments | Disabled until merchant configuration and provider test-mode acceptance are complete |

## 1. Project connection is authorized

The account connection named `honor` can now read and migrate
`uxbpiigidvmlfwysomnl`. Its organization is `lmvsuzcbvhimtpviuaeq`. Project
authorization and initial setup are complete. See [the live database
verification](LIVE_DATABASE.md) for the applied changes and checks.

Do not paste database passwords, access tokens or service-role keys into chat.
Honor needs a publishable Auth key and a restricted PostgreSQL runtime login;
the migration-owner credential stays with the database operator.

## 2. Install the empty database

This step is complete for the current project. The following are recovery and
fresh-environment instructions; do not rerun the fresh installer on the installed
project.

The preferred operator route is `uv run alembic upgrade head` from
`services/backend`, with the migration-owner TLS URL set securely in
`HONOR_DATABASE_URL`.

Alternatively, open SQL Editor in the exact Honor project and run the complete
contents of [`deploy/honor-bootstrap.sql`](../deploy/honor-bootstrap.sql).
It is one transaction generated from the same migrations and records the same
Alembic revision. It creates no customer/admin accounts or products, and does
not create or print passwords. It stops if Honor objects already exist; use
Alembic for later upgrades. A failure rolls back the installation.

Generate or verify this file without connecting to a database:

```bash
cd services/backend
uv run python -m honor.bootstrap
uv run python -m honor.bootstrap --check
```

Keep `honor` outside the Supabase Data API's exposed schemas. Create a dedicated
non-owner PostgreSQL login securely. With the owner URL, run
`uv run python -m honor.database_access grant-runtime --role honor_api`, using
the actual runtime role name if different. Switch to its TLS URL and run
`uv run python -m honor.database_access audit`. See [the live
verification](LIVE_DATABASE.md) for its checks and limitations.

For the current project, first-time runtime setup was applied using
[`deploy/honor-runtime-role.sql`](../deploy/honor-runtime-role.sql). Its password
was generated inside PostgreSQL and saved as the Vault secret
`honor_runtime_database_password`. Only a trusted operator should retrieve it
for the backend host's secret configuration. Do not put it in chat, GitHub or a
browser variable, and do not rerun this script to rotate it.

Render requires the actual shared Session pooler hostname from Supabase's
**Connect > Session pooler** panel. Do not infer the pooler cluster index from
the region. Use port `5432`, TLS and username
`honor_api.uxbpiigidvmlfwysomnl` in the runtime SQLAlchemy URL. The direct database
host normally requires IPv6, which Render does not support without Supabase's
paid IPv4 add-on. No add-on is needed for the shared pooler.

## 3. Review and deploy the API and worker

[`render.yaml`](../render.yaml) declares a new Honor project with an API and
worker in Frankfurt, using the existing Dockerfile and the `0.5c-512mb` compute
plan for each service. Both are paid services. Review the current Render cost
estimate and confirm the intended workspace before applying this Blueprint.
No Render Postgres database is created: both services use the Honor Supabase
runtime URL. Do not reuse a resource name already assigned to another app.

The current baseline compute quote is $7/month per service, $14/month for the
API and worker together, before taxes, usage charges and any workspace-plan
charges. Confirm the intended Render workspace and this recurring compute cost
before creating either service. No paid resources have been created.

The Blueprint has passed Render's current JSON Schema locally. Native Render
validation, private-repository access, a Docker build and hosted startup still
need verification; schema validation does not deploy a service.

During initial creation, enter the following values into Render's secure
environment-variable prompts:

| Key | Value |
| --- | --- |
| `HONOR_DATABASE_URL` | Restricted runtime role's `postgresql+psycopg://` URL with TLS; never the migration-owner URL |
| `HONOR_SUPABASE_URL` | Verified HTTPS API URL of the Honor project |
| `HONOR_SUPABASE_PUBLISHABLE_KEY` | Honor project's publishable Auth key |
| `HONOR_APP_ORIGIN` | `https://honor-storefront.vercel.app` for the current staff entry point |
| `HONOR_SHOP_ORIGIN` | `https://honor-storefront.vercel.app` for the current customer site |
| `HONOR_ALLOWED_ORIGINS` | The exact allowed browser origins, comma-separated; currently the storefront origin above |

The session-encryption secret is generated by Render. The worker references the
API's required environment variables instead of storing another copy in GitHub.
References refresh on a Blueprint sync, not immediately after an API variable
changes. Re-sync and deploy both services after a reviewed credential rotation.
Migrations run separately with the owner URL; the production containers keep
only the runtime URL.

Optional invitation/order email delivery needs `HONOR_RESEND_API_KEY` and
`HONOR_EMAIL_FROM` configured securely for the worker. Supabase Auth confirmation
and recovery email instead need the project's SMTP settings. Verify both before
inviting real staff. Payment activation additionally needs the eligible merchant
credentials described in [the runbook](RUNBOOK.md).

Verify API `/api/health`, a running worker, clean logs, a passing permission audit
and stock reconciliation before connecting the frontend. No seeded stock is
required for these checks.

## 4. Connect the existing Vercel site

Set server-only `HONOR_API_ORIGIN` on the connected `honor-storefront` project to
the actual deployed API HTTPS origin, then redeploy. The current project has no
configured API origin. Keep the database URL, session secret, payment secrets
and any privileged Supabase key out of Vercel's public/browser variables.

After setting up the company, set server-only `HONOR_STORE_SLUG` to its actual
slug and use `/workspace` for staff access. Configure Supabase Auth site URL,
redirect allowlists, verified-email signup and the recovery email template for
that actual domain. Confirm that hosting-level visitor protection matches the
intended public storefront; do not silently disable it during setup.

The first operator registers with their own email/password and creates the
company to obtain its administrator membership. There is no default admin
password, and customer registration alone grants no company membership.

## 5. Acceptance before customers

Exercise signup confirmation, staff login, password recovery, MFA, invitations,
suspension and forced sign-out against managed Auth and real configured email.
Check company/location access boundaries, empty inventory screens and private
customer order access. Use a separate test environment for stock/payment
fixtures; leave the requested production catalogue empty.

Before live sales, run payment-provider test mode through reservation, verified
webhook, duplicate event handling, device handover and a private PDF receipt.
Test a backup restore and reconciliation. Hosted Auth/SMTP, payments, Docker
startup and restore acceptance have not yet been completed.

References: [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp),
[Render Blueprint specification](https://render.com/docs/blueprint-spec),
[Render environment variables](https://render.com/docs/configure-environment-variables),
[Render compute plans](https://render.com/docs/compute-plans).
