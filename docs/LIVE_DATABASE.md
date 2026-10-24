# Honor live database verification

Verified 24 October 2026 against project `uxbpiigidvmlfwysomnl`, using the
Supabase account connection named `honor`. The project is in organization
`lmvsuzcbvhimtpviuaeq`, region `eu-west-1`, on PostgreSQL 17.11.

## Applied setup

| Item | Verified result |
| --- | --- |
| Initial inventory schema | `honor_initial_inventory_schema` migration applied successfully |
| Application revision | `honor.alembic_version` is `0004` |
| Tables | 22 tables in the private `honor` schema, including migration bookkeeping |
| Application data | Zero companies, identities, products, orders and stock movements |
| Data API access | `anon`, `authenticated` and `service_role` have neither USAGE nor CREATE on `honor` |
| Posted history | Immutable-history triggers enabled on `stock_movements` and `audit_events` |
| Security advisor | No findings after schema installation and runtime-login provisioning |

Only Honor's project was modified. No products, stock or
application/admin accounts were created.

## Restricted backend login

Applied `honor_restricted_runtime_login` using
[`deploy/honor-runtime-role.sql`](../deploy/honor-runtime-role.sql).

`honor_api` is a machine database login, not an Honor administrator account. Its
password was generated inside PostgreSQL and stored encrypted in Supabase Vault
under the name `honor_runtime_database_password`. It has not been returned in
chat or committed to source control.

Verified effective permissions:

- LOGIN enabled; superuser, role creation, database creation, replication and
  RLS bypass disabled.
- No parent roles and no owned Honor tables.
- USAGE on `honor`, with no schema CREATE privilege; no CREATE on `public`.
- Required application table DML, with SELECT/INSERT only on stock/audit history
  and no access to migration bookkeeping.
- Zero mismatches across the 176 table-operation checks, including delegation
  checks; no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN privileges.
- No USAGE on Vault and no SELECT on its decrypted-secrets view.
- The encrypted password record exists; the verification queried only its
  existence, not its plaintext value.

The runtime role may read multiple companies. Company and location isolation
continues to rely on Honor's server checks and company-scoped constraints.

## Authentication readiness

The project's `/auth/v1/settings` endpoint returned HTTP 200 using its enabled
publishable key. Email signup is enabled, and email confirmation is required.
Email was the only enabled provider in that response. No user was registered
during this verification.

These checks do not prove SMTP delivery, configured redirect URLs, password
recovery, MFA, Google login or a working hosted Honor API. Configure and test
those before onboarding customers or staff.

## Performance notices

The performance advisor reported 16 unindexed foreign keys and 12 unused-index
notices. These are informational findings, not security failures. The database
has no application workload yet; do not drop fresh indexes based on an unused
notice. Review covering indexes against the actual stock/order/access queries
and their execution plans before making additional index changes.

Remediation references:
[unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Remaining activation

1. Obtain the actual shared Session pooler hostname from Supabase Connect;
   cluster indices cannot be derived from region names. Use the restricted
   login and a TLS connection on port 5432 for the API and worker.
2. Confirm the Render workspace and the recurring compute cost before applying
   the prepared API/worker Blueprint. Both services are currently undeployed.
3. Set the runtime credentials securely, deploy both services and run health,
   permission and reconciliation checks from the actual host.
4. Connect Vercel's server-only API origin, then complete Auth/SMTP, visitor
   access, backup/restore and payment-provider acceptance.

References: [Supabase Vault](https://supabase.com/docs/guides/database/vault),
[database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Render with Supabase Postgres](https://render.com/articles/how-to-connect-a-render-service-to-supabase-postgres),
[Render pricing](https://render.com/pricing).
