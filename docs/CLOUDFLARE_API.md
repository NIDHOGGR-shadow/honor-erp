# Honor backend on Cloudflare

Intended topology: Vercel storefront/staff interface → server-side /api rewrite → Cloudflare Python API → private Supabase PostgreSQL and Auth.

The first Cloudflare deployment served another interface and had no API behind it. That did not meet the intended backend deployment goal. The API deployment below replaces that Worker; Vercel remains the customer-facing site.

## Implementation

The Workers build stages Honor's existing backend, keeping its ORM, schema and company/location/stock rules. API routes and session dependencies execute without a thread pool. Database sessions use NullPool and close after each request. An asyncio lock serializes requests and scheduled work per isolate; PostgreSQL transactions coordinate writes between isolates.

The native backend retains its existing encryption dependency. The Workers build separately pins cryptography 47. A synthetic token from the original encryption version checks compatibility. HTTP calls use AsyncClient through Pyodide's JSPI bridge in Workers; native Python retains its transport. The entrypoint forces production mode, requires PostgreSQL TLS and the restricted honor_api role, and returns a generic 503 if configuration is incomplete.

A one-minute Cron Trigger expires reservations and processes at most three outbox jobs, stopping between jobs after ten seconds elapsed. A single job can run up to its own provider/database timeout. The shared outbox retains leases, retries and idempotency.

## Dashboard settings — after runtime CI passes

Existing Worker `honor-erp`; repository root `/`; branch `main`:

- Build: `python3 -m pip install --user uv==0.13.4 && npm run build:api-worker`
- Deploy: `npm run deploy:api-worker`
- Preview: `npm run preview:api-worker`

The staging script copies backend source, entrypoint, dependency lock and Python version to ignored `build/cloudflare-api`. It does not copy environment files, migrations, test fixtures or frontend assets. The deploy command uses the staged API configuration rather than either frontend configuration.

## Runtime configuration

Set these in Cloudflare Worker runtime settings, never frontend code:

- Secret `HONOR_DATABASE_URL`: Supabase session-pooler URL using `honor_api.<project-ref>`, port 5432, database postgres and `?sslmode=require`. URL-encode reserved password characters. Never use the owner account. The machine password is stored encrypted in Supabase Vault; transfer it privately, never through chat or Git.
- Secret `HONOR_SESSION_SECRET`: stable random value of at least 32 characters. Changing it makes stored managed-auth tokens unreadable.
- Variable `HONOR_SUPABASE_URL`: Honor's API URL.
- Variable `HONOR_SUPABASE_PUBLISHABLE_KEY`: Honor's enabled publishable key.
- Variables `HONOR_APP_ORIGIN`, `HONOR_SHOP_ORIGIN`, `HONOR_ALLOWED_ORIGINS`: the actual Vercel HTTPS origin.

Managed identity, secure cookies and disabled payments are configured in the Worker file. Configure email and payment credentials separately before enabling them. Do not use the owner password previously exposed in chat.

## Cutover gate

Verify deployed `/api/health` with the real restricted account, unauthenticated inventory denial, managed sign-in, company/location boundaries, stock transactions, private PDFs and scheduled jobs before business use.

Only then set server-only `HONOR_API_ORIGIN` on the connected Vercel project to the Worker HTTPS origin and redeploy Vercel. Next.js evaluates this rewrite at build time. Session cookies remain on Vercel's origin through the proxy. Do not point the rewrite at the old gateway, or back at Vercel itself.

Native adapter tests are not proof of Workers runtime compatibility. CI separately starts workerd to check backend imports, configuration failure, the original Fernet fixture and the HTTP bridge. Real PostgreSQL connectivity, managed Auth, private PDFs, scheduled jobs and plan CPU limits still require hosted acceptance tests. No free-capacity guarantee is made.

## References

- https://developers.cloudflare.com/hyperdrive/examples/python-workers/
- https://developers.cloudflare.com/workers/languages/python/stdlib/
- https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- https://blog.pyodide.org/posts/jspi/
