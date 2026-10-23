# Honor Inventory

Inventory control with a connected staff workspace and customer storefront. One backend owns stock, reservations, orders and payment state.

This implementation adapts Samuel's `srdataml-droid/Store-` frontend at commit `87f907442c428533d668858c815bdf33f23553c0`. No BIGGS code or private business records were reused.

## What is built

- Python FastAPI API, PostgreSQL schema, Alembic migration and append-only stock/audit history.
- Company memberships, location permissions, invitations, suspension, company-scoped forced sign-out and protected administrator changes.
- Managed Supabase identity integration; server-side opaque sessions in HttpOnly cookies; password recovery/change and authenticator flows. A separate development identity adapter is forbidden in production.
- Products, serial/IMEI tracking, quantity stock, receiving, reasoned adjustments, dispatch/receipt transfers and stock reconciliation.
- Customer shop, cart, checkout reservations, order tracking and configured collection locations.
- Paystack and Stripe hosted-checkout adapters with signed events, durable processing, amount/currency/reference verification and idempotent fulfilment.
- Paid-order fulfilment and inspected line returns that reuse the original serial unit.
- Responsive staff dashboard and Next.js public storefront, plus the original fictional browser demo at `/demo`.

This is a first implementation for review, not a running production deployment. Managed identity, merchant accounts and email require credentials and external acceptance testing. Payment simulations and fictional seed data are development-only. Shipping, automatic refunds, partial transfer receipts, purchase approvals, stock-count sessions, ML forecasts and private file uploads are not implemented.

## Run a complete local version

Install Docker with Compose, then from this repository:

```sh
python scripts/configure_dev.py
docker compose -f compose.dev.yaml up --build
```

In another terminal, create fictional stock and choose the local administrator password:

```sh
docker compose -f compose.dev.yaml exec api .venv/bin/python -m honor.cli seed-demo --email your-email@example.test
```

Open `http://localhost:8000/workspace` and sign in with that account. The fictional shop is `http://localhost:8000/shop/honor-demo`. It explicitly simulates payments and collects no money. Do not seed a real company with demonstration records. Credentials are generated locally; there is no built-in administrator password.

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

- [Setup, production configuration and operational checks](docs/RUNBOOK.md)
- [Implemented API and remaining extensions](docs/API_CONTRACTS.md)
- [Verified delivery and remaining work](docs/DELIVERY_STATUS.md)
- [Stack decisions and build sequence](docs/STACK_PLAN.md)
- [Inventory goal and wider implementation blueprint](docs/IMPLEMENTATION_PLAN.md)

For the first deployment, the Docker image serves the staff dashboard and FastAPI together on Render, keeping sign-in cookies on one origin. The Next.js storefront can run on Vercel and proxies its API requests to that backend. Supabase hosts PostgreSQL and managed identity. Run migrations separately with an owner connection and use a restricted database role for the application. No resources have been provisioned or subscriptions purchased by this change.
