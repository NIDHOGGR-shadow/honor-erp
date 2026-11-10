# HONOR Operations and Storefront Management — Phase 4

This patch makes two additional **real application pages** in the protected `/workspace` interface. It does not add records to production.

## Who sees what
- **Reports** is visible to the store owner (ADMIN) and managers (MANAGER) with valid staff accounts. Numbers come from the company-authorized `/products`, `/stock/balances`, and `/orders` responses, filtered by the existing active location selector where applicable.
- **Online store** is visible only to an authorized store owner (ADMIN). It edits the existing shop heading, introduction, and collection heading through `PUT /company/storefront-content`.
- Staff in STOCK or SALES roles cannot open these pages merely by altering the frontend; this visibility control supplements, but does not replace, server enforcement.

## Report interpretation
- Available/reserved stock totals show actual units reported by the existing stock API.
- Published/draft counts reflect real products.
- Paid-order count and value reflect orders whose `payment_status` is `PAID` in the current records. They are **not** net revenue, confirmed bank deposits, or profit. No invented accounting totals or branch names.
- These are summaries of the currently loaded records. A full accounting ledger, reconciled bank transactions, time-range queries, export and expenses need dedicated backend work.

## Online store settings
- Owner may edit customer-facing wording through the existing endpoint.
- Product image/price completeness counts are derived from real products; actual product editing is done in Products.
- Desktop (16:9) and mobile (4:5) campaign image rectangles are labeled **planned only**. Upload, asset hosting, promotions, discount rules, and scheduling are deliberately not claimed to be available.

## Verification and deployment
- Run frontend tests/build and backend tests.
- Check authenticated role routes, mobile/tablet report overflow, zero-record states, and live store content updates in a **non-production** company.
- No migration, database seed, default price, imaginary stock, or production modification is performed by this PR until merged/deployed and authorized.
