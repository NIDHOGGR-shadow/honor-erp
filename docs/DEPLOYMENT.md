# Honor deployment: private source, connected frontends

The source repository is `NIDHOGGR-shadow/honor-erp`. GitHub metadata confirmed it is private on 23 October 2026. Keep it private when authorising hosting providers; grant access to this repository rather than making it public.

## Service responsibilities

| Service | Responsibility | Source/build |
| --- | --- | --- |
| Vercel | Next.js customer shop, account screens and same-origin API proxy | Root directory `apps/storefront`; Next.js; `npm run build` |
| Cloudflare Pages | Connected staff workspace and same-origin API proxy | Repository root; `npm ci && npm run build:cloudflare`; output `dist` |
| PostgreSQL-capable backend host | FastAPI inventory transactions, managed identity sessions, payment endpoints | Existing root Dockerfile; database migration before traffic |
| Worker process on backend host | Payment-event inbox, email jobs, expiry and reconciliation | Existing backend worker/cleanup commands in RUNBOOK.md |
| Supabase | Isolated Honor PostgreSQL database and verified identity | Project selection/provisioning still required |

Cloudflare does not run this FastAPI/PostgreSQL worker stack. The frontend proxies pass requests to the same authoritative backend. Each frontend receives its own host-only HttpOnly application cookie. A sign-in on the customer host does not automatically sign in the staff host. Customer registration creates no company membership or staff permission.

## Vercel

Import the private repository and select `apps/storefront` as Root Directory. Keep “Include source files outside Root Directory” enabled, because the storefront shares `src/online` with the dashboard. npm uses the committed root workspace lockfile. Framework: Next.js. The application configuration is `apps/storefront/vercel.json`.

Configure server-only variables:

- `HONOR_API_ORIGIN`: the real HTTPS API origin, without an `/api` suffix.
- `HONOR_STORE_SLUG`: the company slug created through the verified administrator's setup workflow.
- `HONOR_WORKSPACE_URL`: the deployed Cloudflare workspace URL.

The UI remains explicitly unavailable if the API origin or slug is absent. Do not invent a company, products or accounts to make it appear connected. Catalogue reads are uncached and shared with stock reservations. API rewrites preserve cookie sessions on the storefront origin.

## Cloudflare Pages

Use the root `wrangler.toml`. Build with `npm run build:cloudflare`, which copies the reviewed advanced-mode `_worker.js` into `dist`. `VITE_PUBLIC_PREVIEW` must be absent/false. The public sample/demo mode must not be deployed as the connected workspace.

Set `HONOR_API_ORIGIN` in the Cloudflare project's runtime variables to the real HTTPS API origin. Deploy `dist` through the private Git integration or authenticated `wrangler pages deploy dist --project-name honor-workspace`. The API proxy returns 503 when unconfigured; it never returns a false empty catalogue or successful sign-in. It disables API caching and refuses insecure origins. SPA navigation falls back to the app only outside `/api/`.

No Supabase service-role credential, database password or payment secret belongs in either frontend build. Cloudflare dashboard sign-in is required before a project can be provisioned in the user's account. No direct Cloudflare account connection was available during implementation.

## Backend activation order

1. Select/create the isolated Honor Supabase project. Novaxis currently has both free project slots occupied. Do not pause/reuse another project or incur an upgrade without the user's selection.
2. Follow RUNBOOK.md for restricted database access, Supabase Auth, custom SMTP, secrets and backend/worker deployment.
3. Run `alembic upgrade head`, including migrations `0002` and `0003`, before deploying the customer account, receipt and device-handover APIs. Existing guest orders remain unassigned; matching email never grants ownership. See [purchase flow](PURCHASE_FLOW.md) for bank transfers, exact device scans and private PDF receipts.
4. Configure exact production frontend origins in `HONOR_ALLOWED_ORIGINS`, set `HONOR_APP_ORIGIN` to the staff host and `HONOR_SHOP_ORIGIN` to the customer host. Provider callbacks and email recovery must use verified HTTPS origins.
5. Create the verified administrator and an empty company through setup. Add no products or other seed records. Confirm staff invitations/MFA/password recovery and isolated customer accounts.
6. Configure the selected merchant's provider test environment and verify reservation, retry, payment webhook, expiry, cancellation, late-payment exception and physical collection. Enable real payments only after this acceptance check.

Google OAuth remains a pending provider integration and is not represented as working. Email sign-in/signup/recovery and private account history are wired to the implemented API, but require the real Supabase/backend deployment before live use.

## Verification and release

Run `npm run check`, `npm run build:storefront`, `npm run build:cloudflare`, Ruff and backend tests against isolated PostgreSQL. CI runs the concurrent stock test against native PostgreSQL 17. Confirm the exact branch/commit and target before deployment. Preserve the private repository and existing preview audience. Review rendered customer routes, sign-in, keyboard navigation and narrow-screen behaviour before business acceptance.
