# Cloudflare assessment — 24 October 2026

Status: local compatibility investigation only. No Cloudflare resources deployed, no paid plan selected, and no production database credentials used.

## Intended topology

Keep the Next.js storefront on the connected Vercel project initially. Its server-side API proxy would call an Honor API Worker over HTTPS. Keep Supabase PostgreSQL and Auth. Do not introduce D1, Prisma or Drizzle merely to change hosting.

## Evidence from the local probe

Used workers-py 1.17.9 and workers-runtime-sdk 1.9.5 with a disposable FastAPI probe. The tool selected Pyodide CPython 3.14.2 and its 314.0.7 package index.

The current production constraint cryptography>=44,<47 failed resolution: no compatible wheel was available to the selected runtime/index. Honor uses Fernet to protect stored authentication tokens, so removal is not an acceptable production fix.

Excluding cryptography only in the disposable probe allowed the other declared runtime packages to resolve and install. This is package-resolution evidence, not proof that Psycopg can connect, that PDF generation works, or that Honor starts. The probe did not exercise live PostgreSQL, Auth or inventory operations. A deployment dry run is not a runtime test.

## Work before deployment

1. Establish a supported encryption implementation or compatible package version while preserving existing ciphertext compatibility. Test decrypt/encrypt and key handling; do not weaken token storage.
2. Run a minimal FastAPI request inside workerd, then import Honor's actual application and exercise its dependencies. Replace the Uvicorn entrypoint with the Workers ASGI adapter.
3. Verify PostgreSQL connectivity, TLS, transaction rollback, row locking and concurrent stock reservations using isolated test data. Do not expose the database owner account to the application. Assess Hyperdrive only with fresh-read requirements and caching disabled where appropriate.
4. Replace the infinite jobs loop with bounded scheduled/event processing. Preserve outbox leases, retries, idempotency and reservation expiry.
5. Validate private PDF receipts and runtime assets/fonts. Measure CPU and memory, including authentication and receipt routes, against the selected plan.
6. Configure secrets through an authorized secure mechanism; deploy a preview and validate staff/customer separation and cross-company denial before setting Vercel HONOR_API_ORIGIN.
7. Enable payments only after server-side webhook verification and stock lifecycle acceptance tests pass.

## Dashboard walkthrough

Open Cloudflare → Workers & Pages. Start with the free plan and an isolated preview Worker after compatibility gates pass. Do not paste a PostgreSQL URL into frontend code or public variables. Keep Supabase unchanged while testing. Connect the production API origin only after end-to-end verification.

Workers Free currently allows 100,000 requests per day and 10 ms CPU per invocation; this is not evidence that the full Honor workload will fit. Cloudflare Containers is a separate paid route, not free Docker hosting.

## Primary references

- https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- https://developers.cloudflare.com/workers/languages/python/packages/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/containers/platform/pricing/

## Workers dashboard configuration prepared

The repository now supports Workers separately from its existing Pages configuration:

- Project name: `honor-erp`
- Repository root: `/`
- Build command: `npm run build:workers`
- Deploy command: `npm run deploy:workers`
- Preview command: `npm run preview:workers`

These use `wrangler.workers.jsonc` explicitly, avoiding the Pages-only root `wrangler.toml`. Wrangler is pinned in the npm lockfile. The Worker serves the Vite interface through its ASSETS binding and proxies `/api/*` only when a valid HTTPS `HONOR_API_ORIGIN` is configured. Without that origin, API calls return 503; this deployment does not activate inventory or staff login. No secrets are required for the disconnected interface deployment. Do not put database credentials in this gateway.

Security headers are applied by the shared gateway itself, including static and unavailable responses. Workers does not depend on the Pages `_headers` file for these protections. Workspace deep links fall back to the application while missing assets and API errors retain their proper error status.

### Follow-up compatibility results

A disposable probe using `cryptography==47.0.0` resolved and packaged successfully with the existing Psycopg, SQLAlchemy, Argon2 and ReportLab dependencies. The production backend remains on its existing constraint: a successful packaging check alone does not justify an upgrade or prove ciphertext compatibility in Workers.

Wrangler local execution hit the executor's `uv_interface_addresses` system error. A local-only fallback for network-interface enumeration allowed it to advance to startup, but the Python probe did not expose a responding HTTP endpoint during verification. No runtime success is claimed. The fallback is not included in the project or deployment.

Current Cloudflare documentation explicitly supports synchronous SQLAlchemy and lists Psycopg as a supported Hyperdrive driver. However, Honor's FastAPI synchronous route/dependency thread-pool use and synchronous HTTP calls still need adaptation/testing: Workers threading is nonfunctional and supported HTTP clients require asynchronous requests. Do not route production traffic to an unverified Python port.

References:
- https://developers.cloudflare.com/hyperdrive/examples/python-workers/
- https://developers.cloudflare.com/workers/languages/python/stdlib/
- https://developers.cloudflare.com/workers/languages/python/packages/
