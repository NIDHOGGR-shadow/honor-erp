# Honor product readiness — 24 October 2026

Honor is an inventory-first business application. The public product is the shop and authenticated staff workspace, not a presentation walkthrough.

## Removed from the shipped product

- Public browser-local inventory mode and its build flag. `/demo` now redirects to `/workspace`; `/pilot` redirects to `/`.
- Presentation pages, guides, customer footer demo link and production imports of the historical localStorage workspace.
- The sample-business/product/account seeder in the operator CLI.
- Simulated-payment controls in the customer UI. The simulation endpoint is not registered by production API configuration; isolated test helpers remain for payment failure/concurrency tests.
- Guest checkout. The API requires an authenticated session before reserving stock or starting/checking payment. New orders bind to the account ID and verified account email; submitted email cannot redirect receipts.
- Opening-soon marketing that masked the missing catalogue connection. Missing services now produce an honest unavailable state, with no invented catalogue, account, successful operation or payment.

## Real application workflow

1. Customers browse published products and available quantities without signing in. Inventory counts come from PostgreSQL through the API.
2. Customers sign in before checkout; the cart is retained and sign-in returns them to checkout. The server reserves stock atomically and verifies provider payment evidence before marking payment confirmed.
3. Staff use `/workspace`. No public staff/business registration exists. Company roles and permitted locations come from the API, not browser-selected roles.
4. The authenticated overview shows all permitted products and available counts, with search and a needs-attention filter. Stock receiving, transfers, adjustments, serial/IMEI lookup, orders and activity use API commands.
5. Device serial/IMEI assignment is confirmed by staff during physical handover. Customer receipts show the confirmed device information privately.
6. Admin-assigned staff access, temporary password replacement, email/password changes, suspension and session revocation remain enforced server-side.

## Refinement of the actual staff workspace

Phone header controls have distinct targets and bounded company/location selectors. The mobile menu uses an accessible modal with Close, Escape, focus containment/return and scroll locking. Four mobile navigation actions link to real authenticated pages. Stock cards use two columns on phones, tables scroll within their panels, forms use readable phone input sizes and bottom navigation reserves device safe-area space. The last successful sync time is shown; a refresh failure does not pretend that a write succeeded.

## Verified hosting gaps

Supabase `uxbpiigidvmlfwysomnl` contains the private Honor schema, no business, no administrator membership and no products. The designated administrator's email is verified. This alone does not create an Honor login or grant a staff role.

The hosted API is not activated. Private repository access for Render and permission to transfer the existing restricted database URL/session secret are unresolved. The connected Vercel project was not available for environment management; its server-only `HONOR_API_ORIGIN` still needs the actual verified API host. Migration 0005 (first-login password replacement) is applied and verified in Supabase. No company, accounts, products or stock are fabricated as a workaround.

The one-service free Render configuration has no background processor. Invitation/security email delivery, payment-event processing/reconciliation and scheduled reservation cleanup require an actual job runner and provider configuration. Merchant payments stay disabled until full acceptance passes. Production business ownership, monitoring and service costs remain decisions for the operating business.

## Remaining feature work

- Sold-out product requests persisted in the database, visible to permitted staff/admin as real dashboard notifications. Do not fake request receipt or alert delivery in the browser.
- Finish the host connection and provision the empty Honor business for the verified administrator after their actual Honor sign-in.
- Accept a complete real workflow: sign-in, staff permissions/revocation, product setup, receive stock, publish, customer checkout, verified provider events, fulfilment and private receipt. No sample inventory is added by this audit.

Frontend builds and database integration tests demonstrate implementation behavior. Authenticated hosted and handset acceptance remain outstanding while access is unavailable. Do not describe them as completed.

Database security advisor: no private-schema access errors were reported; Supabase Auth still reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This setting was not changed or upgraded by this release.
