# Honor: the product and the current pilot

Honor is the inventory system for one business named Honor, with a staff workspace and a connected customer shop. It is not currently a platform for other businesses to register stores. Inventory is the core: what is available, where it is, who moved it and which physical unit was handed to a customer. Orders, customer accounts and payments support that record.

## Who uses it

- An operator provisions Honor's first administrator. Administrators manage locations and assign staff accounts by invitation or temporary password. Suspension blocks existing sessions from company records while retaining stock and audit history.
- Stock staff receive, adjust and transfer stock within permitted locations. Managers and sales staff receive their own company-controlled permissions.
- Customers browse published products, create accounts, place collection orders, track payment and download private receipts. Customer signup grants no access to company inventory or staff administration.

The business operating Honor should control its production hosting, merchant accounts, email delivery and administrator access. Developer support access should be granted by the business. No paid hosting has been activated by the free-pilot configuration.

## Main workflow

1. Verify the first administrator's email and sign in. An operator provisions the single Honor business; there is no public business-creation endpoint.
2. The administrator assigns staff email, role and locations. Invited staff activate their assigned account privately; administrator-issued temporary passwords must be replaced before accessing business data.
3. Add locations, products and opening stock when the business is ready. Initial setup adds no sample inventory.
4. Publish products to the company shop at `/shop/<company-slug>`. A preferred single-company home page can additionally use `HONOR_STORE_SLUG`.
5. A signed-in customer reserves available stock; the server controls quantities and payment state. Staff record physical collection and the available serial/IMEI at handover. Receipts retain the relevant device information privately.

## Refinement delivered in this pass

- A missing shop connection reports temporarily unavailable products and stock. It does not substitute a presentation page or invent inventory.
- Customer account availability depends on the backend connection, independently of a catalogue slug. An unconfigured shop no longer blocks account setup when the API is connected.
- Company shop URLs now have an actual Next.js route, matching the links used in the staff workspace.
- Confirmation fragments are handled on both the shop and workspace. Credentials are removed from the address bar and validated through the backend exchange; client-side claims do not grant permissions.
- Collection details no longer remain in an endless loading state when there is no shop configured.
- Forms remain editable when the backend is disconnected. A small green message distinguishes an unsent request from an accepted request. A cancelled, edited, expired or closed-tab draft cannot be sent later. No password is put in browser storage.
- Staff can change their own verified email and password. The stable staff ID retains history and permissions; administrators receive event notifications without passwords. Notification emails require the outbox processor and email delivery configuration.

## What remains blocked

The live interface is available, but the Honor API has not been deployed on Render. Render could not fetch the private repository, and transferring runtime credentials still requires explicit authorization. The connected Vercel account did not expose the existing storefront project for environment-variable management during this review. The database has no company or products, so there is no real catalogue to publish yet.

Migration 0005 is applied. After hosting access is resolved: deploy the API with the restricted Supabase connection and session settings, verify `/api/health`, set Vercel's server-only `HONOR_API_ORIGIN`, and provision the single Honor business with the operator command documented in [staff access](STAFF_ACCESS.md). Keep payments disabled until the merchant integration is tested.

The free pilot has no background worker. Automatic queued email, payment-event reconciliation and scheduled reservation cleanup are not provided by this deployment. See [the free Render setup](RENDER_FREE.md). Real authenticated, stock, payment and receipt flows remain deployment acceptance gates; an unavailable-state screen is not proof that those flows work.

Public presentation routes and sample-data seeding are retired. See [current product readiness](PRODUCT_READINESS.md).
