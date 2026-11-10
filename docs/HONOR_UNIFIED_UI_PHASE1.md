# HONOR — unified customer and staff UI, phase 1

## Product identity and production data rule

The visible application name is **HONOR**. Internal repository, API and package identifiers can continue to contain `erp`; they do not appear as a customer/staff brand.

Production must **never** show hard-coded sample devices, invented stock, illustrative sales totals, demo prices, fake payment confirmations or example staff. Customer data comes from the published catalogue API; staff data comes from authorized company-scoped endpoints. If the company, services or catalogue are not configured, display an honest unavailable/empty state, not a mock store.

Reference images, code-only visual experiments and synthetic fixtures may remain in gated development previews and tests, but must not render in public production components. An inventory item without a positive configured selling price cannot be placed in or checked out from a valid cart.

## Routes and security boundaries

- Public customer store: `/` (also `/shop/<company-slug>`); existing account, shopping cart, checkout, verification and receipts are unchanged in phase 1.
- Staff and admin: `/workspace`; authenticated using the existing identity provider. The server continues to check ADMIN, MANAGER, STOCK, SALES and location permissions for every sensitive request.
- The absence of a staff link on the public storefront is a navigation choice, **not** a security boundary.
- Do not create shared/default weak passwords. Use current administrator-issued invitation/temporary password and mandatory first-login replacement. Never put credentials in frontend configuration or Git.

## Changes included in this first PR

1. Exclude synthetic/reference product collections and fallback hero media from the public empty catalogue; show an explicit empty state.
2. Show `Price to be added` instead of `₦0`, and disable adding/checking out an unpriced product.
3. Remove public storefront links to internal staff login.
4. Begin the v4-inspired HONOR staff UI using quieter colors, compact navigation, distinct operations groups, product thumbnails from real catalogue records and dense tables.
5. Do not change API endpoints, storage, schema, finance totals, payment status, order actions, stock movement code or production deployment.

## What phase 1 is **not**

This does not yet install the standalone v4 mock screens as production pages. Doing so would introduce fabricated figures and bypass proven ERP flows. The next changes should replace each screen with React components driven by the **existing** real endpoints.

## Next pull requests (in order)

- **Phase 2:** customer category routes (Phones, Laptops, Tablets, Wearables, Earwears), responsive product and campaign images, actual catalogue filtering; no synthetic products.
- **Phase 3:** role-aware products table, detail pages and variant/price/publish forms using real APIs.
- **Phase 4:** stock receiving, transfers, sales/orders and audit views while preserving the backend transaction semantics.
- **Phase 5:** authenticated read-only reports with verified data; design accounting/expenses and promotions only after their schema and access checks are accepted.

## Release checks

Run `npm ci`, `npm run check`, `npm run build:storefront`, applicable backend integration tests, then inspect a Vercel **preview deployment**. Check empty catalogue, unpriced product, all four staff roles, branch restrictions, phone layout, checkout, payment and stock. Keep the PR in draft until those checks pass. Do not merge to `main` or deploy production based on a frontend screenshot.
