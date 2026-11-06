# Honor deployment: Vercel and Render

The private source repository is NIDHOGGR-shadow/honor-erp. The active hosting arrangement is Vercel for the frontend, Render for the FastAPI backend, and Supabase for PostgreSQL and managed identity.

## Responsibilities

| Service | Responsibility |
| --- | --- |
| Vercel | Next.js customer shop, customer accounts, /workspace staff/admin application and same-origin API proxy. |
| Render | Existing root Dockerfile, FastAPI inventory/order/payment operations and /api/health. |
| Supabase | Existing private Honor schema and managed identity. |
| Configured job runner | Email jobs, payment-event processing, reservation expiry and reconciliation. The free API service does not by itself establish an operational background worker. |

Older Cloudflare files are historical and are not active deployment instructions or required release jobs.

## Vercel configuration

Use apps/storefront as Root Directory and retain access to shared source outside that directory. npm uses the committed root workspace lockfile. Build with npm run build:storefront from the repository root, or the workspace's build command in the hosting project.

Configure server-only HONOR_API_ORIGIN to the verified Render API origin, without an /api suffix. Configure HONOR_STORE_SLUG to the actual business slug. Leave HONOR_WORKSPACE_URL unset to use the built-in /workspace route on Vercel. Database, identity-management and payment secrets stay outside browser bundles.

The existing Render service is named honor-api and advertises https://honor-api.onrender.com. That recorded URL is not proof of a healthy backend; check /api/health and a complete authenticated workflow.

## Render configuration

Use the existing honor-api service and root Dockerfile. The repository render.yaml specifies a free Docker web service and /api/health. Preserve its existing secrets and private repository access.

The backend needs the restricted Honor database connection, session secret, managed-identity settings and exact allowed frontend origins. HONOR_APP_ORIGIN and HONOR_SHOP_ORIGIN refer to the appropriate Vercel origin. Merchant payments remain disabled until configured and accepted against the operating business.

Apply uv run alembic upgrade head from services/backend using the migration owner connection before shipping this version. Migration 0006 adds product variant metadata and storefront content. The generated deploy/honor-bootstrap.sql is only for an empty database; it must not be used to overwrite an existing business.

## Verification

Run npm run check, npm run build:storefront, backend Ruff, the offline bootstrap export check, and backend tests against isolated PostgreSQL. GitHub CI includes psycopg and pg8000. Keep live inventory and merchant transactions separate from disposable test fixtures.

Before describing the hosted app as functional, verify sign-in, assigned staff permissions, product setup, checked stock receipt, publication, customer cart/checkout, verified payment status and collection/receipt. No account, stock or payment success should be fabricated to mask a missing service connection.
