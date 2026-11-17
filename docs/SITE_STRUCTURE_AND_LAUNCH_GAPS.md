# HONOR site structure, routes and remaining work

Updated 17 November 2026. This document distinguishes implemented code from hosted acceptance and planned functionality. It does not claim that backend activation, merchant payments or customer acceptance are complete.

## One website, two user-facing areas

The active Vercel Next.js app lives in `apps/storefront`. Route groups `(shop)` and `(staff)` organize files without changing browser URLs:

```text
apps/storefront/
  app/
    layout.tsx                       Shared root layout
    globals.css                      Shared stylesheet
    (shop)/
      page.tsx                       GET /                     Customer home/store
      [category]/page.tsx            GET /:category             Category collection
      shop/[slug]/page.tsx           GET /shop/:slug            Slug-specific shop
      shop/[slug]/[category]/page.tsx GET /shop/:slug/:category  Slug-specific category
    (staff)/
      workspace/page.tsx             GET /workspace             Authenticated staff/admin app
      admin/page.tsx                 GET /admin                 Redirects to /workspace
    preview/page.tsx                 GET /preview               Review-only; blocked on production
    demo/page.tsx                    GET /demo                  Retired, redirects to /workspace
    pilot/page.tsx                   GET /pilot                 Retired, redirects to /
  lib/
    catalogue.ts
    categoryPage.tsx
    review.ts
src/online/
  Storefront.tsx, StoreNavigation.tsx, StorefrontDesign.tsx
  Workspace.tsx, workspaceSession.ts
  CatalogueForms.tsx, HonorOperationsReports.tsx, HonorOnlineStoreSettings.tsx
  api.ts
services/backend/honor/               Shared FastAPI service
services/backend/migrations/          PostgreSQL schema evolution
tests/                                Frontend/backend regression coverage
```

All data remains in the SAME authorized backend and inventory ledger. The admin URL is an alias, NOT a new auth provider or a privileged bypass: staff, manager and administrator roles are checked by the existing API. Staff are invited or provisioned by authorized operators; there is no public staff signup.

## Current customer experience (implemented code; not hosted acceptance)

- `/`: product catalogue, responsive navigation, search/browsing and account entry.
- Category URLs and `/shop/[slug]` routes: server-backed catalogue loading; product details and variant selection currently handled in the storefront experience.
- Sign-in, account creation and order/history interaction currently use the customer storefront's internal views. **Do not claim separate `/cart`, `/checkout`, `/account` or `/product/[slug]` URL pages are implemented.**
- Customer checkout must read the real stock, price and company rules. Never create sample inventory in production.

## Current staff experience (implemented code; not hosted acceptance)

- `/workspace`: permission-checked Overview, Reports, Online store, Inventory, Receive stock, Transfers, Orders, People & access, Activity, Security and Company.
- `/admin`: short redirect to `/workspace`, not a second dashboard; access remains scoped by role/company/location.
- Products, stock, orders, reporting and public catalogue share backend records. A dashboard tab does not necessarily have a distinct URL yet.

## Remaining work in priority order

### P0 — make the existing site genuinely operational

1. Confirm deployment health and `HONOR_API_ORIGIN` proxy between Vercel and the existing `honor-api` Render service; never expose credentials in client code.
2. Confirm Supabase schema/migrations, verified administrator account and company provisioning, without public self-service admin creation or synthetic business data.
3. Validate real staff sign-in, activation/recovery emails, role/location authorization and suspension in the hosted environment. Configure a reliable job runner for queued emails.
4. Import business-approved catalogue/SKUs/variants, actual shop locations and opening stock after a physical reconciliation. Publish only approved prices and product images.
5. Exercise order reservation, payment provider sandbox, webhook/reconciliation and idempotent fulfilment end-to-end. Enable real merchant payments only after owner/merchant approval.
6. Verify handset and desktop mobile layouts, errors, SEO metadata, customer/staff session transitions, and operations with live empty and nonempty states.

### P1 — needed for a strong first client handover

- Persistent sold-out product requests that show to authorized staff (currently not complete).
- Practical admin reporting time filters, exports, sales versus receipts versus profit distinctions and audit exports.
- File/image upload storage with access, attribution, broken-link handling and editorial controls.
- Shipping/delivery decisions, refunds/returns policies, receipt/accounting requirements as specified by the business.
- Monitoring, backups/restore rehearsal, reconciliation alerts, operational runbooks, and ownership of service billing.
- Actual responsive UI acceptance with company users; no fabricated products or performance claims.

### P2 — future evolution, not part of this change

- Separate deep-linkable customer cart/product/account/order pages if analytics, SEO and navigation justify them.
- Distinct staff subroutes (`/workspace/inventory`, `/workspace/orders`, etc.) with server-side permission gates if needed; current dashboard tabs already exist.
- Advanced promotions/discount engine, wholesale, integrations, forecasting, approvals and AI assistance only after inventory reliability is established.
- Multi-business or hundreds-of-branches scale: needs explicit tenancy, operations and permission design; do not assume the current single-company setup already supports it.

## Acceptance for this folder-only refactor

- The same URLs `/`, `/workspace`, all category and slug-shop URLs still resolve.
- `/admin` redirects to the existing role-secured workspace.
- Existing auth query links under `/workspace` continue to work.
- No duplicate routes, no new database changes, no public staff signup and no new secrets.
- Run `npm run check` and `npm run build:storefront` in CI, then open each route before merging.

Background references: `docs/DEPLOYMENT.md`, `docs/STAFF_ACCESS.md`, `docs/FEATURE_SCOPE.md`, `docs/PRODUCT_READINESS.md`, `docs/HONOR_REPORTS_ONLINE_STORE.md`.
