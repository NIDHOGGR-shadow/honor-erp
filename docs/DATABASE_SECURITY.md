# Honor database security review

Reviewed 23 October 2026 against the connected Supabase account and the Honor source.

## Connected account findings

Neither visible project contains an `honor` schema. No live database was migrated,
paused, reused or given new access during this review. Only schema, grants, policy,
function definitions, advisor results and aggregate operational log counts were
queried; customer records and stored tokens were not read.

| Project | Observed application | Finding and next action |
| --- | --- | --- |
| `novaxis-worker` (`ieinthuysfidruxjbvvn`) | Existing tenant, contact, job and conversation system | 22 of 23 public tables have RLS, including forced RLS on application tables. `alembic_version` has RLS disabled, but verified `anon` table SELECT/INSERT/UPDATE/DELETE and `authenticated` SELECT grants are absent. This warning does not establish anonymous data exposure. Keep migration metadata private and review its remaining privileges with that app's owner. |
| `samueltemitop2@gmail.com's Project` (`xfxqlcmsfkbvbybkrppq`) | Existing wedding/vendor app and HVAC demo | All seven public tables have RLS. Eight anonymous-callable SECURITY DEFINER functions are flagged. Seven check a supplied token against its stored hash, and all eight lock `search_path` to an empty value. `vendor_count()` returns an aggregate. Verify token generation, expiry/rotation, rate limits and intended public outputs in that app before changing these entry points. They are not Honor inventory APIs. |

RLS with no policy is reported for three Novaxis tables and `hvac_demo_leads`.
This can deliberately deny access for ordinary API roles while a trusted backend
uses a different role. Adding `USING (true)` to silence this notice would expand
access and is not an appropriate automatic fix.

Novaxis also has 12 unindexed foreign-key findings and 20 per-row RLS helper
evaluation findings. These are performance review items for that application.
Unused-index notices alone are not sufficient evidence to drop an index.

The connected tools did not expose Auth configuration. Email confirmation, SMTP,
redirect allowlists, CAPTCHA/rate limits, MFA settings, backup retention and Data
API exposed-schema settings remain unverified. This review is not a penetration
test or a claim that either existing app is fully secure.

## Honor access design

The browser calls Honor's API. The API verifies the user's session and active
company membership, role and location access before querying the private `honor`
schema. Supabase Auth verifies identity; a customer account does not grant staff
membership. Company permissions come from server records rather than editable
user metadata.

| Actor | Permitted route to records |
| --- | --- |
| Public customer | Honor catalogue/checkout APIs with filtered product fields; no direct stock ledger, cost, session or IMEI access |
| Signed-in customer | Own orders and private receipts through Honor APIs |
| Staff | Active company membership and assigned location checks on the server |
| Company administrator | Company administration through authenticated APIs, with MFA and recent verification for privileged team actions |
| API and worker | Dedicated non-owner PostgreSQL login with current-table DML; history is SELECT/INSERT only |
| Database operator | Separate migration-owner credential, used only for migrations and reviewed grants |

The current backend does not pass the user's Supabase JWT into PostgreSQL or set
an RLS tenant context. Its company isolation is enforced in the server and backed
by company-scoped foreign keys and checks. An `auth.uid()` policy pasted onto
these tables would not match this architecture. The restricted backend role can
access multiple companies; it is not database-enforced tenant isolation. If
browser-direct table access is introduced later, design and test matching RLS
policies first. Keep the schema outside Data API exposure in the meantime.

Migration `0004` explicitly removes current private-object privileges from Data
API roles, including `service_role`, and from `PUBLIC`. The application does not
need the Supabase service-role key. The runtime grant command excludes
`alembic_version`, revokes schema creation and removes old column-level grants.
It grants neither TRUNCATE nor ownership, so the API cannot disable the append-only
triggers or erase history with TRUNCATE. The original triggers still reject history
UPDATE/DELETE even for normal table-level writes by the migration owner.

These controls limit the impact of a compromised runtime credential; they cannot
make it harmless. That credential can still read private records and perform
legitimate application writes, including inserting history. Protect it as a
server secret, rotate it on exposure and monitor changes and reconciliation.

## Applying this to the intended Honor project

1. Confirm the Honor project URL. Use an isolated project; the two connected
   projects already serve other applications. Do not pause one to make room
   without an explicit choice from the owner.
2. Configure verified-email Auth, the actual HTTPS site/redirect URLs and custom
   SMTP. Test invitation, password recovery, MFA and session revocation.
3. Run `uv run alembic upgrade head` from `services/backend` using the owner TLS
   URL in `HONOR_DATABASE_URL`. This creates empty application tables, not products
   or a default administrator.
4. Create the dedicated runtime login securely, apply `grant-runtime --role
   honor_api`, switch to its URL and run `python -m honor.database_access audit`.
   The commands accept no password arguments and print no connection URL.
5. Configure the always-on API and worker, then set Vercel's server-only
   `HONOR_API_ORIGIN`. Test a denied cross-company request, suspended staff access,
   last-unit reservation, stock receipt, webhook replay, private device assignment
   and a receipt download with provider test credentials.
6. Verify the Data API excludes `honor`, configure backups, test a separate restore
   and run stock reconciliation before accepting live stock or payments.

The permission audit is read-only. It checks effective runtime role privileges,
ownership, role inheritance, current-table access, grant options, schema creation
and Data API role schema access. It does not inspect Auth settings, hosting
secrets, future object defaults, RLS policy correctness or backup configuration.
PostgreSQL schema-specific default revocations cannot remove a global default
grant. Review future objects explicitly; do not change another app's global
defaults to solve an Honor deployment concern.

## Primary references

- [Supabase Data API security: grants, RLS and private schemas](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase function security and EXECUTE grants](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
- [PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html)
