# Honor Inventory

Inventory control with a connected staff workspace and customer storefront. One backend owns stock, reservations, orders and payment state.

Public product preview: https://honor-inventory-preview.zippyduck7.chatgpt.site

Presentation pilot on the existing Vercel site: `/pilot`. The interactive inventory walkthrough is at `/demo#/dashboard`, starts empty, and needs no demonstration password. It is a browser preview, separate from authenticated business records. See [the presentation guide](docs/PILOT_PRESENTATION.md) before presenting.

The public preview starts empty and adds no products or sample business records. Any preview changes stay in that browser. It does not provide shared stock, customer accounts or payment collection. Build this static preview with `VITE_PUBLIC_PREVIEW=true npm run build`. Leave that flag false for the connected application. See [the product roadmap](docs/PRODUCT_ROADMAP.md) for the launch sequence.

This implementation adapts Samuel's `srdataml-droid/Store-` frontend at commit `87f907442c428533d668858c815bdf33f23553c0`. No BIGGS code or private business records were reused.

## What is built

- Python FastAPI API, PostgreSQL schema, Alembic migration and append-only stock/audit history.
- Company memberships, location permissions, invitations, suspension, company-scoped forced sign-out and protected administrator changes.
- Managed Supabase identity integration; server-side opaque sessions in HttpOnly cookies; password recovery/change and authenticator flows. A separate development identity adapter is forbidden in production.
- Products, serial/IMEI tracking, quantity stock, receiving, reasoned adjustments, dispatch/receipt transfers and stock reconciliation.
- Customer shop, product details, cart, checkout reservations, private order tracking, verified account history and configured collection locations.
- Paystack and Stripe hosted-checkout adapters with signed events, durable processing, amount/currency/reference verification and idempotent fulfilment.
- Paid-order fulfilment and inspected line returns that reuse the original serial unit.
- Responsive staff dashboard and Next.js public storefront, plus an empty browser preview at `/demo`. Test fixtures live under `tests/fixtures` and are not imported by the running app.

This is a first implementation for review, not a running production deployment. Managed identity, merchant accounts and email require credentials and external acceptance testing. Payment simulations and fictional seed data are development-only. Shipping, automatic refunds, partial transfer receipts, purchase approvals, stock-count sessions, ML forecasts and private file uploads are not implemented.

## Run a complete local version

Install Docker with Compose, then from this repository:

```sh
python scripts/configure_dev.py
docker compose -f compose.dev.yaml up --build
```

Open `http://localhost:8000/workspace` to use an assigned staff account. Honor is one business; public business creation and public staff signup are disabled. The first administrator must have a verified identity and sign in before an operator provisions the empty business with `uv run python -m honor.cli provision-honor --email FIRST_ADMIN_EMAIL --currency NGN`. See [staff setup](docs/STAFF_ACCESS.md). Do not run the development fixture seeder for Honor setup. There is no built-in administrator password. The local development identity adapter and payment simulation collect no money and must not be deployed as production authentication.

## Develop separately

Use Node.js 22+ and Python 3.12+.

```sh
npm ci
npm run dev
npm run dev:storefront
```

The Vite dashboard proxies `/api` to `HONOR_API_ORIGIN` (default `http://127.0.0.1:8000`). Configure the backend using `services/backend/.env.example`, then run from `services/backend`:

```sh
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn honor.app:create_app --factory --host 127.0.0.1 --port 8000
```

The Next.js application needs `HONOR_API_ORIGIN`, `HONOR_STORE_SLUG` and `HONOR_WORKSPACE_URL`; see its `.env.example`. Its development port is 3001. Do not copy development identity or simulated-payment settings into production.

## Checks

```sh
npm run check
npm run build:storefront
```

Backend integration tests require an isolated PostgreSQL database named `honor_test`, `HONOR_TEST_DATABASE_URL` and `HONOR_ALLOW_TEST_DATABASE_RESET=1`. They truncate that test schema. Run `uv run ruff check honor tests` and `uv run pytest -q` in `services/backend`. CI provisions PostgreSQL 17 and includes a concurrent last-unit reservation test.

## Deployment and review

- [Vercel and Cloudflare deployment](docs/DEPLOYMENT.md)
- [Customer frontend integration](docs/GEMINI_INTEGRATION.md)
- [Setup, production configuration and operational checks](docs/RUNBOOK.md)
- [Implemented API and remaining extensions](docs/API_CONTRACTS.md)
- [Verified delivery and remaining work](docs/DELIVERY_STATUS.md)
- [Stack decisions and build sequence](docs/STACK_PLAN.md)
- [Inventory goal and wider implementation blueprint](docs/IMPLEMENTATION_PLAN.md)

The Next.js customer storefront and staff entry target the existing Vercel project. The Docker API targets Render; its hosted connection remains pending. Supabase hosts PostgreSQL and managed identity. Run migrations separately with an owner connection and use a restricted database role for the application. The presentation pilot needs no backend credentials or paid resources. Cloudflare deployment files remain for the earlier experiment; they are not proof of a running backend.
