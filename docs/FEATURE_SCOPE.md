# Honor Nigeria: functional implementation

## Current decisions

- Vercel serves the customer shop and authenticated staff/admin workspace.
- Render runs the existing FastAPI backend. Supabase remains the database and identity provider.
- The customer storefront follows the saved China/UK reference structures. The staff/admin visual pass remains a later task.
- Store staff with administrator or manager permission enter and change NGN prices.
- Product and stock records come from the business. Overseas catalogues are references.
- New IMEI work, warranty/guarantee, repairs and return-policy work are paused. Existing inventory safeguards are preserved.
- Keep development explanations, source-selection decisions and project status in the conversation and engineering documents, outside customer/staff screens.
- Send proposed customer-facing wording to Samuel in the conversation before applying further copy changes. Production is a real store. On 6 November he requested correction of the current text; the exact replacements were sent in the conversation before implementation. Synthetic prices and stock remain confined to the separate review page, with an explicit review-only notice. His later visual feedback is still welcome.

## This implementation

- Separate optional model, colour, RAM/storage and regional-market fields for each SKU.
- Variant-specific prices, stock and images; selectable customer variants stay within the same model, category and market.
- Search includes model, colour, memory and market.
- Public collection-location availability excludes private warehouses and internal cost/serial fields.
- An authorised price-change form records the reason and old/new values. Stale edits return a conflict.
- Existing order prices remain snapshots. Checkout can submit the reviewed total; changed prices require customer review before stock is reserved.
- Available stock valuation uses current selling prices and excludes reserved units.
- Administrator-managed shop heading, introduction and collection-page heading.
- Product image previews and official specification links.
- Loading, unavailable, validation and failure states remain truthful and actionable.
- Active CI runs frontend checks/Next.js build and native PostgreSQL backend tests; legacy Cloudflare build jobs are removed.

## Acceptance and release

Migration 0006 was applied and verified for the PR #13 release on 6 November 2026. The storefront and recommendation work in PR #14 introduces no further schema migration. The regenerated bootstrap SQL is for an empty installation only; use Alembic for an existing database. Committing these features does not import live stock or complete a payment.

Local socket creation is unavailable in this execution environment. Local backend unit checks and offline migration export can run, while native PostgreSQL integration checks run in GitHub CI. Hosted acceptance still needs a configured API, business/admin access, real products and the store's merchant configuration.

## Deferred

Policy questions are in the separate store-manager PDF. Delivery/shipping, policy-backed service workflows, new IMEI work, advanced coupon/bundle rules and the staff/admin visual pass remain separate work. Editable promotional wording alone must never be described as a functioning discount engine.


## Image inputs added to the requirements

- Paste a direct HTTPS image link (supported by the current editor).
- Upload an image file from the staff device (planned).
- Optionally import from Google Drive or another approved asset source (planned).
- Choose durable image storage, ownership/access and broken-link handling before enabling file or cloud imports.

These new image methods are requirements only; no Drive connection or upload/storage integration is part of this functional change.
